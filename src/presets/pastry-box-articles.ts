import { Dates, Disk, Html, Markdown, Text } from 'mangler';

const input = '/Volumes/archives/Backup/great-migration/input/pastry-box-all-articles.html';
const output = Disk.dir('/Volumes/archives/Backup/great-migration/output/pastry-box');

const markup = Disk.read(input, 'utf8') ?? '';
const articles = (await Html.extract(markup, [{
  $: 'div.thought-content',
  date: 'p.thought-nicedate', // Monday, 27 October 2014
  url: 'p.thought-nicedate a | attr:href',
  title: 'div.thought-title', // Optional
  body: 'div.thought-body | html'
}])) as Record<string, string | undefined>[];

const files = articles.map(a => {
  return {
    data: {
      date: Dates.parse(a.date ?? '', 'EEEE, dd MMMM yyyy', new Date()).toISOString().split('T')[0],
      title: a.title ?? a.date ?? '',
      from: 'pastrybox',
      fromUrl: a.url,
    },
    content: Markdown.fromHtml(a.body ?? '')
  }
});

for (const f of files) {
  output.write(Text.toSlug(f.data.title) + '.md', f);
  console.log('Exported ' + f.data.title);
}
