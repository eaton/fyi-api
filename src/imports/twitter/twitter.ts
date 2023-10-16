import { BaseImport, ScrapedTweet, TweetUrl, TwitterBrowser, TwitterUserIndex, scrapeTweetOembed } from '../index.js';
import { camelCase, UrlResolver } from '../../index.js';
import { TwitterImportOptions, TwitterAnalyticsRow, TwitterAnalyticsSet, TwitterImportCache, TwitterPost, TwitterMedia, TwitterLookupLevel, FoundUrl } from "./types.js";

import is from '@sindresorhus/is';
import pThrottle from 'p-throttle';
import { MediaGDPREntity, PartialFavorite, PartialTweet, PartialTweetMediaEntity, TwitterArchive } from "twitter-archive-reader";
import { parseString } from '@fast-csv/parse';
import { parseISO, max as maxDate, min as minDate, format as formatDate } from 'date-fns';
import path from 'path';
import { TweetIndex } from './tweet-index.js';

export class Twitter extends BaseImport<TwitterImportCache> {
  declare options: TwitterImportOptions;
  
  browser: TwitterBrowser;
  resolver: UrlResolver;
  cacheData: TwitterImportCache;
  parentIndex: Map<string, string>;
  lookupTweet: (id: string, level: TwitterLookupLevel) => Promise<ScrapedTweet>;

  constructor(options: TwitterImportOptions = {}) {
    super(options);
    this.browser = new TwitterBrowser({ headless: !!this.options.headless });
    this.resolver = new UrlResolver();
    this.cacheData = {
      archives: [],
      tweets: new Map<string, TwitterPost>(),
      threads: new Map<string, Set<string>>(),
      media: new Map<string, TwitterMedia>(),
      tweetIndex: new TweetIndex(),
      userIndex: new TwitterUserIndex(),
      metrics: new Map<string, TwitterAnalyticsRow[]>(),
    };

    this.options.scrape ??= t => {
      if (t.media) return 'scrape';              // Media tweets don't have alt text
      if (t.handle === undefined || t.date === undefined) return 'basic';   // Favorites dont have name populated
      return false; 
    }

    // Wrap our protected internal lookup function in a throttling mechanism
    const throttle = pThrottle({
      limit: options.scrapingLimit ?? 7,
      interval: options.scrapingInterval ?? 5000
    });
    this.lookupTweet = throttle(this._lookupTweet);
    this.parentIndex = new Map<string, string>();
  }

  async doImport(): Promise<void> {
    await this.loadCache();
    return Promise.resolve();
  }

  async loadCache(): Promise<void> {
    this.resolver = new UrlResolver({ known: await this.files.readCache('known-urls.json') });
    await this.fillCache();
    if (this.options.cleanupUrls) {
      await this.cleanupUrls();
    }
    if (this.options.populateFavorites) {
      await this.populateFavorites();
    }
    this.files.writeCache('known-urls.json', this.resolver.values());
    return Promise.resolve();    
  }

  async fillCache(): Promise<void> {
    if (this.options.metrics !== false) {
      await this.processAnalytics();
    }

    if (this.options.archive !== false) {
      await this.processArchives();
    }

    if (this.options.custom) {
      await this.processCustom(this.options.custom);
    }

    return Promise.resolve();
  }
  
  async processCustom(input: boolean | string | string[]) {
    let tweets: Record<string, string[]> = {};
    if (input === true) {
      for (const file of await this.files.findInput('*.txt')) {
        const data = await this.files.readInput(file);
        if (is.string(data)) {
          tweets[path.parse(file).base] = data.split(/\n,/);
        }
      }
    } else if (is.string(input)) {
      for (const file of await this.files.findInput(input)) {
        const data = await this.files.readInput(file);
        if (is.string(data)) {
          tweets[path.parse(file).base] = data.split(/\n,/);
        }
      }
    } else if (is.array<string>(input)) {
      tweets.custom = input.map(v => new TweetUrl(v).href);
    }

    for (const [batch, ids] of Object.entries(tweets)) {
      for (const id of ids) {
        await this.cacheTweet(id);
      }
      this.files.writeCache(`${batch}.txt`, ids.join('\n'));
      this.log('Processed %d tweets from %s', ids.length, batch);
    }
  }

