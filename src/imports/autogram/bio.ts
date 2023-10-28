import { GrayMatterFile } from "gray-matter";

export type BioFrontmatter = {
  [index: string]: unknown,
  title?: string,
  slug?: string,
  description?: string,
  headshot?: string,
  email?: string,
  homepage?: string,
  pronouns?: {
    personal?: string,
    object?: string,
    possessive?: string,
    'independent-possessive'?: string,
    reflexive?: string,
  },
  social?: {
    [index: string]: unknown,
    twitter?: string,
    pinboard?: string,
    linkedin?: string,
  }
}

export function sanitizeBio(matter: GrayMatterFile<Buffer>) {
  const data = matter.data as BioFrontmatter;
  return {
    _type: 'person',
    _id: `person-${data.slug}`,
    title: data.title,
    firstName: data.title?.split(' ').shift(),
    slug: { _type: 'slug', current: data.slug },
    role: 'partner',
    teaser: data.description,
    pronouns: {
      _type: 'pronouns',
      independentPossessive: data.pronouns?.['independent-possessive'],
      object: data.pronouns?.object,
      personal: data.pronouns?.personal,
      possessive: data.pronouns?.possessive,
      reflexive: data.pronouns?.reflexive,
    }
    // Handle the body
  }
}