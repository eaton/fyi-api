import {
  BaseImport,
  ScrapedTweet,
  TweetUrl,
  TwitterBrowser,
  scrapeTweetOembed
} from '../index.js';
import { UrlResolver } from '../../index.js';
import {
  TwitterImportOptions,
  TwitterImportCache,
  TwitterPost,
  TwitterMedia,
  TwitterLookupLevel
} from './types.js';

import is from '@sindresorhus/is';
import {
  MediaGDPREntity,
  PartialFavorite,
  PartialTweet,
  PartialTweetMediaEntity,
  TwitterArchive,
  TwitterHelpers
} from 'twitter-archive-reader';
import { format as formatDate } from 'date-fns';
import path from 'path';
import { TweetIndex } from './index.js';

const defaultOptions: TwitterImportOptions = {
  archive: true,
  favorites: true,
  media: true
};

export class Twitter extends BaseImport<TwitterImportCache> {
  declare options: TwitterImportOptions;
  declare cacheData: TwitterImportCache;

  browser: TwitterBrowser;
  resolver: UrlResolver;
  parentIndex: Map<string, string>;

  constructor(options: TwitterImportOptions = {}) {
    options = { ...defaultOptions, ...options };

    super(options);
    this.browser = new TwitterBrowser({
      headless: !!this.options.headless,
      attemptLogin: !!this.options.attemptLogin
    });
    this.resolver = new UrlResolver();
    this.cacheData = makeFreshCache();

    // Wrap our protected internal lookup function in a throttling mechanism
    this.parentIndex = new Map<string, string>();
  }

  cacheStats() {
    const rawTweets = [...this.cacheData.tweets.values()];

    return {
      tweets: rawTweets.length,
      replies: rawTweets.filter((t) => !!t.opId).length,
      selfReplies: rawTweets.filter((t) => t.handle && t.opHandle === t.handle)
        .length,
      threads: this.cacheData.threads.size,
      withMedia: rawTweets.filter((t) => t.media).length,
      withAlt: rawTweets.filter((t) => t.media?.find((m) => m.alt)).length
    };
  }

  async doImport(): Promise<void> {
    await this.loadCache();
    return Promise.resolve();
  }

  async loadCache(): Promise<TwitterImportCache> {
    this.cacheData = makeFreshCache();

    const tweetFiles = await this.cache.findAsync({ matching: 'tweets/tweet-*.json' });
    for (const tf of tweetFiles) {
      const t = this.cache.read(tf, 'auto') as TwitterPost;
      this.cacheData.tweets.set(t.id, t);
      this.addToThread(t);
    }

    if (isEmptyCache(this.cacheData)) {
      this.cacheData = await this.fillCache();
    }

    return Promise.resolve(this.cacheData);
  }

  async fillCache(): Promise<TwitterImportCache> {
    // Look for all available archive files; batch em up and let em rip
    let archives = (await this.input.findAsync({ matching: 'twitter-*.zip' })).sort();
    if (this.options.archive === 'newest') {
      archives = archives.slice(-1);
    } else if (this.options.archive === 'oldest') {
      archives = archives.slice(0, 1);
    }

    for (const a of archives) {
      const buffer = this.input.read(a, 'buffer');
      const archive = new TwitterArchive(buffer!, {
        ignore: ['ad', 'block', 'dm', 'moment', 'mute']
      });
      await archive.ready();

      const archiveInfoPath = `${archive.user.screen_name}/${formatDate(
        archive.generation_date,
        'yyyy-MM-dd'
      )}-archive.json`;
      if (this.cache.exists(archiveInfoPath)) {
        this.log(
          'Skipping %s archive for %s (already cached)',
          formatDate(archive.generation_date, 'yyyy-MM-dd'),
          archive.user.screen_name
        );
        continue;
      } else {
        this.log(
          'Processing %s archive for %s (%d tweets, %d favorites)',
          formatDate(archive.generation_date, 'yyyy-MM-dd'),
          archive.user.screen_name,
          archive.tweets.length,
          archive.favorites.length
        );
      }

      await this.cache.writeAsync(archiveInfoPath, {
        hash: archive.synthetic_info.hash,
        ...archive.synthetic_info.info.user,
        tweets: archive.synthetic_info.tweet_count ?? 0,
        favorites: archive.favorites.length ?? 0,
        followers: archive.followers.size ?? 0,
        following: archive.followings.size,
        follower_list: [...archive.followers],
        following_list: [...archive.followings]
      });

      for (const t of archive.tweets.sortedIterator('asc')) {
        if (isRetweet(t)) {
          if (this.options.retweets) {
            const ct = await this.cacheTweet(t);
            this.cacheData.tweetIndex.add({
              id: ct.id,
              handle: archive.user.screen_name,
              list: 'retweets',
              date: t.created_at_d?.toISOString()
            });
          }
        } else {
          if (this.options.media) {
            await this.copyTweetMedia(t, archive);
          }
          await this.cacheTweet(t);
        }
      }

      if (this.options.favorites) {
        for (const f of archive.favorites.all) {
          this.cacheData.tweetIndex.add({
            id: f.tweetId,
            handle: archive.user.screen_name,
            list: 'favorites'
          });

          await this.cacheTweet(f);
        }
      }

      await this.cacheIndexes();
      archive.releaseZip();
    }

    return Promise.resolve(this.cacheData);
  }

