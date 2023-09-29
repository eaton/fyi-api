import { CheerioCrawler, Request } from 'crawlee';
import * as cheerio from 'cheerio';

import { ParsedUrl } from '@autogram/url-tools'

import gpkg from 'fast-glob';
const { async: glob } = gpkg;

import fpkg from 'fs-extra';
const { exists, ensureDir, readJSON, writeJSON } = fpkg;

import { Import, ImportOptions } from "./import-base.js";
import { isString } from '@sindresorhus/is';

export type MetafilterUserData = Record<string, unknown> & {
  id: number,
  handle?: string,
  fullname?: string,
  website?: string,
  social?: string[],
  activity?: Record<string, string[]>
  raw: string,
};

export type MetafilterPostData = {
  id: string,
  url: string,
  raw: string,
  site?: string,
  title?: string,
  date?: string,
  author?: string,
  authorId?: number,
  comments?: string,
  favorites?: number,
  projectVotes?: number,
  askSection?: string
  tags?: string,
  links?: string[],
  body?: string,
  summary?: string,
  details?: string,
  savedComments?: MetafilterCommentData[],
}

export type MetafilterCommentData = {
  id: string,
  raw: string,
  date?: string,
  author?: string,
  authorId?: number,
  favorites?: number,
  body?: string,
}

interface MetafilterImportOptions extends ImportOptions {

  /**
   * Download and cache user metadata even if it already exists.
   */
  forceUser?: boolean,

  /**
   * Download and cache all user post and comments even if they already exist.
   */
  forcePosts?: boolean,

  /**
   * Re-parse profile, post, and comment details from the cached HTML.
   */
  forceParse?: boolean,
}

export class Metafilter extends Import {
  collections = ['metafilter_user', 'metafilter_post', 'metafilter_comment'];
  forceUser = false;
  forcePosts = false;
  forceParse = false;
  
  constructor(options: MetafilterImportOptions = {}) {
    super(options);
    if (options.forceUser) this.forceUser = true;
    if (options.forcePosts) this.forcePosts = true;
    if (options.forceParse) this.forceParse = true;
  }

  override async doImport(): Promise<string[]> {
    const cachedUser = (await glob('raw/metafilter/user-*.json')).pop();
    const cachedPosts = await glob('raw/metafilter/**/post-*.json');
    
    const saved = {
      users: 0,
      posts: 0,
      comments: 0
    };

    if (cachedUser === undefined || cachedPosts.length === 0) {
      return Promise.resolve(['No Metafilter data to import.']);
    }

    if (this.db === undefined) {
      return Promise.resolve(['No ArangoDB connection.']);
    }

    const user = await readJSON(cachedUser) as MetafilterUserData;
    if (this.forceParse) this.extractUserProperties(user);

    await this.db.collection('metafilter_user').save({
      _key: user.id,
      ...user
    }, { overwriteMode: 'update' }).then(() => saved.users++);

    for (const postFile of cachedPosts) {
      const post = await readJSON(postFile) as MetafilterPostData;
      if (this.forceParse) this.extractPostProperties(post);

      await this.db.collection('metafilter_post').save({
        _key: `${post.site}-${post.id}`,
        ...user
      }, { overwriteMode: 'update' }).then(() => saved.posts++);

      for (const comment of post.savedComments ?? []) {
        if (this.forceParse) this.extractCommentProperties(comment);
        await this.db.collection('metafilter_post').save({
          _key: `${post.site}-${post.id}`,
          post: `metafilter_post/${post.site}-${post.id}`,
          ...comment
        }, { overwriteMode: 'update' }).then(() => saved.comments++);
      }
    }

    return Promise.resolve([
      `Metafilter: Saved ${saved.users} users, ${saved.posts} posts, and ${saved.comments} comments.`,
    ])
  }

  /**
   * For the Metafilter import, preload selectively downloads and caches
   * raw user profile, post, and comment data from the site for processing.
   */
  override async preload(options: MetafilterImportOptions = {}): Promise<Record<string, string>> {
    const uid = Number.parseInt(process.env.METAFILTER_USER_ID ?? '');

    // If there's no cached user file, retrieve it and save it.
    if ((await exists(this.userFileName(uid))) === false || options?.forceUser) {
      await this.cacheUserData(uid);
    }

    const user = (await readJSON(this.userFileName(uid))) as MetafilterUserData;
    const postsToCache: Record<string, string[]> = {};
    for (const [url, commentIds] of Object.entries(user.activity ?? [])) {
      if ((await exists(this.postFileName(url))) === false || options?.forcePosts) {
        postsToCache[url] = commentIds;
      }
    }
    await this.cachePostsAndComments(postsToCache);

    return Promise.resolve({});
  }

  protected userFileName(uid: string | number) {
    return `raw/metafilter/user-${uid}.json`;
  }

  protected postFileName(url: URL | string) {
    const parsed = new ParsedUrl(url.toString());
    return `raw/metafilter/${parsed.subdomain}/post-${parsed.path.slice(-1,1)}.json`;
  }

