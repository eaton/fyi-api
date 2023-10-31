import slugify from "@sindresorhus/slugify";
import { BaseImport, BaseImportOptions, uuid } from "../../index.js";
import { sanitizeBio } from "./bio.js";
import matter, { GrayMatterFile } from 'gray-matter';

export interface AutogramImportOptions extends BaseImportOptions {

}

export interface AutogramImportCache extends Record<string, unknown> {

}

export class AutogramImport extends BaseImport<AutogramImportCache> {
  declare options: AutogramImportOptions;

  constructor(options?: AutogramImportOptions) {
    super(options);
  }

  async fillCache(): Promise<void | AutogramImportCache> {

    const bioFiles = await this.files.findInput('bios/*.md');
    for (const file of bioFiles) {
      const newEntity = await this.files.readInput(file)
        .then(data => matter(data))
        .then(matter => sanitizeBio(matter));
      await this.files.writeCache(makeFileName(newEntity), newEntity);
    }

    const linkFiles = await this.files.findInput('links/*.md');
    for (const file of linkFiles) {
      const newEntity = await this.files.readInput(file)
        .then(data => matter(data))
        .then(matter => sanitizeBookmark(matter));

      await this.files.writeCache(makeFileName(newEntity), newEntity);
    }

    return Promise.resolve();
  }

  output(): Promise<void | AutogramImportCache> {
    return Promise.resolve();
  }
}

function makeFileName(entity: Record<string, unknown>) {
  return entity?._type + '/' + uuid(entity) + '-' + slugify(entity.title as string) + '.json';
}

export function sanitizeBookmark(matter: GrayMatterFile<Buffer>) {
  return {
    _type: 'bookmark',
    title: matter.data.title,
    teaser: matter.content.trim(),
    date: matter.data.date,
    link: matter.data.link
  }
}

export function sanitizeAppearance(matter: GrayMatterFile<Buffer>) {
  const partners: string[] = Array.isArray(matter.data?.partners) ? matter.data?.partners : [];
  return {
    _type: 'appearance',
    title: matter.data.title,
    shortTitle: matter.data.shortTitle,
    teaser: matter.data.dek ?? matter.data.description,
    date: matter.data.date,
    link: matter.data.link,
    type: matter.data.type,
    topics: [],
    participants: partners.map(slug => {
      return {
        _type: 'participant',
        person: {
          _ref: `person-${slug}`,
          _type: 'reference'
        },
        role: matter.data.partnerRelationship
      }
    }),
    venue: {
      '_type': 'venue',
      ...(matter.data.venue ?? {})
    }
  }
}