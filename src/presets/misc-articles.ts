import path from "path";
import { quickScrape } from "../index.js";
import { Html, Disk, Text, Markdown, download } from "mangler";

export type article = {
  url: string,
  date: Date,
  title: string,
  summary?: string,
  body: string,
  tags?: string[],
}

const pages: Record<string, Html.CheerioExtractTemplate> = {
  "https://alistapart.com/article/battle-for-the-body-field/": {
    url: 'head link[rel=canonical] | attr:href',
    date: 'span.posted-on > time.entry-date | attr:datetime | split:T | shift',
    title: 'header > h1.entry-title',
    body: '#post-15829 > div.entry-content > :not(div) | html',
    tags: 'div.entry-topic > span.cat-links > a[rel="category tag"]'
},
  "https://www.smashingmagazine.com/2013/06/controlling-presentation-in-structured-content/": {
    url: 'head link[rel=canonical] | attr:href',
    date: 'li.article-header--meta-item__date > time | attr:datetime',
    title: '#main-heading',
    summary: 'section.article__summary',
    body: '#article__content > div.c-garfield-the-cat > *:not(div):not(ul):not(h3) | html',
    tags: 'li.meta-box--tags | text | split:,',
  }
} 

const output = Disk.dir('/Volumes/archives/Backup/great-migration/output/articles');

for (const [url, template] of Object.entries(pages)) {
  const results = await quickScrape(url, { template });
  if (results.success) {
    let { body, ...data } = results.data as article;

    const $ = Html.toCheerio(body);
    const images = $('img').toArray().map(el => el.attribs['src']);

    for (const img of images) {
      const u = new URL(img, url);
      u.search = '';
      const imgFile = path.parse(u.href).base;
      const newImg = output.dir('images').path(imgFile);
      await download(u.href, newImg);

      body = body.replaceAll(img, `images/${imgFile}`);
    }

    const fileName = Text.toSlug(data.title) + '.md';
    output.write(fileName, { data, content: Markdown.fromHtml(body) });
  } else { 
    console.log(url, results.error);
  }
}