import { BaseImport, BaseImportOptions, uuid } from "../../index.js";
import matter from 'gray-matter';
import { z } from 'zod';

const partners: Record<string, string> = {
  'jeff': 'e5228665-a06d-4d89-af72-b4fcb92f5d3b',
  'karen': '5f839644-eb0a-475a-9274-d8b551837b26',
  'ethan': 'b983462d-8c63-43ed-9ff3-c189ac6d4d21',
};

export interface AutogramImportOptions extends BaseImportOptions {
  uuids?: Record<string, Record<string, string>>;
}

export interface AutogramImportCache extends Record<string, unknown> {

}

export class AutogramImport extends BaseImport<AutogramImportCache> {
  declare options: AutogramImportOptions;

  constructor(options?: AutogramImportOptions) {
    super(options);
  }

  async fillCache(): Promise<void | AutogramImportCache> {

    const linkFiles = await this.files.findInput('links/*.md');
    for (const file of linkFiles) {
      const raw = await this.files.readInput(file).then(data => matter(data));
      const parsed = parseBookmark(raw);
      await this.files.writeCache(`bookmarks/${parsed.date}-${uuid(parsed)}.json`, parsed)
    }

    const clipFiles = await this.files.findInput('clips/*.md');
    for (const file of clipFiles) {
      const raw = await this.files.readInput(file).then(data => matter(data));
      const parsed = parseAppearance(raw);
      await this.files.writeCache(`appearances/${parsed.date}-${uuid(parsed)}.json`, parsed)
    }

    return Promise.resolve();
  }

  output(): Promise<void | AutogramImportCache> {
    return Promise.resolve();
  }
}

const GreyMatterSchema = z.object({
  content: z.optional(z.string()),
  excerpt: z.optional(z.string()),
});

function parseBookmark(input: unknown) {
  const BookmarkSchema = GreyMatterSchema.extend({
    data: z.object({
      title: z.string(),
      slug: z.optional(z.string()),
      date: z.optional(z.date()),
      type: z.optional(z.string()),
      link: z.optional(z.string().url()),
    }),
  });
  const parsed = BookmarkSchema.parse(input);

  return {
    _type: 'bookmark',
    title: parsed.data.title,
    teaser: ultraTrim(parsed.content),
    date: parsed.data.date?.toISOString().split('T')[0],
    type: parsed.data.type,
    link: parsed.data.link,
  }
}

function parseAppearance(input: unknown) {
  const AppearanceSchema = GreyMatterSchema.extend({
    data: z.object({
      title: z.string(),
      slug: z.optional(z.string()),
      shortTitle: z.optional(z.string()),
      hed: z.optional(z.string()),
      dek: z.optional(z.string()),
      description: z.optional(z.string()),
      date: z.optional(z.date()),
      link: z.optional(z.string().url()),
      type: z.optional(z.string()),
      partners: z.array(z.string()),
      partnerRelationship: z.optional(z.string()),
      venue: z.optional(z.object({
        title: z.string(),
        type: z.string(),
        link: z.optional(z.string().url()),
      }))
    }),
  });
  const parsed = AppearanceSchema.parse(input);

  return {
    _type: 'appearance',
    title: parsed.data.title,
    shortTitle: ultraTrim(parsed.data.shortTitle),
    teaser: ultraTrim(parsed.data.dek ?? parsed.data.description),
    date: parsed.data.date?.toISOString().split('T')[0],
    link: parsed.data.link,
    type: parsed.data.type,
    participants: parsed.data.partners.map(slug => {
      return {
        _type: 'participant',
        person: {
          _ref: partners[slug],
          _type: 'reference'
        },
        role: parsed.data.partnerRelationship
      }
    }),
    venue: parsed.data.venue ? {
      '_type': 'venue',
      ...parsed.data.venue
    } : undefined
  }
}


function ultraTrim(input: string | null | undefined) {
  if (input) return input.trim().length ? input.trim() : undefined;
  return undefined;
}