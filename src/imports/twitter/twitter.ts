import { PartialFavorite, PartialTweet, TwitterArchive } from "twitter-archive-reader";
import { BaseImport, BaseImportOptions } from '../../index.js';
import { TwitterAnalyticsRow, TwitterAnalyticsSet } from "./types.js";
import { parseString } from '@fast-csv/parse';
import { camelCase } from "../../index.js";
import { parseISO, max as maxDate, min as minDate, format as formatDate } from 'date-fns';

export type TwitterFavorite = {
  id: string,
  url?: string,
  user?: string,
  created?: string,
  text?: string,
  favorited?: string,
};

export interface TwitterImportOptions extends BaseImportOptions {
  parseMultipleArchives: boolean,
}

export class Twitter extends BaseImport {
  collections = {
    twitter_post: {},
    twitter_favorite: {},
    twitter_media: {}
  }

  async doImport(): Promise<void> {
    await this.loadCache();
    return Promise.resolve();
  }

  async fillCache(): Promise<void> {
    await this.fillAnalyticsCache();
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
   *    from a later archive but exist in an older one.
   *
   * @returns {Promise<void>}
   */
  async fillTweetCache(): Promise<void> {
    const archives = await this.files.findInput('**/twitter-*.zip');
    for (const arc of archives) {
      await this.fillCacheFromArchive(arc);
    }
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

    for (const file of analytics) {
      const [username, locale] = file.match(/daily_tweet_activity_metrics_(.+)_\d{8}_\d{8}_(\w+).csv/)?.slice(1) ?? [];
      allData[username] ??= { username, start: undefined, end: undefined, locale, rows: [] };
      
      // ridic. inefficient, but it works for now
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
      await this.files.writeCache(`${user}/analytics.json`, analytics);
      this.log(`Cached ${user} analytics (${data.rows.length} records)`);
    }
    return Promise.resolve();
  }

  async fillCacheFromArchive(path: string): Promise<void> {
    const buffer = this.files.readInput(path, { parse: false });

    const archive = new TwitterArchive(buffer, {
      ignore: ['ad', 'block', 'dm', 'moment', 'mute']
    });

    await archive.ready().then(() => {
      archive.releaseZip();
      return archive;
    });

    this.log(`Processing ${path}`);
    this.log(archive.info);
    this.log(archive.synthetic_info);
    
    await this.prepUser(archive);

    // for (const t of archive.tweets.sortedIterator('asc')) {
    //   await this.cacheTweet(t, archive);
    // }
  }

  protected async prepUser(a: TwitterArchive): Promise<void> {
    this.log('caching user');
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

  async saveFavorites(archive: TwitterArchive) {
    for (const raw of archive.favorites.all) {
      const fav: TwitterFavorite = {
        id: raw.tweetId,
        text: raw.fullText,
        url: raw.expandedUrl,
        favorited: raw.date?.toISOString()
      };
      await this.db.push(fav, `twitter_favorite/${fav.id}`);
    }
    return Promise.resolve();
  }
  
  async saveBookmarks(archive: TwitterArchive) {
    return Promise.resolve();
  }

  async saveMedia(archive: TwitterArchive) {
    return Promise.resolve();
  }
}
