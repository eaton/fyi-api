import { BaseImport } from '../index.js';

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

export class Pinboard extends BaseImport {
  collections = { pinboard_bookmark: {} };

  async doImport(): Promise<string[]> {
    await this.ensureSchema();
  
    const favs = await this.files.read('raw/pinboard.json') as PinboardBookmark[];

    for (const fav of favs) {
      this.db.push({
        _key: fav.hash,
        _collection: 'pinboard_bookmark',
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
  
    return Promise.resolve([`${favs.length} Pinboard bookmarks imported`]);
  }
}
