import { Schema } from '@sanity/schema'
import { ArraySchemaType } from '@sanity/types';
import { htmlToBlocks, normalizeBlock } from '@sanity/block-tools';
import { JSDOM } from 'jsdom';
import { parse } from 'marked';

type Options = {
  markdown?: boolean,
  schema?: ArraySchemaType<unknown>
}

/**
 * Converts HTML or Markdown to Sanity PortableText; this is a relatively
 * naive conversion and shouldn't be treated as The Best Way To Do Things.
 */
export function toPortableText(input: string, options: Options = {}) {
  if (options.markdown) input = parse(input);
  let schema = options.schema ?? getDefaultSchema();

  const blocks = htmlToBlocks(
    input,
    schema,
    { parseHtml: (html) => new JSDOM(html).window.document }
  );
  return blocks.map(b => normalizeBlock(b));
}

type SanityField = Record<string, unknown> & {
  name: string,
  type: ArraySchemaType<unknown>,
}

export function simpleStyledTextSchema() {
  const def = {
    name: 'schema',
    types: [
      {
        type: 'object',
        name: 'content',
        fields: [
          {
            title: 'Body',
            name: 'body',
            type: 'array',
            of: [{
              type: 'block',
              styles: [{ title: 'Normal', value: 'normal' }],
              lists: [],
              marks: { decorators: [ { title: 'Strong', value: 'strong' }, { title: 'Emphasis', value: 'em' }] }
            }],
          },
        ],
      },
    ],
  };

  const fields = Schema.compile(def).get('content').fields as SanityField[];
  const schema = fields.find((field) => field.name === 'body')?.type;
  if (!schema) throw new Error('Could not compile schema');
  return schema;
}

function getDefaultSchema() {
  const def = {
    name: 'styled',
    types: [
      {
        type: 'object',
        name: 'content',
        fields: [
          {
            title: 'Body',
            name: 'body',
            type: 'array',
            of: [{ type: 'block' }],
          },
        ],
      },
    ],
  };
  const fields = Schema.compile(def).get('content').fields as SanityField[];
  const schema = fields.find((field) => field.name === 'body')?.type;
  if (!schema) throw new Error('Could not compile schema');
  return schema;
}
