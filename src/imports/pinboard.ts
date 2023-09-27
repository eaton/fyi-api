import { getDb } from '../index.js';
import fpkg from 'fs-extra';
const { readJSONSync } = fpkg;

type PinboardBookmark = {
  href: string,
  description?: string,
  extended?: string,
  meta: string,
  hash: string,
  time?: string,
  shared: string,
  toread: string,
  tags?: string
}

await doImport();

export async function doImport() {
  const db = await getDb();
  await db.ensure('pinboard_bookmark').then(() => db.empty('pinboard_bookmark'));

  const favs = readJSONSync('raw/pinboard.json') as PinboardBookmark[];
  for (const fav of favs) {
    await db.collection('pinboard_bookmark').save({
      _key: fav.hash,
      href: fav.href,
      description: fav.description,
      extended: fav.extended,
      meta: fav.meta,
      hash: fav.hash,
      time: fav.time,
      shared: fav.shared == 'yes',
      toread: fav.toread == 'yes',
      tags: fav.tags ? fav.tags.split(' ') : undefined
    })
  }

  return Promise.resolve(favs.length);
}
