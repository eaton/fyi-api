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
  onlyLatestArchive: boolean,
}

export class Twitter extends BaseImport {
  collections = {
    twitter_post: {},
    twitter_favorite: {},
    twitter_media: {}
  }

  async doImport(): Promise<void> {
    await this.ensureSchema();
    await this.loadCache();
    return Promise.resolve();
  }

  async fillCache(): Promise<void> {
    const analytics = await this.parseAnalyticsExports();
    for (const [user, data] of Object.entries(analytics)) {
      const analyticsCacheFile = await this.files.writeCache(`${user}/analytics.json`, analytics);
      this.log(`Cached ${analyticsCacheFile} with ${data.rows.length} records`);
    }

    return Promise.resolve();

    const archives = await this.files.findInput('**/twitter-*.zip');
    for (const arc of archives) {
      await this.fillCacheFromArchive(arc);
    }
  }
  
  async parseAnalyticsExports() {
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
    return Promise.resolve(allData);
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
    
    await this.cacheUser(archive);

    // for (const t of archive.tweets.sortedIterator('asc')) {
    //   await this.cacheTweet(t, archive);
    // }
  }

  protected async cacheUser(a: TwitterArchive): Promise<void> {
    this.log('caching user');
    return Promise.resolve();
  }

  protected async cacheTweet(t: PartialTweet, a: TwitterArchive): Promise<void> {
    return Promise.resolve();
  }

  protected async cacheMedia(f: PartialFavorite, a: TwitterArchive): Promise<void> {
    return Promise.resolve();
  }

  protected async cacheFavorite(f: PartialFavorite, a: TwitterArchive): Promise<void> {
    return Promise.resolve();
  }

  protected pathToTweet(t: PartialTweet): string {
    return t.id_str;
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
