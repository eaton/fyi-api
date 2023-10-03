import { BaseImport } from '../../index.js';
import { Html } from '../../index.js';

export type MediumUserInfo = {
  id: string,
  url: string,
  email: string,
  name: string,
  fullname: string,
  twitter_id?: string,
  archive_exported_at: string,
  medium_member_at: string,
  image_url: string,
  publications: { writer?: unknown[], editor?: unknown[] }
}

export type MediumArticle = {
  id: string,
  filename: string,
  url: string,
  author: Partial<MediumUserInfo>,
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
  async parseArchive() {
    const user = await this.parseUserProfile();
    await this.files.writeCache(`user-${user.name}.json`, user);

    const files = {
      posts: await this.files.findInput('posts/*.html'),
      lists: await this.files.findInput('lists/*:*.html'),
      claps: await this.files.findInput('claps/claps-*.html'),
      bookmarks: await this.files.findInput('bookmarks/bookmarks-*.html'),
    }

    const posts: Record<string, Partial<MediumArticle>> = {};
    for (const postFile of files.posts) {
      const post = await this.parseMediumPost(postFile);
      posts[post.id ?? 'ERR'] = post;
    }

    const claps: Record<string, unknown>[] = [];
    for (const file of files.claps) {
      const $ = Html.toCheerio(await this.files.readInput(file));
      const extracted = ($().extract([{
        $: 'li.h-entry',
        title: 'a | text',
        url: 'a | attr:href',
        clapped_at: 'time',
        claps: '| split:— | shift | substr:1 | trim',
      }])) as Record<string, unknown>[];
      claps.push(...extracted);
    }
    await this.files.writeCache('claps.json', claps);

    const lists: Record<string, unknown> = {};
    for (const file of files.lists) {
      const $ = Html.toCheerio(await this.files.readInput(file));
      const extracted = ($().extract({
        title: 'h1.p-name',
        url: 'footer a:nth(1) | attr:href',
        published_at: 'footer time.dt-published | attr:datetime',
        articles: [{
          $: 'li',
          title: 'a | text',
          url: 'a | attr:href',
        }]
      })) as Record<string, unknown>;
      lists[extracted?.title?.toString() ?? ''] = extracted;
    }
    await this.files.writeCache('lists.json', lists);

    const bookmarks: Record<string, unknown>[] = [];
    for (const file of files.bookmarks) {
      const $ = Html.toCheerio(await this.files.readInput(file));
      const extracted = ($().extract([{
        $: 'li',
        title: 'a',
        url: 'a | attr:href',
        bookmarked_at: 'time',
      }])) as Record<string, unknown>[];
      bookmarks.push(...extracted);
    }
    await this.files.writeCache('bookmarks.json', bookmarks);

    // console.log(posts);
    for (const post of Object.values(posts)) {
      await this.files.writeCache(`posts/post-${post.id}.json`, post);
    }

    return Promise.resolve();
  }

  protected async parseUserProfile(): Promise<Partial<MediumUserInfo>> {
    let $ = Html.toCheerio(await this.files.readInput('profile/about.html') ?? '');
    const archive_exported_at = $('footer p').text().slice(24, -1).trim();

    $ = Html.toCheerio(await this.files.readInput('profile/profile.html') ?? '')
    const profile = $().extract({
      id: 'li:nth(3) | split:\: | pop',
      name: 'li:nth(0) | split:\: | pop | substr:1',
      fullname: 'li:nth(1) | split:\: | pop',
      email: 'li:nth(2) | split:\: | pop',
      medium_member_at: 'li:nth(4) | substr:12',
      image_url: 'img.u-photo | attr:src',
      twitter_id: 'li:nth(6) | split:\: | pop'
    }) as Record<string, unknown>;
    
    $ = Html.toCheerio(await this.files.readInput('profile/publications.html') ?? '');
    const publications = $().extract({
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
    }) as Record<string, unknown>;

    return Promise.resolve({
      ...profile,
      ...publications,
      archive_exported_at
    });
  }

  protected async parseMediumPost(file: string): Promise<Partial<MediumArticle>> {
    let [filename, slugDate, id] = file.match(/posts\/(.*)_.*-([a-z0-9]+).html/) ?? [];
    const html = await this.files.readInput(file);
    const draft = slugDate === 'draft';

    const $ = Html.toCheerio(html);

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

    const extracted = ($().extract(template)) as Record<string, unknown>;
    const post: Partial<MediumArticle> = { id, filename, ...extracted, draft };
    return Promise.resolve(post);
  }
}


