import * as cheerio from 'cheerio';
import { Import } from '../index.js';

type MediumPost = {
  id: string,
  title: string,
  hero_image?: string,
  href: string,
  summary?: string,
  body: string,
  published: string,
}

export class Medium extends Import {
  collections = {
    medium_post: {}
  };

  async doImport(): Promise<string[]> {
    await this.ensureSchema();
    const posts = await this.parseHtmlFiles();
    for (const post of posts) {
      await this.db.push(post, `medium_post/${post.id}`);
    }
    return Promise.resolve([`${posts.length} archived Medium posts were imported.`]);
  }

  async parseHtmlFiles() {
    const htmlFiles = await this.files.find('raw/medium/posts/!(draft_)*.html');
  
    const posts: MediumPost[] = [];
  
    for (const path of htmlFiles) {
      const file = await this.files.read(path);
      const $ = cheerio.load(file);
  
      const post = {
        id: $('footer a.p-canonical').attr('href')?.split('-').pop() ?? '',
        title: $('h1.p-name').text().trim(),
        href: $('footer a.p-canonical').attr('href') ?? '',
        published: $('footer time.dt-published').attr('datetime') ?? '',
        hero_image: $('section.section--first div.section-content figure.graf--leading img.graf-image').attr('src') ?? undefined,
        summary: $('section.p-summary').html()?.trim() ?? undefined,
        body: $('section.e-content').html()?.trim() ?? '',
      }
      
      posts.forEach(p => {
        p.body = p.body.replaceAll('&nbsp;', ' ').trim();
        p.title = p.title.replaceAll('&nbsp;', ' ').trim();
        p.summary = p.summary?.replaceAll('&nbsp;', ' ').trim();
      });
  
      posts.push(post);
    }
  
    return Promise.resolve(posts);
  }
}

