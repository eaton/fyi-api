import { Disk, Text, Markdown, Html } from 'mangler';
import * as ss from 'superstruct';

const NodeSchema = ss.object({
  nid: ss.integer(),
  type: ss.string(),
  title: ss.string(),
  uid: ss.integer(),
  status: ss.integer(),
  date: ss.string(),
  body: ss.string(),
  format: ss.string(),
  fields: ss.optional(ss.object({
    link: ss.optional(ss.array(ss.object({ url: ss.string() }))),
    upload: ss.optional(ss.array(ss.object({
      fid: ss.integer(),
      description: ss.string(),
    }))),
    product: ss.optional(ss.array(ss.object({ asin: ss.string() }))),
    money_quote: ss.optional(ss.array(ss.object({ value: ss.string() }))),
  }))
});

const cache = Disk.dir('/Volumes/archives/Backup/great-migration/cache/2007-goddy');
const output = Disk.dir('/Volumes/archives/Backup/great-migration/output/2007-goddy');
const posts = cache.find({ matching: 'nodes/node-{review,blog}-*.json' });

for (const file of posts) {
  const data = cache.read(file, 'auto');
  const node = NodeSchema.mask(data);
  if (node) {
    if (node.uid !== 2) continue;

    let content = Html.fromText(node.body, { entities: false, urls: false });

    const data: Record<string, unknown> = {
      title: node.title,
      slug: Text.toSlug(node.title),
      date: node.date,
      publisher: 'growing-up-goddy',
      drupal: {
        type: node.type,
        nid: node.nid,
        format: node.format,
        status: node.status
      }
    };

    if (node.fields?.link) {
      data.link = node.fields.link[0].url;
    }
    if (node.fields?.product) {
      data.asin = node.fields.product[0].asin;
    }
    if (node.fields?.money_quote) {
      content = `<blockquote>${node.fields?.money_quote[0].value}</blockquote>\n\n${content}`;
    }

    const filename = node.date.split('T')[0] + '-' + data.slug + '.md';
    console.log(filename);
    output.write(filename, { data, content: Markdown.fromHtml(content) });
  }
}