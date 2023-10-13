import { BaseImport, TweetParsedData, TweetUrl, TwitterBrowser, scrapeTweetOembed } from '../index.js';
import { camelCase, UrlResolver } from '../../index.js';
import { TwitterImportOptions, TwitterAnalyticsRow, TwitterAnalyticsSet, TwitterImportCache, TwitterPost, TwitterMedia } from "./types.js";

import is from '@sindresorhus/is';
import pThrottle from 'p-throttle';
import { PartialFavorite, PartialTweet, PartialTweetMediaEntity, TwitterArchive, UserData } from "twitter-archive-reader";
import { parseString } from '@fast-csv/parse';
import { parseISO, max as maxDate, min as minDate, format as formatDate } from 'date-fns';

export class Twitter extends BaseImport<TwitterImportCache> {
  declare options: TwitterImportOptions;
  
  collections = ['twitter_post', 'twitter_favorite', 'twitter_media'];

  browser: TwitterBrowser;
  resolver: UrlResolver;
  cacheData: TwitterImportCache;
  lookupTweet: (id: string) => Promise<TweetParsedData>;

  constructor(options: TwitterImportOptions = {}) {
    super(options);
    this.browser = new TwitterBrowser();
    this.resolver = new UrlResolver();
    this.cacheData = {
      archives: [],
      tweets: new Map<string, TwitterPost>(),
      threads: new Map<string, Set<string>>(),
      media: new Map<string, TwitterMedia>(),
      favorites: new Map<string, Set<string>>(),
      metrics: new Map<string, TwitterAnalyticsRow[]>(),    
    };

    const throttle = pThrottle({ limit: 10, interval: 1000 });
    this.lookupTweet = throttle(this._lookupTweet);
  }

  async doImport(): Promise<void> {
    await this.loadCache();
    return Promise.resolve();
  }

  async loadCache(): Promise<void> {
    this.resolver = new UrlResolver({ known: await this.files.readCache('known-urls.json') });

    // Load archive metadata
    // Load user metadata
    // load tweets
    // load favorites
    // load threads
    // load arbitrary tweet sets 
    // load media records

    await this.fillCache();

    this.files.writeCache('known-urls.json', this.resolver.values());

    return Promise.resolve();    
  }

  async fillCache(): Promise<void> {
    if (this.options.metrics) {
      await this.processAnalytics();
    }
    if (this.options.archive) {
      await this.processArchives();
    }

    return Promise.resolve();
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
   *
   * @returns {Promise<void>}
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
      const archive = new TwitterArchive(
        buffer, { ignore: ['ad', 'block', 'dm', 'moment', 'mute'] }
      );
  
      await archive.ready().then(() => {
        archive.releaseZip();
      });
      
      if (this.options.metadata) {
        await this.files.writeCache(
          `${archive.user.screen_name}-archive-${formatDate(archive.generation_date, 'yyyy-MM-dd')}.json`,
          archive.synthetic_info
        );
        await this.cacheUser(archive.user);
      }
  
      if (this.options.singles || this.options.replies || this.options.retweets || this.options.threads) {
        for (const t of archive.tweets.sortedIterator('asc')) {
          // cacheTweet() wraps the process of normalizing different data structures (like favs vs retweets
          // vs archived tweets vs scraped data), as well as logic for capturing screenshots.
          const tweet = await this.cacheTweet(t);
          this.log(tweet.id);
        }
        // Write out a master list of all the tweets
      }
  
      if (this.options.favorites) {
        for (const f of archive.favorites.all) {
          const favorite = await this.cacheTweet(f);
          this.log(favorite.id);
          // Write out a master list of how many favorites were saved and a list of their IDs
          // for actual processing on the export side
        }
      }
  
      if (this.options.media) {

      }
    }
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
      const [username, locale] = file.match(metricsRegex)?.slice(1) ?? [];
      allData[username] ??= { username, start: undefined, end: undefined, locale, rows: [] };
      
