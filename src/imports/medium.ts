import gpkg from 'fast-glob';
const { async: glob } = gpkg;

import fpkg from 'fs-extra';
const { readFileSync } = fpkg;

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
  is_reply?: boolean,
}

export class Medium extends Import {
  collections = {
    medium_post: {}
  };

  async doImport(): Promise<string[]> {
    await this.ensureSchema();
    const posts = await this.parseHtmlFiles();
    for (const post of posts) {
      if (post.is_reply === false) {
        await this.db.push(post, `medium_post/${post.id}`);
      }
    }
    return Promise.resolve([`${posts.length} archived Medium posts were imported.`]);
  }

  async parseHtmlFiles() {
    const htmlFiles = await glob('raw/medium/posts/!(draft_)*.html');
  
    const posts: MediumPost[] = [];
  
    for (const path of htmlFiles) {
      const file = readFileSync(path);
      const $ = cheerio.load(file);
  
      const post = {
        id: $('footer a.p-canonical').attr('href')?.split('-').pop() ?? '',
        title: $('h1.p-name').text().trim(),
        href: $('footer a.p-canonical').attr('href') ?? '',
        published: $('footer time.dt-published').attr('datetime') ?? '',
        hero_image: $('section.section--first div.section-content figure.graf--leading img.graf-image').attr('src') ?? undefined,
        summary: $('section.p-summary').html()?.trim() ?? undefined,
        body: $('section.e-content').html()?.trim() ?? '',
        is_reply: false,
      }
      
      posts.forEach(p => {
        p.body = p.body.replaceAll('&nbsp;', ' ');
        p.title = p.title.replaceAll('&nbsp;', ' ');
        p.summary = p.summary?.replaceAll('&nbsp;', ' ');
      });
  
      // Filter out known 'reply' posts
      if (![
        '304e884c472a',
        '72b96f8b173',
        'f6c635e1b48d',
        '8d5e3f5fea18',
        '481b9dce4ddb',
        '45793efa4872',
        '4c5ada5c779a'
      ].includes(post.id)) posts.push(post);
    }
  
    return Promise.resolve(posts);
  }
}