  async copyTweetMedia(t: PartialTweet, archive: TwitterArchive) {
    if (this.options.media) {
      for (const me of t.extended_entities?.media ?? []) {
        const variant = me.video_info?.variants
          ?.filter((v) => v.content_type === 'video/mp4')
          .pop();
        const filename = path
          .parse(variant?.url ?? me.media_url_https)
          .base.split('?')[0];

        if (!this.cache.exists(filename)) {
          try {
            const ab = await archive.medias.fromTweetMediaEntity(me, true);
            const buffer = Buffer.from(ab as ArrayBuffer);
            await this.cache.writeAsync(`media/${filename}`, buffer);
          } catch (err: unknown) {
            this.log(`Couldn't read ${filename} from archive`);
            // Swallow this; it generally means the tweet is a RT with media,
            // and the original files aren't in the local archive.
          }
        }
      }
    }
  }

  async cacheIndexes() {
    // write the current Tweet index to disk
    for (const [handle, lists] of Object.entries(
      this.cacheData.tweetIndex.batchedvalues()
    )) {
      for (const [list, tweets] of Object.entries(lists)) {
        this.cache.write(`${handle}/${list}.json`, tweets);
      }
    }
  }

  protected pathToTweet(t: TwitterPost): string {
    // Get the date in case it's a partial tweet
    if (t.url && !t.id) {
      t.id = new TweetUrl(t.url).id;
    }

    if (t.fromFav) {
      return `favorites/tweet-${t.id}.json`;
    } else if (t.fromRetweet) {
      return `retweets/tweet-${t.id}.json`;
    } else {
      return `tweets/tweet-${t.id}.json`;
    }
  }

  async getTweet(id: string | number): Promise<TwitterPost | undefined> {
    return this.cache.readAsync(`tweet/tweed-${id}.json`, 'auto');
  }

  protected tweetIsCached(id: string) {
    return this.cache.exists(
      `(tweets, favorites, retweets)/tweet-${id}.json`
    );
  }

  protected tweetHasScreenshot(id: string) {
    return (
      this.cache.exists(`screenshots/tweet-${id}.jpeg`) ||
      this.cache.exists(`screenshots/tweet-${id}.png`)
    );
  }