  /**
   * Because Twitter's API has gone from one of the marvels of the modern web
   * to a cautionary tale that makes Oracle licensing look charitable, no actual
   * API interaction happens here. Instead, we read in the raw zip archives that
   * Twitter provides when you ask to "download all your data."
   * 
   * There's a lot of data in each archive, and this cache step does several things:
   * 
   * 1. Resolves thread relationships, as long as all tweets are by the archive user.
   * 2. Splits original tweets, replies, retweets, media entities, media *files*,
   *    mentioned users, and shortened URLs to facilitate selective post-processing.
   * 3. Optionally ingests multiple archives in one go, in case tweets disappear
   *    from a later archive but exist in an older one. It's rare, but does happen.
   */
  async processArchives(): Promise<void> {
    // Look for all available archive files; batch em up an let em rip
    let archives = (await this.files.findInput('**/twitter-*.zip')).sort();
      if (this.options.archive === 'newest') {
      archives = archives.slice(-1);
    } else if (this.options.archive === 'oldest') { 
      archives = archives.slice(0,1);
    }

    for (const a of archives) {
      const buffer = this.files.readInput(a, { parse: false });
      const archive = new TwitterArchive(buffer, { ignore: ['ad', 'block', 'dm', 'moment', 'mute'] });
      await archive.ready();

      const archiveInfoPath = `${archive.user.screen_name}-${formatDate(archive.generation_date, 'yyyy-MM-dd')}-archive.json`;
      if (this.files.existsCache(archiveInfoPath)) {
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
          archive.favorites.length,
        );
      }

      await this.files.writeCache(
        archiveInfoPath,
        {
          hash: archive.synthetic_info.hash,
          ...archive.synthetic_info.info.user,
          tweets: archive.synthetic_info.tweet_count ?? 0,  
          favorites: archive.favorites.length ?? 0,
          followers: archive.followers.size ?? 0,
          following: archive.followings.size,
          follower_list: [...archive.followers],
          following_list: [...archive.followings]
        }
      );
  
      for (const t of archive.tweets.sortedIterator('asc')) {
        await this.cacheTweet(t);
        if (this.options.media) {
          for (const me of t.extended_entities?.media ?? []) {
            const variant = me.video_info?.variants?.filter(v => v.content_type === 'video/mp4').pop();
            const filename = path.parse(variant?.url ?? me.media_url_https).base.split('?')[0];

            if (!this.files.existsCache(filename)) {
              try {
                const ab = await archive.medias.fromTweetMediaEntity(me, true);
                const buffer = Buffer.from(ab as ArrayBuffer);
                await this.files.writeCache(`media/${filename}`, buffer);
              } catch(err: unknown) {
                // Swallow this
              }
            }
          }
        }
      }
  
      if (this.options.favorites) {
        for (const f of archive.favorites.all) {
          await this.cacheTweet(f);
          this.cacheData.tweetIndex.add({ id: f.tweetId, handle: archive.user.screen_name, list: 'favorites', date: f.date?.toISOString() });
        }
      }

      await this.cacheIndexes();
      archive.releaseZip();
    }
  }

  async cacheIndexes() {
    // write the current Tweet index to disk
    for (const [handle, lists] of Object.entries(this.cacheData.tweetIndex.batchedvalues())) {
      for (const [list, tweets] of Object.entries(lists)) {
        this.files.writeCache(`${handle}-${list}.json`, tweets);
      }
    }

    // write the current User index to disk
    // write the current KnownUrls index to disk
  }

  async processAnalytics() {
    const analytics = await this.files.findInput('**/daily_tweet_activity_metrics_*.csv');
    const allData: Record<string, TwitterAnalyticsSet> = {};

    const getStart = (a: string | undefined, b: string | undefined) => {
      return formatDate(
        minDate([
          parseISO(a ?? '9999-01-01'),
          parseISO(b ?? '9999-01-01')
        ]),'yyyy-MM-dd');
    }
    const getEnd = (a: string | undefined, b: string | undefined) => {
      return formatDate(
        maxDate([
        parseISO(a ?? '0001-01-01'),
        parseISO(b ?? '0001-01-01')
      ]),'yyyy-MM-dd');
    }

    const metricsRegex = /daily_tweet_activity_metrics_(.+)_\d{8}_\d{8}_(\w+).csv/;
    for (const file of analytics) {
      const [handle, locale] = file.match(metricsRegex)?.slice(1) ?? [];
      allData[handle] ??= { handle, start: undefined, end: undefined, locale, rows: [] };
      
      // ridic. inefficient, but it works for now. We should cache in headers/rows
      // nested array format rather than full named object mode.
      await this.files.readInput(file, { parse: false })
        .then(raw => parseString(raw, { headers: true })
          .on('error', error => this.log(error))
          .on('data', row => {
              const mappedRow = Object.fromEntries(
              Object.entries(row).map(([k, v]) => [camelCase(k), (v === '-') ? undefined : v])
            ) as TwitterAnalyticsRow;
            allData[handle].start = getStart(allData[handle].start, mappedRow.date);
            allData[handle].end = getEnd(allData[handle].end, mappedRow.date);
            allData[handle].rows.push(mappedRow);
          })
        );
    }

    for (const [user, data] of Object.entries(allData)) {
      await this.files.writeCache(`${user}-analytics.json`, data);
      this.log(`Cached ${user} analytics (covering ${data.rows.length} days)`);
    }
    return Promise.resolve();
  }

  protected pathToTweet(t: TwitterPost, includeDate = false): string {
    if (includeDate) {
      return t.date ?
      `tweets/${formatDate(new Date(t.date), 'yyyy/MM/')}tweet-${t.id}.json`:
      `tweets/unknown/tweet-${t.id}.json`;
    } else {
      return `tweets/tweet-${t.id}.json`
    }
  }

  async getTweet(id: string | number): Promise<TwitterPost | undefined> {
    return this.files.readCache(`tweet/tweed-${id}.json`);
  }

  protected tweetIsCached(id: string) {
    return this.files.existsCache(`tweets/tweet-${id}.json`);
  }

  protected tweetHasScreenshot(id: string) {
    return (
      this.files.existsCache(`screenshots/tweet-${id}.jpeg`) ||
      this.files.existsCache(`screenshots/tweet-${id}.png`)
    );
  }

  toTwitterPost(input: string | URL | PartialTweet | PartialFavorite | TwitterPost): TwitterPost {
    let tweet: TwitterPost | undefined = undefined; 

    if (is.string(input) || is.urlInstance(input)) {
      // Rare but possible scenario where all we have to go on is a Tweet ID
      // or URL; we log it and move on.
      const url = new TweetUrl(input.toString());
      tweet = {
        id: url.id,
        url: url.href,
        incomplete: true,
        fromBareId: true,
      };

    } else if (isPartialTweet(input)) {
      // Tweets and retweets from a downloaded Twitter Archive; this is
      // fairly complete but some information (alt text on media, etc)
      // can only be retrieved by scraping after the fact.
      const url = new TweetUrl(input.id_str, input.user.screen_name);
      tweet = {
        id: url.id,
        url: url.href,
        date: input.created_at_d ? input.created_at_d.toISOString() : undefined,
        userId: input.user.id_str,
        handle: input.user.screen_name,
        displayName: input.user.name,
        text: input.full_text ?? input.text,
        retweets: input.retweet_count,
        favorites: input.favorite_count,
        isReplyToTweet: input.in_reply_to_status_id_str,
        isReplyToUser: input.in_reply_to_screen_name,
        urls: input.entities.urls.map(u => {
          return { text: u.url, title: u.display_url, url: u.expanded_url }
        }),
        media: this.toTwitterMedia(input.extended_entities?.media ?? input.entities?.media ?? []),
      };

      if (input.extended_entities?.media) {
        tweet.hasMedia = true;
        tweet.incomplete = true; // We need to look up image alt tags
      }

      if (input.retweeted_status) {
        // We record the fact that this user retweeted it, but return the underlying
        // retweeted status for caching purposes.
        this.cacheData.tweetIndex.add({ id: tweet.id, handle: tweet.handle, list: 'retweets', date: tweet.date });
        tweet = this.toTwitterPost(input.retweeted_status);
      }

    } else if (isPartialFavorite(input)) {
      tweet = {
        id: input.tweetId,
        url: input.expandedUrl,
        text: input.fullText,
        date: input.date?.toISOString(),
        fromFav: true,
        incomplete: true, // We need to look up user name, full text, etc.
      };
    } else {
      tweet = input;
    }
    return tweet;
  }

  toTwitterMedia(input: (PartialTweetMediaEntity | MediaGDPREntity)[]): TwitterMedia[] | undefined {
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

    // Don't overwrite already-cached tweets
    if (this.tweetIsCached(tweet.id) && !options.force) {
      return Promise.resolve(tweet);
    }

    await this.files.writeCache(this.pathToTweet(tweet), tweet);
    return Promise.resolve(tweet);
  }

  async cleanupUrls() {
    for (const file of await this.files.findCache('tweets/tweet-*.json')) {
      let tweet = await this.files.readCache(file) as TwitterPost;

      if (tweet.urls) {
        tweet.urls = await this.expandUrls(tweet.urls);
      }
      this.cacheTweet(tweet, { force: true });
    }
  }

  async populateFavorites() {
    let favs = 0;
    for (const file of await this.files.findCache('tweets/tweet-*.json')) {
      let tweet = await this.files.readCache(file) as TwitterPost;
      if (tweet.incomplete && tweet.fromFav && !tweet.errors) {
        tweet = await this.scrapeTweet(tweet, 'basic');
        if (!tweet.errors) tweet.incomplete = undefined;
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
    const { screenshot, screenshotFormat, ...scraped } = await this.lookupTweet(tweet.id, level);
    tweet = this.mergedScrapedData(tweet, scraped);
    if (screenshot) {
      const screenshotPath = `screenshots/${tweet.id}.${screenshotFormat}`;
      await this.files.writeCache(screenshotPath, screenshot);
      tweet.screenshot = screenshotPath;
    }
    return Promise.resolve(tweet);
  }

  async expandUrls(urls: FoundUrl[]): Promise<FoundUrl[]> {
    // Filter out hashtags, stock symbols, and @mentions
    urls = urls?.filter(u => {
      return (!u.text?.startsWith('$') && !u.text?.startsWith('#') && !u.text?.startsWith('@'));
    });

    // Tidy up paths without a hostname
    for (const su of urls ?? []) {
      if (su.url) {
        const pu = new URL(su.url, 'https://twitter.com');
        su.url = pu.href;

        const output = await this.resolver.resolve(pu.href);
        if (output && output.resolved) {
          if (output.redirects) {
            // This is an extremely jank hack to avoid evernote redirecting
            // skitch image URLs to the evernote signup page
            const skitchUrl = output.redirects.find(u => u.includes('img.skitch.com'));
            if (skitchUrl) {
              su.resolved = skitchUrl;
            } else {
              su.resolved = output.resolved;
            }
          }

          if (pu.hostname !== 't.co') {
            su.normalized = output.normalized
            su.redirects = output.redirects;
            // Normally we'd also include the status here, but all Twitter t.co links respond
            // with a 403 when you use a HEAD request, so eff 'em
            su.status = output.status;
          }
        }
      }
    }
    return Promise.resolve(urls);
  }

  protected mergedScrapedData(tweet: TwitterPost, scraped: ScrapedTweet): TwitterPost {
    tweet.handle ??= scraped.handle;
    tweet.displayName ??= scraped.displayName;
    tweet.favorites ??= scraped.favorites;
    tweet.replies ??= scraped.replies;
    tweet.retweets ??= scraped.retweets;
    tweet.quotes ??= scraped.quotes;
    tweet.bookmarks ??= scraped.bookmarks;
    tweet.deleted = scraped.deleted;
    tweet.protected = scraped.protected;

    if (scraped.date) tweet.date = scraped.date;
    if (scraped.url) tweet.url = scraped.url

    for (const su of scraped.urls ?? []) {
      const match = tweet.urls?.find(em => em.url === su.url);
      if (!match) {
        tweet.urls ??= [];
        tweet.urls.push(su);
      }
    }

    // We need to take a look at these and resolve them cleanly
    for (const sm of scraped.media ?? []) {
      const match = tweet.media?.find(em => em.imageUrl === sm.imageUrl);
      if (match) {
        match.alt ??= sm.alt;
      } else {
        tweet.media ??= [];
        tweet.media.push(sm);
      }
    }

    return tweet;
  }

  protected async _lookupTweet(id: string, level: TwitterLookupLevel = 'basic') {
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
  return is.object(input) && 'tweetId' in input && 'fullText' in input && !('id' in input);
}

export function isPartialMedia(input: unknown): input is PartialTweetMediaEntity {
  return is.object(input) && 'media_url_https' in input;
}

export function isGPRDMedia(input: unknown): input is MediaGDPREntity {
  return isPartialMedia(input) && 'source_status_id' in input;
}

export function isRetweet(t: PartialTweet): boolean {
  return (t.retweeted_status !== undefined || !!t.retweeted);
}

export function isReply(t: PartialTweet): boolean {
  return (!!t.in_reply_to_status_id_str);
}

export function isSelfReply(t: PartialTweet): boolean {
  return (t.in_reply_to_user_id_str === t.user.id_str);
}
