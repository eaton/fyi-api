import { Disk, Text, Markdown, Html } from 'mangler';
import * as ss from 'superstruct';

const MediumSchema = ss.object({
  id: ss.string(),
  title: ss.string(),
  published_at: ss.optional(ss.string()),
  draft: ss.boolean(),
  content: ss.string(),
  url: ss.optional(ss.string()),
  imageUrl: ss.optional(ss.string())
});

const cache = Disk.dir('/Volumes/archives/Backup/great-migration/cache/2013-medium');
const output = Disk.dir('/Volumes/archives/Backup/great-migration/output/2013-medium');
const posts = cache.find({ matching: 'posts/post-*.json' });

for (const file of posts) {
  const data = cache.read(file, 'auto');
  const post = MediumSchema.mask(data);
  if (post) {
    const data: Record<string, unknown> = {
      title: post.title,
      slug: Text.toSlug(post.title),
      date: post.published_at ?? '',
      publisher: 'medium',
      url: post.url ?? ''
    };

    const filename = data.slug + '.md';
    const content = Html.fromText(Markdown.fromHtml(post.content), { entities: 'utf8' , paragraphs: false, urls: false });
    output.write(filename, content);

    //console.log(filename);
    //output.write(filename, { content, data });
  }
}