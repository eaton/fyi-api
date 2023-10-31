import { JsonTemplate } from 'cheerio-json-mapper';
import { BaseImport, Html } from '../../index.js';
import { MediumUserInfo, MediumArticle } from './types.js';

export class Medium extends BaseImport {
  collections = ['medium_post', 'medium_user'];

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
  async fillCache() {
    const user = await this.parseUserProfile();
    if (!this.files.existsCache(`user-${user.name}.json`)) {
      await this.files.writeCache(`user-${user.name}.json`, user);
    }

    let template: JsonTemplate = {};
    const files = {
      posts: await this.files.findInput('posts/*.html'),
      lists: await this.files.findInput('lists/*:*.html'),
      claps: await this.files.findInput('claps/claps-*.html'),
      bookmarks: await this.files.findInput('bookmarks/bookmarks-*.html'),
    }

    if (!this.files.existsCache(`claps.json`)) {
      const claps: Record<string, unknown>[] = [];
      template = [{
        $: 'li.h-entry',
        title: 'a | text',
        url: 'a | attr:href',
        clapped_at: 'time',
        claps: '| split:— | shift | substr:1 | trim',
      }];
      for (const file of files.claps) {
        const extracted = await this.files.readInput(file)
          .then(data => Html.extract(data, template));
        claps.push(...extracted as Record<string, unknown>[]);
      }
      await this.files.writeCache('claps.json', claps);
    }

    if (!this.files.existsCache(`lists.json`)) {
      const lists: Record<string, unknown> = {};
      template = {
        title: 'h1.p-name',
        url: 'footer a:nth(1) | attr:href',
        published_at: 'footer time.dt-published | attr:datetime',
        articles: [{
          $: 'li',
          title: 'a | text',
          url: 'a | attr:href',
        }]
      };
      for (const file of files.lists) {
        const extracted = await this.files.readInput(file)
          .then(data => Html.extract(data, template)) as Record<string, unknown>;
        lists[extracted?.title?.toString() ?? ''] = extracted;
      }
      await this.files.writeCache('lists.json', lists);
    }

    if (!this.files.existsCache(`bookmarks.json`)) {
      const bookmarks: Record<string, unknown>[] = [];
      template = [{
        $: 'li',
        title: 'a',
        url: 'a | attr:href',
        bookmarked_at: 'time',
      }];
      for (const file of files.bookmarks) {
        const extracted = await this.files.readInput(file)
          .then(data => Html.extract(data, template));
        bookmarks.push(...extracted as Record<string, unknown>[]);
      }
      await this.files.writeCache('bookmarks.json', bookmarks);
    }

    const posts: Record<string, Partial<MediumArticle>> = {};
    for (const postFile of files.posts) {
      const post = await this.parseMediumPost(postFile);
      posts[post.id ?? 'ERR'] = post;
    }

    for (const post of Object.values(posts)) {
      if (!this.files.existsCache(`posts/post-${post.id}.json`)) {
        await this.files.writeCache(`posts/post-${post.id}.json`, post);
      }
    }

    return Promise.resolve();
  }

  protected async parseUserProfile(): Promise<Partial<MediumUserInfo>> {
    let $ = Html.toCheerio(await this.files.readInput('profile/about.html') ?? '');
    const archive_exported_at = $('footer p').text().slice(24, -1).trim();

    let template: JsonTemplate = {
      id: 'li:nth(3) | split:\: | pop',
      name: 'li:nth(0) | split:\: | pop | substr:1',
      fullname: 'li:nth(1) | split:\: | pop',
      email: 'li:nth(2) | split:\: | pop',
      medium_member_at: 'li:nth(4) | substr:12',
      image_url: 'img.u-photo | attr:src',
      twitter_id: 'li:nth(6) | split:\: | pop'
    };

    const profile = await this.files.readInput('profile/profile.html')
      .then(data => data ? Html.extract(data, template) : {}) as Record<string, unknown>
    
    template = {
      editor: [{
        $: 'ul:nth(0) > li',
        title: 'a',
        url: 'a | attr:href',
      }],
      writer: [{
        $: 'ul:nth(1) > li',
        title: 'a',
        url: 'a | attr:href',
      }],
    };
    const publications = await this.files.readInput('profile/publications.html')
      .then(data => data ? Html.extract(data, template) : {}) as Record<string, unknown>

    return Promise.resolve({
      ...profile,
      ...publications,
      archive_exported_at
    });
  }

  protected async parseMediumPost(file: string): Promise<Partial<MediumArticle>> {
    let [filename, slugDate, id] = file.match(/posts\/(.*)_.*-([a-z0-9]+).html/) ?? [];
    const draft = slugDate === 'draft';

    const template = {
      title: 'h1.p-name',
      subtitle: 'section[data-field="subtitle"]',
      content: 'section[data-field="body"] | html | trim',
      published_at: 'footer > p > a > time | attr:datetime',
      url: 'a.p-canonical | attr:href',
      image_url: 'section.section--body.section--first > div.section-content > div.section-inner.sectionLayout--fullWidth > figure > img | attr:src',
      author: {
        $: 'footer > p > a.p-author',
        name: '| attr:href | substr:20',
        fullname: '$',
        url: '| attr:href',
      },
    };
    const extracted = await this.files.readInput(file)
      .then(data => data ? Html.extract(data, template) : {})
    const post: Partial<MediumArticle> = { id, filename, ...extracted, draft };
    return Promise.resolve(post);
  }
}


