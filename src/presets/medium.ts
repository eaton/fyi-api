import { encode, decode } from 'entities';
import { Disk, Text } from 'mangler';
import * as ss from 'superstruct';

const MediumSchema = ss.type({
  id: ss.string(),
  title: ss.string(),
  subtitle: ss.optional(ss.string()),
  published_at: ss.optional(ss.string()),
  draft: ss.boolean(),
  content: ss.string(),
  markdown: ss.optional(ss.string()),
  url: ss.optional(ss.string()),
  filename: ss.optional(ss.string()),
  imageUrl: ss.optional(ss.string())
});

const cache = Disk.dir('cache/2013-medium');
const output = Disk.dir('output/2013-medium');
const posts = cache.find({ matching: 'posts/post-*.json' });

for (const file of posts) {
  const data = cache.read(file, 'auto');
  const post = MediumSchema.create(data);
  if (post) {

    const extra: Record<string, unknown> = {
      cms: 'medium',
      id: post.id,
    };
    if (post.imageUrl) extra.image = post.imageUrl;

    const data: Record<string, unknown> = {
      title: post.title,
      slug: Text.toSlug(post.title),
      extra
    };
    if (post.url) data.url = post.url;
    if (post.published_at) data.date = post.published_at;

    let filename = data.slug + '.md';
    if (post.published_at) filename = post.published_at.split('T')[0] + '-' + filename;

    let content = post.markdown ?? post.content;
    content = content.replace(/---\n\n/, '');
    content = decode(encode(content, { mode: 0, level: 1 }), { mode: 0, level: 1 });

    const fileStuff = { data, content };

    output.write(filename, fileStuff);
    console.log(filename);
  }
}