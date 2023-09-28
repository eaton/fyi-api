import gpkg from 'fast-glob';
const { async: glob } = gpkg;

import fpkg from 'fs-extra';
const { readFileSync, statSync } = fpkg;

import * as cheerio from 'cheerio';

import { Database } from '../index.js';

import { decode } from 'entities';

await doImport();

type LivejournalEntry = {
  itemid: string,
  eventtime: string,
  subject?: string,
  event: string,
  allowmask: number,
  current_music?: string,
  mood?: string,
  raw?: string
}

type LivejournalComment = {
  itemid: string,
  parent_itemid?: string,
  entry_itemid: string,
  eventtime: string,
  event: string
  author?: {
    name: string,
    email: string
  }
}

export async function doImport() {
  const db = await Database.setup();
  await db.ensure('lj_entry').then(() => db.empty('lj_entry'));
  await db.ensure('lj_comment').then(() => db.empty('lj_comment'));

  const stuff = await parseXmlFiles();
  for (const entry of stuff.entries) {
    await saveLivejournalEntry(entry, db);
  }

  for (const comment of stuff.comments) {
    await saveLivejournalComment(comment, db);
  }  
}

export async function saveLivejournalEntry(data: LivejournalEntry, db: Database) {
  console.log(`Entry ${data.itemid}: ${data.subject}`);
  return db.collection('lj_entry').save({
    _key: data.itemid.toString(),
    ...data
  })
}

export async function saveLivejournalComment(data: LivejournalComment, db: Database) {
  console.log(`   Comment ${data.itemid}`);
  return db.collection('lj_comment').save({
    _key: data.itemid.toString(),
    ...data
  });
}

export async function parseXmlFiles() {
  const xmlFiles = await glob('raw/livejournal/*.xml');

  const entries: LivejournalEntry[] = [];
  const comments: LivejournalComment[] = [];

  for (const path of xmlFiles) {
    const file = readFileSync(path);
    const $ = cheerio.load(file, { xmlMode: true });

    $('entry')
      .toArray()
      .forEach(rawEntry => {
        const entry = {
          itemid: $(rawEntry).find('itemid').first().text(),
          eventtime: new Date($(rawEntry).find('eventtime').first().text()).toISOString(),
          subject: $(rawEntry).find('subject').text() ?? undefined,
          event: decode($(rawEntry).find('event').first().html() ?? ''),
          allowmask: Number.parseInt($(rawEntry).find('allowmask').text()),
          current_music: $(rawEntry).find('current_music').text() ?? undefined,
          current_mood: $(rawEntry).find('current_mood').text() ?? undefined,
          raw: '<entry>' + $(rawEntry).html() + '</entry>' ?? undefined, // Oh look, a hack
        };
        entries.push(entry);

        $(rawEntry).find('comment')
          .toArray()
          .forEach(rawComment => {
            const comment = {
              itemid: $(rawComment).find('itemid').text(),
              entry_itemid: entry.itemid,
              parent_itemid: $(rawComment).find('parent_itemid').text(),
              eventtime: new Date($(rawComment).find('eventtime').text()).toISOString(),
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

export async function parseTempFiles() {
  const tempFiles = await glob('raw/livejournal/*.slj');

  for (const path of tempFiles.slice(0,1)) {
    const tempId = path.replace('raw/livejournal/predicate.predicate.', '').replace('.slj', '-draft');
    const tempDate = statSync(path).mtime.toISOString();
    
    const entry = populateFromSljBuffer({ itemid: tempId, eventtime: tempDate }, path);

    console.log('---');
    console.log(entry);
  }
}


export function populateFromSljBuffer(entry: Partial<LivejournalEntry>, path: string) {
  const buffer = readFileSync(path);
  let tmp = new Uint8Array();

  buffer.copy(tmp, 0, 118);
  console.log(tmp.toString());
  buffer.copy(tmp, 119);
  console.log(tmp.toString());

  return entry;
}