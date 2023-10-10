import { BaseImport, TweetParsedData, TwitterBrowser, scrapeTweetOembed } from '../index.js';
import { TwitterImportOptions, TwitterAnalyticsRow, TwitterAnalyticsSet, TwitterLookupLevel } from "./types.js";

import { PartialFavorite, PartialTweet, TwitterArchive } from "twitter-archive-reader";
import { parseString } from '@fast-csv/parse';
import { camelCase } from "../../index.js";
import { parseISO, max as maxDate, min as minDate, format as formatDate } from 'date-fns';
import { UrlResolver } from '../../index.js';

export class Twitter extends BaseImport {
  declare options: TwitterImportOptions;

  collections = {
    twitter_post: {},
    twitter_favorite: {},
    twitter_media: {}
  }

  browser: TwitterBrowser;
  resolver: UrlResolver;

  constructor(options: TwitterImportOptions = {}) {
    super(options);
    this.browser = new TwitterBrowser();
    this.resolver = new UrlResolver();
  }

  async doImport(): Promise<void> {
    await this.loadCache();
    return Promise.resolve();
  }

  async fillCache(): Promise<void> {
    if (this.options.metrics) {
      await this.fillAnalyticsCache();
    }
    await this.fillTweetCache()
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
  async fillTweetCache(): Promise<void> {
    // Ensure everything is in chronological order
    let archives = (await this.files.findInput('**/twitter-*.zip')).sort();

    if (this.options.archive === 'newest') {
      archives = archives.slice(0,1);
    } else if (this.options.archive === 'oldest') {
      archives = archives.slice(-1,1);
    }

    for (const archive of archives) {
      await this.cacheArchives(archive);
    }
  }
  
  async loadAnalytics() {
    // Is there analytics stuff? Maybe? Whatevs.
    return this.fillAnalyticsCache();
  }

  async fillAnalyticsCache() {
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
      await this.files.writeCache(`analytics-${user}.json`, data);
      this.log(`Cached ${user} analytics (covering ${data.rows.length} days)`);
    }
    return Promise.resolve();
  }

  /**
   * Our target cache structure looks something like this:
   * 
   * archive-[yyyy-MM-dd].json
   * user-[name].json
   * 
   * singles/[yyyy]/tweet-[tweet-id].json (original non-thread, non-reply tweets)
   * retweets/[yyyy]/retweet-[retweeted-tweet-id].json
   * replies/[yyyy]/reply-[tweet-id].json
   * threads/[yyyy]/thread-[tweet-id].json
   * 
   * media/media-[media-id].json
   * media/files/[media-id].[extension]
   *
   * favorites/[tweet-id].json
   * [save-list]/[tweet-id].json
   * screenshots/[tweet-id].json
   * 
   * It's not exceptionally efficient, but it works.
   */
  async cacheArchives(path: string): Promise<void> {
    const buffer = this.files.readInput(path, { parse: false });
    const archive = new TwitterArchive(
      buffer, { ignore: ['ad', 'block', 'dm', 'moment', 'mute'] }
    );

    await archive.ready().then(() => {
      archive.releaseZip();
    });
    
    await this.files.writeCache(
      `archive-${formatDate(archive.generation_date, 'yyyy-MM-dd')}.json`,
      archive.synthetic_info
    );
    await this.cacheUser(archive);

    if (this.options.singles || this.options.replies || this.options.retweets || this.options.threads) {
      for (const t of archive.tweets.sortedIterator('asc')) {
        if (this.options.singles) {

        }

        if (this.isRetweet(t) && this.options.retweets) {
          // Process a retweet
        }

        if (this.isReply(t) && this.options.replies) {

        }
      }
    } else {
      // No possible scenarios where tweets would be cached. Whoops.
    }

    if (this.options.favorites) {
      await this.cacheFavorites(archive);
    }
  }

  isStandalone(t: PartialTweet): boolean {
    return (t.in_reply_to_status_id_str === undefined && t.retweeted_status === undefined);
  }

  isRetweet(t: PartialTweet): boolean {
    return (t.retweeted_status !== undefined || !!t.retweeted);
  }

  isReply(t: PartialTweet): boolean {
    return (!!t.in_reply_to_status_id_str && t.in_reply_to_user_id_str !== t.user.id_str);
  }
  
  isThreadChild(t: PartialTweet, a: TwitterArchive): boolean  {
    return (!!t.in_reply_to_status_id_str && t.in_reply_to_user_id_str === t.user.id_str);
  }

  isThreadParent(t: PartialTweet, a: TwitterArchive): boolean  {
    // This will be expensive.
    return false;
  }

  protected async cacheUser(a: TwitterArchive): Promise<void> {
    await this.files.writeCache(`user-${a.user.screen_name}.json`, a.user);
    return Promise.resolve();
  }

  protected async prepTweet(t: PartialTweet, a: TwitterArchive): Promise<void> {
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

  protected async prepFavorite(f: PartialFavorite, a: TwitterArchive): Promise<void> {
    return Promise.resolve();
  }

  protected pathToTweet(t: PartialTweet): string {
    return `${t.user.name}/${t.created_at_d?.getFullYear ?? '0000'}/tweet/${t.id_str}.json`;
  }


  async saveTweets(archive: TwitterArchive) {
    for (const pt of archive.tweets.sortedIterator('asc')) {
      await this.db.push(pt, `twitter_post/${pt.id_str}`);
    }
    return Promise.resolve();
  }

  async cacheFavorites(archive: TwitterArchive) {
    for (const fav of archive.favorites.all) {
      const favPath = `favorites/favorite-${fav.tweetId}.json`;

      if (this.files.existsCache(favPath)) {
        // Be conservative and bail out
        continue;
      }

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
          ...(await this.lookupTweet(fav.tweetId))
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
  
  async saveBookmarks(archive: TwitterArchive) {
    return Promise.resolve();
  }

  async saveMedia(archive: TwitterArchive) {
    return Promise.resolve();
  }

  async loadBookmarks() {
    await this.cacheBookmarks();
  }

  async cacheBookmarks() {
    const files = await this.files.findInput('*bookmarks.txt');
    const tb = new TwitterBrowser({ headless: false });

    for (const file of files) {
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
            await this.files.writeCache(`screenshots/${json.id}.${screenshotFormat}`, screenshot);
            this.files.writeCache(`bookmarks/${id}.json`, json);
          }
        } else {
          this.files.writeCache(`bookmarks/error-${id}.json`, json);
        }
      }
    }
  }

  async lookupTweet(id: string, level: TwitterLookupLevel = 'metadata') {
    // This wraps the different approaches we take to grabbing tweet data:
    // hitting the oEmbed endpoint? Firing up headless chrome and scraping?
    // Taking a screenshot? etc.
    
    if (level === 'scrape') {
      // This returns a TweetCaptureResult record
      return await this.browser.capture(id, false);
    } else if (level === 'archive') {
      // This returns a TweetCaptureResult with the `screenshot` property populated
      return this.browser.capture(id, true);
    } else {
      // This returns a TweetOembedData record
      return scrapeTweetOembed(id);
    }
  }
}
