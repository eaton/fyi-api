import { TwitterArchive } from "twitter-archive-reader";
import { Database } from '../index.js';

await doImport();

export type TwitterFavorite = {
  id: string,
  url?: string,
  user?: string,
  created?: string,
  text?: string,
  favorited?: string,
};

export async function doImport() {
  const db = await Database.setup();
  await db.ensure('twitter_post').then(() => db.empty('twitter_post'));
  await db.ensure('twitter_favorite').then(() => db.empty('twitter_favorite'));

  const archive = await loadTwitterArchive('raw/twitter.zip');
  console.log('Loaded...');

  await saveTweets(db, archive);
  await saveFavorites(db, archive);
}

export async function saveTweets(db: Database, archive: TwitterArchive) {
  for (const pt of archive.tweets.sortedIterator('asc')) {
    await db.collection('twitter_post').save({
      _key: pt.id_str,
      ...pt
    });
  }
  return Promise.resolve();
}

export async function saveMedia(db: Database, archive: TwitterArchive) {
  return Promise.resolve();
}

export async function saveFavorites(db: Database, archive: TwitterArchive) {
  for (const raw of archive.favorites.all) {
    const fav: TwitterFavorite = {
      id: raw.tweetId,
      text: raw.fullText,
      url: raw.expandedUrl,
      favorited: raw.date?.toISOString()
    };
    await db.collection('twitter_favorite').save({
      _key: fav.id,
      ...fav
    });
  }
  return Promise.resolve();
}

export async function saveBookmarks(db: Database, archive: TwitterArchive) {
  return Promise.resolve();
}

export async function loadTwitterArchive(path = 'twitter.zip') {
  const archive = new TwitterArchive(path);
  return archive.ready()
    .then(() => {
      archive.releaseZip();
      return archive;
    });
}