      // ridic. inefficient, but it works for now. We should cache in headers/rows
      // nested array format rather than full named object mode.
      await this.files.readInput(file, { parse: false })
        .then(raw => parseString(raw, { headers: true })
          .on('error', error => this.log(error))
          .on('data', row => {
              const mappedRow = Object.fromEntries(
              Object.entries(row).map(([k, v]) => [camelCase(k), v])
            ) as TwitterAnalyticsRow;
            allData[username].start = getStart(allData[username].start, mappedRow.date);
            allData[username].end = getEnd(allData[username].end, mappedRow.date);
            allData[username].rows.push(mappedRow);
          })
        );
    }

    for (const [user, data] of Object.entries(allData)) {
      await this.files.writeCache(`${user}-analytics.json`, data);
      this.log(`Cached ${user} analytics (covering ${data.rows.length} days)`);
    }
    return Promise.resolve();
  }

  isStandalone(t: PartialTweet): boolean {
    return (t.in_reply_to_status_id_str === undefined && t.retweeted_status === undefined);
  }

  isRetweet(t: PartialTweet): boolean {
    return (t.retweeted_status !== undefined || !!t.retweeted);
  }

  isReply(t: PartialTweet): boolean {
    return (!!t.in_reply_to_status_id_str);
  }

  isSelfReply(t: PartialTweet): boolean {
    return (t.in_reply_to_user_id_str === t.user.id_str);
  }

  protected async cacheUser(u: UserData): Promise<void> {
    await this.files.writeCache(`${u.screen_name}-details.json`, u);
    return Promise.resolve();
  }

  protected async prepMedia(t: PartialTweet, a: TwitterArchive): Promise<void> {
    for (const m of t.extended_entities?.media ?? []) {
      m.display_url;
      m.expanded_url;
      m.id_str;
      m.media_alt;
      m.media_url_https;
      m.source_status_id;
      m.type;
      m.video_info;
    }
    return Promise.resolve();
  }

  protected pathToTweet(t: TwitterPost): string {
    const d = new Date(t.date ?? '1970-01-01');
    const datePath = d ? formatDate(d, 'yyyy/MM/') : '';
    return `tweets/${datePath}${t.id}.json`;
  }

  protected tweetIsCached(id: string): boolean {
    return this.files.existsCache(`tweets/**/tweet-${id}.json`);
  }

  protected tweetHasScreenshot(id: string): boolean {
    return this.files.existsCache(`screenshots/**/tweet-${id}.(jpeg,png)`);
  }

  protected mediaIsCached(id: string): boolean {
    return this.files.existsCache(`media/**/media-${id}.json`);
  }

  protected mediaFileIsCached(id: string): boolean {
    return this.files.existsCache(`media-files/**/media-${id}.*`);
  }

  async cacheFavorites(archive: TwitterArchive) {   
    const throttle = pThrottle({ limit: 10, interval: 1000 });
    const lookup = throttle(this.lookupTweet);

    for (const fav of archive.favorites.all) {
      if (this.tweetIsCached(fav.tweetId)) continue;
      
      const favPath = `favorites/favorite-${fav.tweetId}.json`;

      let favorite: TweetParsedData = {
        id: fav.tweetId,
        url: fav.expandedUrl,
        text: fav.fullText,
      }

      // A plain boolean 'true' just means to save them; anything else, and
      // we've got a lookup level
      if (this.options.favorites !== true) {
        favorite = {
          ...favorite,
          ...(await lookup(fav.tweetId))
        };

        if (favorite.screenshot) {
          // Save the screenshot
          favorite.screenshot = undefined;
          favorite.screenshotFormat = undefined;
        }

        // This is where we would expand/resolve URLs, if that option is turned on
      }

      await this.files.writeCache(favPath, favorite);
    }
    return Promise.resolve();
  }
  
  async loadTweetSets() {
    await this.cacheTweetSets();
  }

  async cacheTweetSets() {
    const files = await this.files.findInput('save-*.txt');
    const tb = new TwitterBrowser({ headless: false });

    for (const file of files) {
      const set = file.match(/^.*save-(.*).txt/)?.pop();
      const urls = await this.files.readInput(file)
        .then(data => data.toString().split('\n') as string[]);

      for (const line of urls) {
        const [ url, id ] = line.match(/^.*\:\/\/twitter.com\/.+\/status\/(\d+)/) ?? [];

        if (url === undefined) continue;
        if (this.files.existsCache(`bookmarks/${id}.json`)) continue;
        if (this.files.existsCache(`bookmarks/error-${id}.json`)) continue;
  
        const { success, screenshot, screenshotFormat, ...json } = await tb.capture(url, true)
          .catch((err: unknown ) => {
            return {
              id: url.split('/').pop(),
              success: false,
              json: { html: err }
            } as TweetParsedData;
          });
        if (success) {
          if (screenshot) {
            await this.files.writeCache(`screenshots/${ set ? set + '/' : ''}${json.id}.${screenshotFormat}`, screenshot);
            this.files.writeCache(`bookmarks/${id}.json`, json);
          }
        } else {
          this.files.writeCache(`/error-${id}.json`, json);
        }
      }
    }
  }

  async cacheTweet(input: string | URL | PartialTweet | PartialFavorite, options: Record<string, unknown> = {}): Promise<TwitterPost> {
    let tweet: TwitterPost | undefined = undefined; 

    if (is.string(input) || is.urlInstance(input)) {
      const url = new TweetUrl(input.toString());
      tweet = { id: url.id, url: url.href };
    } else if (isPartialTweet(input)) {
      const url = new TweetUrl(input.id_str);
      tweet = {
        id: url.id,
        url: url.href,
        date: input.created_at_d?.toISOString(),
        userId: input.user.id_str,
        name: input.user.name,
        text: input.full_text,
      };

      if (input.retweeted_status) {
        await this.cacheTweet(input.retweeted_status);
        tweet.retweetOf = input.retweeted_status.id_str;
        tweet.text = undefined;
      }

    } else if (isPartialFavorite(input)) {
      const url = new TweetUrl(input.tweetId);
      tweet = {
        id: url.id,
        url: input.expandedUrl,
        text: input.fullText,
        date: input.date?.toISOString(),
      };
    }

    // Expand favorite details if necessary

    // Expand media alt text if necessary

    // Expand URLs if necessary

    if (tweet === undefined) {
      return Promise.reject(new TypeError('Tweet could not be populated', { cause: input }));
    }

    await this.files.writeCache(this.pathToTweet(tweet), tweet);
    return Promise.resolve(tweet);
  }

  async cacheTweetMedia(tweet: TwitterPost, archive?: TwitterArchive) {
    // We want to take in a Tweet and cache its media elements.
  }

  protected async _lookupTweet(id: string) {
    // This wraps the different approaches we take to grabbing tweet data:
    // hitting the oEmbed endpoint? Firing up headless chrome and scraping?
    // Taking a screenshot? etc.
    
    if (this.options.lookupAltText) {
      // This returns a TweetCaptureResult record
      return await this.browser.capture(id, false);
    } else if (this.options.lookupAltText) {
      // This returns a TweetCaptureResult with the `screenshot` property populated
      return this.browser.capture(id, true);
    } else {
      // This returns a TweetOembedData record
      return scrapeTweetOembed(id);
    }
  }
}

export interface PopulateTweetOptions {
  screenshot: boolean | ((...args: unknown[]) => boolean),
}

export function isPartialTweet(input: unknown): input is PartialTweet {
  return is.object(input) && 'id_str' in input && 'text' in input;
}

export function isPartialFavorite(input: unknown): input is PartialFavorite {
  return is.object(input) && 'tweetId' in input && 'fullText' in input;
}

export function isPartialMedia(input: unknown): input is PartialTweetMediaEntity {
  return is.object(input) && 'media_url_https' in input;
}