  toTwitterPost(
    input: string | URL | PartialTweet | PartialFavorite | TwitterPost
  ): TwitterPost {
    let tweet: TwitterPost | undefined = undefined;

    if (is.string(input) || is.urlInstance(input)) {
      // Rare but possible scenario where all we have to go on is a Tweet ID
      // or URL; we log it and move on.
      const url = new TweetUrl(input.toString());
      tweet = {
        id: url.id,
        url: url.href,
        fromBareId: true
      };
    } else if (isPartialTweet(input)) {
      tweet = {
        id: input.id_str,
        date: TwitterHelpers.dateFromTweet(input).toUTCString() ?? undefined,
        userId: input.user.id_str,
        handle: input.user.screen_name,
        displayName: input.user.name,
        text: input.full_text ?? input.text,
        retweets: input.retweet_count,
        favorites: input.favorite_count,
        opId: input.in_reply_to_status_id_str,
        opHandle: input.in_reply_to_screen_name,
        urls: input.entities.urls.map((u) => {
          return { text: u.url, title: u.display_url, url: u.expanded_url };
        }),
        media: this.toTwitterMedia(
          input.extended_entities?.media ?? input.entities?.media ?? []
        )
      };

      // Retweets impose some extra strangeness
      if (isRetweet(input)) {
        if (input.retweeted_status) {
          tweet = this.toTwitterPost(input.retweeted_status);
          tweet.fromRetweet = true;
        } else {
          // old-style chained retweets mangle the user's handle and userID
          tweet.handle = input.user.screen_name.split(' ').shift();
          tweet.userId = undefined;
          tweet.fromRetweet = true;
        }
      }

      tweet.url = new TweetUrl(tweet.id, tweet.handle).href;
      if (tweet?.urls?.length === 0) tweet.urls = undefined;
    } else if (isPartialFavorite(input)) {
      tweet = {
        id: input.tweetId,
        url: input.expandedUrl,
        text: input.fullText,
        date: input.date?.toISOString(),
        fromFav: true
      };
    } else {
      tweet = input;
    }
    return tweet;
  }

  toTwitterMedia(
    input: (PartialTweetMediaEntity | MediaGDPREntity)[]
  ): TwitterMedia[] | undefined {
    let media: TwitterMedia[] = [];
    for (const m of input) {
      if (isGPRDMedia(m)) {
        media.push({
          id: m.id_str,
          text: m.display_url,
          url: m.expanded_url,
          imageUrl: m.media_url_https,
          videoUrl: m?.video_info?.variants?.pop()?.url,
          type: m.type,
          alt: m.media_alt
        });
      } else if (isPartialMedia(input)) {
        media.push({
          id: m.id_str,
          text: m.display_url,
          url: m.expanded_url,
          imageUrl: m.media_url_https,
          alt: m.media_alt
        });
      }
    }

    return media.length ? media : undefined;
  }

  async cacheTweet(
    input: string | URL | PartialTweet | PartialFavorite | TwitterPost,
    options: Record<string, unknown> = {}
  ): Promise<TwitterPost> {
    let tweet = this.toTwitterPost(input);

    // Populate the internal cache
    this.cacheData.tweets.set(tweet.id, tweet);
    tweet.threadId = this.getThread(tweet)?.id;
    this.addToThread(tweet);

    // If the tweet isn't already written to disk, push it to be sure
    if (!this.tweetIsCached(tweet.id) || options.force) {
      await this.cache.writeAsync(this.pathToTweet(tweet), tweet);
    }

    return Promise.resolve(tweet);
  }

  protected addToThread(tweet: TwitterPost) {
    if (tweet.threadId) {
      if (!this.cacheData.threads.has(tweet.threadId)) {
        this.cacheData.threads.set(tweet.threadId, new Set(tweet.id));
      } else {
        this.cacheData.threads.get(tweet.threadId)?.add(tweet.id);
      }
    }
  }

  async cleanupUrls(limit?: number) {
    for (const tweet of this.cacheData.tweets.values()) {
      if (tweet.urlsExpanded) continue;
      if (tweet.urls) {
        await this.expandUrls(tweet);
        tweet.urlsExpanded = true;
        this.cacheTweet(tweet, { force: true });
      }
      if (limit) limit--;
      if (limit === 0) return Promise.resolve();
    }
    return Promise.resolve();
  }

