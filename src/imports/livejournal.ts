import gpkg from 'fast-glob';
const { async: glob } = gpkg;

import fpkg from 'fs-extra';
const { readFileSync, statSync } = fpkg;
import * as cheerio from 'cheerio';
import { Import } from '../index.js';
import { decode } from 'entities';

type LivejournalEntry = {
  itemid: number,
  eventtime: string,
  subject?: string,
  event: string,
  current_music?: string,
  current_mood?: string,
  backdated?: boolean,
  unpublished?: boolean,
  avatar?: string,
}

type LivejournalComment = {
  itemid: number,
  parent_itemid?: number,
  entry_itemid: number,
  eventtime: string,
  event: string
  author?: {
    name: string,
    email: string
  }
}

export class Livejournal extends Import {
  collections = ['lj_entry', 'lj_comment'];

  async doImport(): Promise<string[]> {
    await this.ensureSchema();

    const results: string[] = [];
    const stuff = await this.parseXmlFiles();

    results.push(`${stuff.entries.length} entries were found in XML files.`);
    for (const entry of stuff.entries) {
      await this.saveLivejournalEntry(entry);
    }
  
    results.push(`${stuff.comments.length} comments were found in XML files.`);
    for (const comment of stuff.comments) {
      await this.saveLivejournalComment(comment);
    }

    const tmpEntries = await this.parseTempFiles();
    for (const entry of tmpEntries) {
      await this.saveLivejournalEntry(entry);
    }
    results.push(`${tmpEntries.length} entries were found in Semagic files.`);

    return Promise.resolve([]);
  }

  async parseXmlFiles() {
    const xmlFiles = await glob('raw/livejournal/*.xml');
  
    const entries: LivejournalEntry[] = [];
    const comments: LivejournalComment[] = [];
  
    for (const path of xmlFiles) {
      const file = readFileSync(path);
      const $ = cheerio.load(file, { xmlMode: true });

      const firstPostDate = new Date('2001-06-04T21:45:00');

      $('entry')
        .toArray()
        .forEach(rawEntry => {
          const entry: LivejournalEntry = {
            itemid: Number.parseInt($('itemid', rawEntry).first().text()),
            eventtime: new Date($('eventtime', rawEntry).first().text().replace(' ', 'T')).toISOString(),
            subject: $(rawEntry).find('subject').text() ?? undefined,
            event: decode($('event', rawEntry).first().html() ?? ''),
            current_music: $('current_music', rawEntry).text() ?? undefined,
            current_mood: $('current_mood', rawEntry).text() ?? undefined,
          };
          entry.backdated = new Date(entry.eventtime) < firstPostDate;

          entries.push(entry)
  
          $(rawEntry).find('comment')
            .toArray()
            .forEach(rawComment => {
              const comment: LivejournalComment = {
                itemid: Number.parseInt($(rawComment).find('itemid').text()),
                entry_itemid: entry.itemid,
                parent_itemid: Number.parseInt($(rawComment).find('parent_itemid').text() ?? ''),
                eventtime: new Date($(rawComment).find('eventtime').text().replace(' ', 'T')).toISOString(),
                event: $(rawComment).find('event').html() ?? '',
                author: {
                  name: $(rawComment).find('author name').text() ?? undefined,
                  email: $(rawComment).find('author email').text() ?? undefined,
                }
              };
              comments.push(comment);
            });
        });
    }
  
    return Promise.resolve({ entries, comments });
  }
  
  async saveLivejournalEntry(data: LivejournalEntry) {
    return this.db.collection('lj_entry').save({
      _key: data.itemid.toString(),
      ...data
    })
  }
  
  async saveLivejournalComment(data: LivejournalComment) {
    return this.db.collection('lj_comment').save({
      _key: data.itemid.toString(),
      ...data
    });
  }

  async parseTempFiles(offset = 0, limit?: number) {
    let tempFiles = await glob('raw/livejournal/*.slj')
    const entries: LivejournalEntry[] = [];

    for (const path of tempFiles.slice(offset, limit ?? 1000)) {
      const tempId = Number.parseInt(path.replace('raw/livejournal/predicate.predicate.', '').replace('.slj', '-draft'));
      const tempDate = statSync(path).mtime.toISOString();
      
      entries.push(await this.populateFromSljBuffer({
        itemid: tempId,
        eventtime: tempDate
      }, path));
    }

    return Promise.resolve(entries.filter(e => e.itemid > 0));
  }
  
  async populateFromSljBuffer(entry: Partial<LivejournalEntry>, path: string): Promise<LivejournalEntry> {
    let data = readFileSync(path).toString('utf16le');
    
    const segments = data
      .split(/[\u00FF-\uFFFF\u0A7D\u04D4\x00\x80°]+/)
      .map(t => t.replaceAll(/[\x01-\x19]+/g, ''));

    entry.event = segments[4];

    switch (segments.length) {
      case 7:
        entry.current_music = segments[5];
        entry.avatar = segments[6];
        break;
      case 8:
        entry.subject = segments[5];
        if (segments[6].includes('-')) {
          entry.current_music = segments[6];
        } else {
          entry.current_mood = segments[6];
        }
        entry.avatar = segments[7];
        break;
      case 9:
        entry.subject = segments[5];
        entry.current_music = segments[6] ?? undefined;
        entry.current_mood = segments[7] ?? undefined;
        entry.avatar = segments[8] ?? undefined;
        break;
      default:
        entry.itemid = -1;
    }
    
    return Promise.resolve(entry as LivejournalEntry);
  }
}