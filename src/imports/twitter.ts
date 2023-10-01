import { TwitterArchive } from "twitter-archive-reader";
import { Import } from '../index.js';


export type TwitterFavorite = {
  id: string,
  url?: string,
  user?: string,
  created?: string,
  text?: string,
  favorited?: string,
};

export class Twitter extends Import {
  collections = {
    twitter_post: {},
    twitter_favorite: {}
  }

  async doImport(): Promise<string[]> {
    await this.ensureSchema();
    const archive = await this.loadTwitterArchive('raw/twitter.zip');
  
    await this.saveTweets(archive);
    await this.saveFavorites(archive);  

    return Promise.resolve([]);
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
