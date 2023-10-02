// import * as cheerio from 'cheerio';
import { BaseImport } from '../index.js';
import { cheerioParse } from '../util/cheerio-parse.js';

export type MediumPost = {
  id: string,
  title: string,
  hero_image?: string,
  href: string,
  summary?: string,
  content: string,
  published: string,
}

export type MediumUserInfo = {
  id?: string,
  twitter_username?: string,
  bio?: string,
  top_writer_in?: string[],
  is_suspended:false,
  username: string,
  fullname: string,
  medium_member_at: string,
  following_count: number,
  followers_count: number,
  is_writer_program_enrolled: boolean
  allow_notes: boolean,
  image_url: string,
  articles: string[],
}

export type MediumArticle = {
  id: string,
  filename: string,
  url: string,
  author: {
    url: string,
    fullname: string,
  },
  title: string,
  subtitle: string,
  published_at: string,
  draft: boolean,
  tags: string[],
  topics: string[],
  claps: number,
  image_url: string,
  lang: string,
  publication_id: string,
  word_count: number,
  reading_time: number,
  responses_count: number,
  voters: number,
}

export class Medium extends BaseImport {
  collections = {
    medium_post: {},
    medium_user: {}
  };

  async doImport(): Promise<void> {
    await this.ensureSchema();

    return Promise.resolve();

    /*
    const posts = await this.parseArchivePosts();
    for (const post of posts) {
      await this.db.push(post, `medium_post/${post.id}`);
    }
    this.log(`${posts.length} archived Medium posts were imported.`)
    return Promise.resolve();
    */
  }

  /**
   * Parses the raw HTML files from a downloaded Medium archive
   */
  async parseArchivePosts() {
    const files = {
      profile: await this.files.findInput('profile/*.html'),
      posts: await this.files.findInput('posts/*.html'),
      lists: await this.files.findInput('lists/lists-*.html'),
      claps: await this.files.findInput('claps/claps-*.html'),
      highlights: await this.files.findInput('highlights/highlights-*.html'),
      bookmarks: await this.files.findInput('bookmarks/bookmarks-*.html'),
    }

    // const about = await this.files.readInput('profile/about.html');
    // const profile = await this.files.readInput('profile/profile.html');
    // const publications = await this.files.readInput('profile/publications.html');
    // const memberships = await this.files.readInput('profile/memberships.html');

    const posts: Record<string, Partial<MediumPost>> = {};
    for (const postFile of files.posts) {
      const post = await this.readMediumPost(postFile);
      posts[post.id ?? 'ERR'] = post;
    }

    // console.log(posts);
    for (const post of Object.values(posts)) {
      await this.files.writeCache(`post-${post.id}.json`, post);
    }

    return Promise.resolve();
  }

  protected async readMediumPost(file: string): Promise<Partial<MediumPost>> {
    let [filename, slugDate, id] = file.match(/posts\/(.*)_.*-([a-z0-9]+).html/) ?? [];
    const html = await this.files.readInput(file);
    const draft = slugDate === 'draft';

    const $ = cheerioParse(html);

    const template = {
      title: 'h1.p-name',
      subtitle: 'section[data-field="subtitle"]',
      content: 'section[data-field="body"] | html | trim',
      published_at: 'footer > p > a > time | attr:datetime',
      url: 'a.p-canonical | attr:href',
      image_url: 'section.section--body.section--first > div.section-content > div.section-inner.sectionLayout--fullWidth > figure > img | attr:src',
      author: {
        $: 'footer > p > a.p-author',
        url: '| attr:href',
        fullname: '$',
      },
    };

    const extracted = await $().extract(template) as Record<string, unknown>;
    const post: Partial<MediumArticle> = { id, filename, ...extracted, draft };
    return Promise.resolve(post);
  }
}


