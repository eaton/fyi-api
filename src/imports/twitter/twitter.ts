import { TwitterArchive } from "twitter-archive-reader";
import { BaseImport, BaseImportOptions } from '../../index.js';
// import { TwitterAnalyticsRow, TwitterAnalyticsSet } from "./types.js";

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
    const archive = await this.loadTwitterArchive('input/twitter.zip');
  
    await this.saveTweets(archive);
    await this.saveFavorites(archive);  

    return Promise.resolve();
  }

  async fillCache(): Promise<void> {
    const archives = await this.files.findInput('**/twitter-*.zip');
    for (const arc of archives) {
      this.log(`Found ${arc}`);
    }
  }
  
  async loadAnalyticsExports() {
    const analytics = await this.files.findInput('**/daily_tweet_activity_metrics_*.csv');
    
    for (const csv of analytics) {
      // const [base, user, start, end, locale] = csv.match(/daily_tweet_activity_metrics_(.+)_(\d{8})_(\d{8})_(\w+).csv/) ?? [];
      this.log(`Found ${csv}`);
    }
  }

  async loadTwitterArchive(path = 'twitter.zip') {
    const archive = new TwitterArchive(path);
    return archive.ready()
      .then(() => {
        archive.releaseZip();
        return archive;
      });
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