  async populateAltText(limit?: number): Promise<void> {
    let success = 0;
    let fail = 0;

    const incompleteMediaTweets = [...this.cacheData.tweets.values()].filter(
      (t) => t.media && !t.scraped
    );
    this.log(`Processing ${incompleteMediaTweets.length} media tweets`);

    for (const tweet of incompleteMediaTweets) {
      if (!tweet.url) continue;
      const scraped = await this.browser.capture(tweet.url);

      if (scraped.success) {
        success++;
        this._mergeScrapedData(tweet, scraped);
        tweet.scraped = true;
        this.cacheTweet(tweet, { force: true });
      } else {
        this.log(scraped.errors);
        fail++;
      }

      if (limit) limit--;
      if (limit === 0) {
        this.log('Reached batch limit');
        await this.browser.teardown();
        return Promise.resolve();
      }
    }
    await this.browser.teardown();
    return Promise.resolve();
  }

  async populateFavorites() {
    let favs = 0;
    for (const file of this.cache.find({ matching: 'favorites/tweet-*.json' })) {
      let tweet = this.cache.read(file, 'auto') as TwitterPost;
      if (tweet.fromFav && !tweet.favScraped) {
        tweet = await this.scrapeTweet(tweet, 'basic');
        if (!tweet.errors) tweet.favScraped = true;
        this.cacheTweet(tweet, { force: true });
        favs++;
      }
    }
    this.log(`Processed ${favs} favorites`);
    return Promise.resolve();
  }

  protected shouldScrape(tweet: TwitterPost) {
    if (this.options.scrape) {
      if (is.string(this.options.scrape)) {
        return this.options.scrape;
      } else if (is.function(this.options.scrape)) {
        return this.options.scrape(tweet);
      }
    }
    return false;
  }

  async scrapeTweet(tweet: TwitterPost, level: TwitterLookupLevel = 'basic') {
    const { screenshot, screenshotFormat, ...scraped } = await this.lookupTweet(
      tweet.url ?? tweet.id,
      level
    );
    this.log(tweet, scraped);
    tweet = this._mergeScrapedData(tweet, scraped);
    if (screenshot) {
      const screenshotPath = `screenshots/${tweet.id}.${screenshotFormat}`;
      await this.cache.writeAsync(screenshotPath, screenshot);
      tweet.screenshot = screenshotPath;
    }
    return Promise.resolve(tweet);
  }

  async expandUrls(tweet: TwitterPost): Promise<TwitterPost> {
    // Filter out hashtags, stock symbols, and @mentions
    let urls =
      tweet.urls?.filter((u) => {
        return (
          !u.text?.startsWith('$') &&
          !u.text?.startsWith('#') &&
          !u.text?.startsWith('@')
        );
      }) ?? [];

    // Tidy up paths without a hostname
    for (const su of urls) {
      if (su.url) {
        const pu = new URL(su.url, 'https://twitter.com');
        su.url = pu.href;

        const output = await this.resolver.resolve(pu.href);
        if (output && output.resolved) {
          if (output.redirects) {
            // This is an extremely jank hack to avoid evernote redirecting
            // skitch image URLs to the evernote signup page
            const skitchUrl = output.redirects.find((u) =>
              u.includes('img.skitch.com')
            );
            if (skitchUrl) {
              su.resolved = skitchUrl;
            } else {
              su.resolved = output.resolved;
            }
          }

          if (pu.hostname !== 't.co') {
            su.normalized = output.normalized;
            su.redirects = output.redirects;
            // Normally we'd also include the status here, but all Twitter t.co links respond
            // with a 403 when you use a HEAD request, so eff 'em
            su.status = output.status;
          }
        }
      }
    }

    tweet.urls = urls.length ? urls : undefined;
    return Promise.resolve(tweet);
  }

  protected _mergeScrapedAltText(
    tweet: TwitterPost,
    scraped: ScrapedTweet
  ): TwitterPost {
    for (const sm of scraped.media ?? []) {
      if (!sm.alt || sm.alt === 'Image') continue;
      const match = tweet.media?.find((em) => em.imageUrl === sm.imageUrl);
      if (match) {
        match.alt ??= sm.alt;
      }
    }
    return tweet;
  }

