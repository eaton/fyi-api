import { BaseImport } from '../../index.js';
import { decode } from 'entities';
import path from 'path';
import { Html, Livejournal as LjMarkup, Markdown, Text } from 'mangler';

type LivejournalEntry = {
  itemid: number;
  eventtime: string;
  subject?: string;
  summary?: string;
  event: string;
  cut?: string;
  uncut?: string;
  current_music?: string;
  current_mood?: string;
  backdated?: boolean;
  unpublished?: boolean;
  avatar?: string;
};

type LivejournalComment = {
  itemid: number;
  parent_itemid?: number;
  entry_itemid: number;
  eventtime: string;
  event: string;
  author?: {
    name: string;
    email: string;
  };
};

type LjCacheData = {
  entries: LivejournalEntry[],
  comments: LivejournalComment[],
}

export class Livejournal extends BaseImport<LjCacheData> {
  collections = ['lj_entry', 'lj_comment'];

  async doImport(): Promise<void> {
    await this.ensureSchema();
    await this.loadCache();

    for (const ent of this.cacheData?.entries ?? []) {
      const entryDate = ent.eventtime.split('T')[0];

      const extra: Record<string, string | number> = {
        platform: 'livejournal',
        id: ent.itemid
      };
      if (ent.current_mood) extra.mood = ent.current_mood;
      if (ent.current_music) extra.music = ent.current_music;
      if (ent.avatar) extra.avatar = ent.avatar;

      const com = (this.cacheData?.comments.filter(c => c.entry_itemid === ent.itemid) ?? []).length;
      if (com > 0) extra.comments = com;
      
      const data = {
        title: ent.subject ? ent.subject : entryDate,
        slug: Text.toSlug(ent.subject ? ent.subject : entryDate),
        date: ent.eventtime,
        publisher: 'livejournal',
        extra,
      };

      const filename = entryDate + '-' + Text.toSlug(ent.subject ? ent.subject : 'untitled') + '.md';
      const content = Markdown.fromHtml(
        Html.fromText(ent.event, { entities: false, urls: false, paragraphs: true })
      ).replaceAll('\\*', '*').replaceAll('\\_', '_');

      if (ent.backdated) {
        data.publisher = 'txt';
        data.extra = {};
        const textfiles = this.output.dir('../textfiles');
        console.log(textfiles.path(filename));
        textfiles.write(filename, { content, data });
      } else {
        console.log(this.output.path(filename));
        this.output.write(filename, { content, data });
      }
    }

    return Promise.resolve();
  }

  async loadCache() {
    this.cacheData ??= {
      entries: [],
      comments: []
    }

    for (const file of this.cache.find({ matching: 'entries/*.json' })) {
      const entry = this.cache.read(file, 'auto') as LivejournalEntry;
      this.cacheData.entries.push(entry);
    }

    for (const file of this.cache.find({ matching: 'comments/*.json' })) {
      const comment = this.cache.read(file, 'auto') as LivejournalComment;
      this.cacheData.comments.push(comment);
    }

    if (this.cacheData.entries.length === 0 && this.cacheData.entries.length === 0) {
      return this.fillCache();
    }
    
    return Promise.resolve(this.cacheData);
  }

  async fillCache() {
    this.cacheData ??= {
      entries: [],
      comments: []
    }
    await this.parseXmlFiles();
    await this.parseSemagicFiles();
    return Promise.resolve(this.cacheData);
  }

