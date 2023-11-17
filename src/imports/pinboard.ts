import { BaseImport } from '../index.js';

type PinboardBookmark = {
  href: string;
  description?: string;
  extended?: string;
  meta: string;
  hash: string;
  time?: string;
  shared: string;
  toread: string;
  tags?: string;
};

export class Pinboard extends BaseImport {
  collections = ['pinboard_bookmark'];

  async doImport(): Promise<void> {
    await this.ensureSchema();

    const favs = this.input.read('input/pinboard.json', 'auto') as PinboardBookmark[];

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
      });
    }
    this.log(`${favs.length} Pinboard bookmarks imported`);

    return Promise.resolve();
  }
}