  protected _mergeScrapedUrls(
    tweet: TwitterPost,
    scraped: ScrapedTweet
  ): TwitterPost {
    for (const su of scraped.urls ?? []) {
      const match = tweet.urls?.find((em) => em.url === su.url);
      if (!match) {
        tweet.urls ??= [];
        tweet.urls.push(su);
      }
    }
    return tweet;
  }

  protected _mergeScrapedData(
    tweet: TwitterPost,
    scraped: ScrapedTweet
  ): TwitterPost {
    tweet.handle ??= scraped.handle;
    tweet.displayName ??= scraped.displayName;
    tweet.favorites ??= scraped.favorites;
    tweet.replies ??= scraped.replies;
    tweet.retweets ??= scraped.retweets;
    tweet.quotes ??= scraped.quotes;
    tweet.bookmarks ??= scraped.bookmarks;
    tweet.deleted = scraped.deleted;
    tweet.protected = scraped.protected;

    if (scraped.date) tweet.date ??= scraped.date;
    if (scraped.url) tweet.url ??= scraped.url;

    this._mergeScrapedAltText(tweet, scraped);
    this._mergeScrapedUrls(tweet, scraped);

    return tweet;
  }

  protected async lookupTweet(id: string, level: TwitterLookupLevel = 'basic') {
    // This wraps the different approaches we take to grabbing tweet data:
    // hitting the oEmbed endpoint? Firing up headless chrome and scraping?
    // Taking a screenshot? etc.

    if (level === 'screenshot') {
      // This returns a TweetCaptureResult record
      return await this.browser.capture(id, true);
    } else if (level === 'scrape') {
      // This returns a TweetCaptureResult with the `screenshot` property populated
      return this.browser.capture(id, false);
    } else {
      // This returns a TweetOembedData record
      return scrapeTweetOembed(id);
    }
  }

  getParent(tweet: TwitterPost, sameUser = true) {
    if (tweet.opId === undefined) {
      return undefined;
    } else if (sameUser && tweet.opHandle !== tweet.handle) {
      return undefined;
    } else {
      return this.cacheData.tweets.get(tweet.opId);
    }
  }

  getAncestors(tweet: TwitterPost, sameUser = true): TwitterPost[] {
    const parent = this.getParent(tweet, sameUser);
    if (parent === undefined) return [];
    return [parent, ...this.getAncestors(parent, sameUser)];
  }

  getThread(tweet: TwitterPost, sameUser = true) {
    return this.getAncestors(tweet, sameUser).pop();
  }
}

export function isTwitterPost(input: unknown): input is TwitterPost {
  return is.object(input) && 'id' in input && !('tweetId' in input);
}

export function isTwitterMedia(input: unknown): input is TwitterMedia {
  return is.object(input) && 'id' in input && 'tweetId' in input;
}

export function isPartialTweet(input: unknown): input is PartialTweet {
  return is.object(input) && 'id_str' in input && 'text' in input;
}

export function isPartialFavorite(input: unknown): input is PartialFavorite {
  return (
    is.object(input) &&
    'tweetId' in input &&
    'fullText' in input &&
    !('id' in input)
  );
}

export function isPartialMedia(
  input: unknown
): input is PartialTweetMediaEntity {
  return is.object(input) && 'media_url_https' in input;
}

export function isGPRDMedia(input: unknown): input is MediaGDPREntity {
  return isPartialMedia(input) && 'source_status_id' in input;
}

export function isRetweet(t: PartialTweet): boolean {
  return !!t.retweeted_status || !!t.retweeted;
}

export function isReply(t: PartialTweet): boolean {
  return !!t.in_reply_to_status_id_str;
}

export function isSelfReply(t: PartialTweet): boolean {
  return t.in_reply_to_user_id_str === t.user.id_str;
}

function makeFreshCache(): TwitterImportCache {
  return {
    archives: [],
    tweets: new Map<string, TwitterPost>(),
    threads: new Map<string, Set<string>>(),
    media: new Map<string, TwitterMedia>(),
    tweetIndex: new TweetIndex()
  };
}

function isEmptyCache(cache: TwitterImportCache) {
  return (
    cache.archives.length === 0 &&
    cache.tweets.size === 0 &&
    cache.media.size === 0
  );
}