  /**
   * The files supported by this importer were generated by the venerable old "ljarchive"
   * windows app; it spits out one XML file per year, and includes the comments that were
   * posted in reply to each entry.
   *
   * There are some downsides. LJArchive, at least at the time I used it, didn't support
   * restricted posts — so anything posted to a subset of friends was lost. In addition,
   * it ignored the 'avatar' metadata attached to each post that controlled which user
   * picture should be displayed. Of all the data loss, that's what tears me up the most.
   *
   * Also, any Livejournal polls that were posted as part of an entry are lost: there's
   * just a vestigial `<lj-poll>` element in the markup pointing to a long-dead ID. Alas.
   */
  async parseXmlFiles() {
    const xmlFiles = await this.input.findAsync({ matching: '*.xml' });

    for (const path of xmlFiles) {
      const $ = await this.input
        .readAsync(path)
        .then((data) => Html.toCheerio(data ?? '', { xmlMode: true }));

      this.cacheData ??= {
        entries: [],
        comments: []
      }

      // Currently hard-coded for my own purposes. Blah.
      const firstPostDate = new Date('2001-06-04T21:45:00');

      $('entry')
        .toArray()
        .forEach((rawEntry) => {
          const entry: LivejournalEntry = {
            itemid: Number.parseInt($('itemid', rawEntry).first().text()),
            eventtime: new Date(
              $('eventtime', rawEntry).first().text().replace(' ', 'T')
            ).toISOString(),
            subject: $(rawEntry).find('subject').text() ?? undefined,
            event: decode($('event', rawEntry).first().html() ?? ''),
            current_music: $('current_music', rawEntry).text() ?? undefined,
            current_mood: $('current_mood', rawEntry).text() ?? undefined
          };
          entry.backdated = new Date(entry.eventtime) < firstPostDate;

          const processed = LjMarkup.userToLink(entry.event);
          entry.cut = LjMarkup.cutTeaser(processed);
          entry.event = LjMarkup.cutBody(processed);
          if (entry.cut === entry.event) delete entry.cut;

          this.cacheData?.entries.push(entry);

          $(rawEntry)
            .find('comment')
            .toArray()
            .forEach((rawComment) => {
              const comment: LivejournalComment = {
                itemid: Number.parseInt($(rawComment).find('itemid').text()),
                entry_itemid: entry.itemid,
                parent_itemid: Number.parseInt(
                  $(rawComment).find('parent_itemid').text() ?? ''
                ),
                eventtime: new Date(
                  $(rawComment).find('eventtime').text().replace(' ', 'T')
                ).toISOString(),
                event: LjMarkup.userToLink(
                  $(rawComment).find('event').html() ?? ''
                ),
                author: {
                  name: $(rawComment).find('author name').text() ?? undefined,
                  email: $(rawComment).find('author email').text() ?? undefined
                }
              };
              this.cacheData?.comments.push(comment);
            });
        });

      for (const entry of this.cacheData?.entries ?? []) {
        this.cache.write(`entries/${entry.itemid}.json`, entry);
      }
      for (const comment of this.cacheData?.comments ?? []) {
        this.cache.write(`comments/${comment.itemid}.json`, comment);
      }

      this.log(
        `${this.cacheData?.entries?.length ?? 0} entries with ${this.cacheData?.comments?.length ?? 0} comments found in ${path}.`
      );
    }

    return Promise.resolve();
  }

  /**
   * Semagic, a popular Windows desktop Livejournal client, could be configured
   * to save each entry to a local file in addition to posting it on Livejournal.
   *
   * Unfortunately .slj files are kind of an abomination, and the format is AFAICT
   * undocumented. This does some unholy dart-throwing to pull out the post title,
   * body, mood, music, and user picture. It relies on the file's own timestamp
   * to generate the entry date; that information might be in the file format
   * somewhere, but I only have like 20 of these files so this is good enough.
   */
  async parseSemagicFiles() {
    this.cacheData ??= {
      entries: [],
      comments: []
    }

    let tempFiles = await this.input.findAsync({ matching: '*.slj' });
    const entries: LivejournalEntry[] = [];

    for (const file of tempFiles) {
      const tempId = Number.parseInt(
        path.parse(file).name.replace('predicate.predicate.', '')
      );
      const tempDate = this.input.inspect(file, { times: true })?.birthTime?.toISOString();

      entries.push(
        await this.populateFromSljBuffer(
          {
            itemid: tempId,
            eventtime: tempDate
          },
          file
        )
      );
    }

    const toExport = entries.filter((e) => e.itemid > 0);
    for (const entry of toExport) {
      this.cacheData.entries.push(entry);
      this.cache.write(`entries/${entry.itemid}.json`, entry);
    }
    this.log(`${toExport.length} entries found in in .slj files.`);

    return Promise.resolve();
  }

  async populateFromSljBuffer(
    entry: Partial<LivejournalEntry>,
    path: string
  ): Promise<LivejournalEntry> {
    const data = await this.input.readAsync(path, "buffer") ?? "";
    const text = data.toString('utf16le');

    return Promise.resolve({
      ...entry,
      ...this.parseSemagicFile(text)
    } as LivejournalEntry);
  }

  parseSemagicFile(data: string): Partial<LivejournalEntry> {
    const entry: Partial<LivejournalEntry> = {};
    const segments = data
      .split(/[\u00FF-\uFFFF\u0A7D\u04D4\x00\x80°]+/)
      .map((t) => t.replaceAll(/[\x01-\x19]+/g, ''));

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

    return entry;
  }
}