  async cacheUserData(uid: number) {
    const profileUrl = `https://www.metafilter.com/user/${uid}`;
    const activityUrl = `https://www.metafilter.com/activity/${uid}/`;

    // Set up the raw user data first
    const user: MetafilterUserData = { id: uid, raw: '' };

    const activity: Record<string, Set<string>> = {};

    // First, get all the post listing pages
    let crawler = new CheerioCrawler({
      maxConcurrency: 4,
      maxRequestsPerMinute: 120,
      requestHandler: async (context) => {
        const $ = cheerio.load(context.body);
        // Populate the user metadata
        if (context.request.url === profileUrl) {
          user.raw = $('div.content[role="main"] > div.container').html() ?? '';
          this.extractUserProperties(user);
        } else if (context.request.url.startsWith(activityUrl + 'posts')) {

          // Enqueue additional pages of comments
          await context.enqueueLinks({ globs: [`**/activity/${uid}/comments/**`] });
          
          // Extract post URLs
          $("h1.posttitle a").toArray()
            .forEach(e => {
              const link = $(e).attr('href');
              if (link && !Object.keys(activity).includes(link)) {
                activity[link] = new Set<string>();
              }
            });

        } else if (context.request.url.startsWith(activityUrl + 'comments')) {
          // Enqueue additional pages of comments
          await context.enqueueLinks({ globs: [`**/activity/${uid}/comments/**`] });

          // Extract post URLs and comment IDs
          $("blockquote > span.smallcopy > a").toArray()
            .forEach(e => {
              const url = $(e).attr('href');
              if (url && url.match(/.*metafilter.com\/\d+\/.*\#\d+/)) {
                const [link, commentId] = url.split('#');
                if (Object.keys(activity).includes(link)) {
                  activity[link].add(commentId);
                } else {
                  activity[link] = new Set<string>([commentId]);
                }
              }
            });
        }
        
        await ensureDir('raw/metafilter');
        await writeJSON(this.userFileName(uid), user, { spaces: 2 });
        return Promise.resolve();
      }
    });

    await crawler.run([profileUrl, activityUrl + 'posts/', activityUrl + 'comments/']);

    return Promise.resolve({
      ...user,
      activity: Object.fromEntries(
        Object.entries(activity).map(([p, c]) => {
        return [p, [...c]]
      }))
    });
  }

  async cachePostsAndComments(activity: Record<string, string[]>) {
    console.log(`fetching ${Object.entries(activity).length} posts`);

    let crawler = new CheerioCrawler({
      maxConcurrency: 1,
      maxRequestsPerMinute: 120,
      requestHandler: async (context) => {
        const url = context.request.url;
        const pid = url.split('/').slice(-2, -1)[0];
        const $ = await context.parseWithCheerio();

        const post: MetafilterPostData = {
          id: pid,
          url: url,
          raw: $('#posts h1.posttitle, #posts div.copy').first().html()?.trim() ?? ''
        }
        this.extractPostProperties(post);

        const savedComments: MetafilterCommentData[] = [];
        const cids = context.request.userData.comments as string[];
        for (const cid of cids) {
          const comment: MetafilterCommentData = {
            id: cid,
            raw: $(`a[name="${cid}"] + div`).html() ?? '',
          }
          if (comment.raw.length === 0) continue;
          this.extractCommentProperties(comment);
          savedComments.push(comment);
        }
        post.savedComments = savedComments;

        await ensureDir(`raw/metafilter/${post.site}`);
        await writeJSON(this.postFileName(url), post, { spaces: 2 });
        return Promise.resolve();
      }
    });

    const requests = Object.entries(activity)
      .map(([url, comments]) => new Request({ url: url, userData: { comments } }));
    await crawler.run(requests);
    return Promise.resolve();
  }

  extractUserProperties(user: MetafilterUserData) {
    const $ = cheerio.load(user.raw, {}, false);
    user.handle = $('title').text()?.replace("'s profile | MetaFilter", '');
    user.fullname = $('span.fn').text();
    user.website = $('h2.monthday a').first().attr('href') ?? '';
    user.social = $('a[rel=me]').toArray().map(e => $(e).attr('href')).filter(isString);
  }

  extractPostProperties(post: MetafilterPostData) {
    const $ = cheerio.load(post.raw, {}, false);

    const title = $('title').text().replace(' | MetaFilter', '');
    const date = $('h1.posttitle span.smallcopy').text().replace('Subscribe', '').trim();
    const author = $('#posts div.copy span.postbyline a').first().text();
    const authorId = $('#posts div.copy span.postbyline a').first().attr('href')?.split('/').pop() ?? '';
    const comments = $('#posts div.copy span.postbyline').text().trim().match(/\((\d+) comment/)?.[1];
    const favorites = $('#posts div.copy span.postbyline span[id^="favcnt"]').text().split(' ')?.shift();
    const tags = $('#taglist a.taglink').toArray().map(e => $(e).text());

    $('#posts div.copy span.postbyline').remove();

    const links = $('#posts div.copy a').toArray().map(e => $(e).attr('href')).filter(Boolean);
    const text = $('#posts div.copy').first().text().trim();
  }
  
  extractCommentProperties(comment: MetafilterCommentData) {
    const $ = cheerio.load(comment.raw, {}, false);

    const metaSelector = `a[name="${comment.id}"] + div span.smallcopy`
    const time = $(metaSelector).text().match(/ at (\d+:\d+ [AP]M)\s+on /)?.[1];
    const date = $(metaSelector).text().match(/\s+on ([a-zA-Z]+ \d+, \d+)/)?.[1];
    const data = {
      date: `${date} ${time}`,
      author: $(metaSelector + ' a').first().text(),
      authorId: $(metaSelector + ' a').first().attr('href')?.split('/').pop() ?? '',
      favorites: $(metaSelector).text().match(/\[(\d+) favorite/)?.[1],
      html: $(`a[name="${comment.id}"] + div`).html() ?? '',
      text: $(`a[name="${comment.id}"] + div`).text(),
    }
  }
}