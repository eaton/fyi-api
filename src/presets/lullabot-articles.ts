import { finished } from 'stream/promises';
import { Readable } from "stream";
import { ReadableStream } from "stream/web";
import { ArticleScraper } from "../index.js";
import { Dates, Html, Markdown } from 'mangler';
import path from 'path';

const lb = new ArticleScraper({
  importName: 'lullabot',
  files: { base: '/Volumes/archives/Backup/great-migration' },
  template: {
    url: 'head link[rel=canonical] | attr:href',
    title: 'article.node div.hero-article h1',
    date: 'article.node div.hero-article__date',
    summary: 'article.node div.hero-article__description',
    body: 'article.node div.node-article__content div.text-long | html',
    tags: 'article.node div.node-article__content div.tags-with-label a.link | text | split:,',
  }
});

const cache = await lb.loadCache();
for (const [url, article] of cache.entries()) {
  if (!article || article.error) continue;

  if (article.tags && article.tags.length === 1) {
    // post-process borked tags
    article.tags = article.tags[0].replaceAll(/\s{2,}/g, '\t').split('\t');
  }
  if (article.body) {
    // Download images
    const images: string[] = [];
    const $ = Html.toCheerio(article.body);
    $('picture source').remove();
    $('img').each((idx, el) => {
      images.push(el.attribs['src']);
    });

    article.body = $.html();

    for (const img of images) {
      await downloadImage(img)
        .then(path => article.body = article.body?.replaceAll(img, path))
        .catch(err => console.log(err))
    }

    const md = {
      data: {
        date: Dates.parse(article.date ?? '', 'MMMM d, yyyy', Date.now()).toISOString(),
        title: article.title,
        summary: article.summary ?? '',
        from: 'lullabot',
        fromUrl: article.url,
        tags: article.tags ?? [],
      },
      content: Markdown.fromHtml(article.body)
    }

    lb.output.write(url.split('/').pop() + '.md', md);
  }
}

export async function downloadImage(url: string): Promise<string> {
  const foundUrl = new URL(url, 'https://www.lullabot.com');
  foundUrl.search = '';
  foundUrl.pathname = foundUrl.pathname.replaceAll(
    /\/sites\/default\/files\/styles\/[a-zA-Z0-9-_]+\/public\//g,
    '/sites/default/files/'
  );
  if (foundUrl.pathname.endsWith('.webp')) {
    foundUrl.pathname = foundUrl.pathname.replace('.webp', '');
  }

  const p = 'images/lullabot/' + path.parse(foundUrl.pathname).base;
  if (lb.output.exists(p)) return Promise.resolve(p);
   
  const resp = await fetch(foundUrl);
  if (resp.ok && resp.body) {
    lb.output.file(p);
    const stream = lb.output.createWriteStream(p, { autoClose: true });
    const body = resp.body as ReadableStream<any>;
    return finished(Readable.fromWeb(body).pipe(stream)).then(() => p);
  } else {
    return Promise.reject();
  }
}
