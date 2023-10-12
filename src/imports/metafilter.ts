import { ParsedUrl } from '@autogram/url-tools'
import { CheerioCrawler, Request } from 'crawlee';
import * as cheerio from 'cheerio';

import { BaseImport, BaseImportOptions } from "../index.js";
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
  comments?: number,
  favorites?: number,
  askSection?: string
  tags?: string[],
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

export interface MetafilterImportOptions extends BaseImportOptions {
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

export class Metafilter extends BaseImport {
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

  async doImport(): Promise<void> {
    const cachedUser = (await this.files.find('input/metafilter/user-*.json')).pop();
    const cachedPosts = await this.files.find('input/metafilter/**/post-*.json');
    
    await this.ensureSchema();

    const saved = {
      users: 0,
      posts: 0,
      comments: 0
    };

    if (cachedUser === undefined || cachedPosts.length === 0) {
      this.log('No Metafilter data to import.')
      return Promise.resolve();
    }

    if (this.db === undefined) {
      this.log('No ArangoDB connection.')
      return Promise.resolve();
    }

    const user = await this.files.read(cachedUser) as MetafilterUserData;
    if (this.forceParse) this.extractUserProperties(user);

    user.raw = '';
    user.activity = undefined;

    await this.db.collection('metafilter_user').save({
      _key: user.id.toString(),
      ...user
    }, { overwriteMode: 'update' }).then(() => saved.users++);

    for (const postFile of cachedPosts) {
      const post = await this.files.read(postFile) as MetafilterPostData;
      if (this.forceParse) this.extractPostProperties(post);

      for (const comment of post.savedComments ?? []) {
        if (this.forceParse) this.extractCommentProperties(comment);

        // Bulky and unecessary, we don't likes it
        comment.raw = '';

        await this.db.collection('metafilter_comment').save({
          _key: `${post.site}-${comment.id}`,
          post: `metafilter_post/${post.site}-${post.id}`,
          ...comment
        }, { overwriteMode: 'update' }).then(() => saved.comments++);
      }

      // Bulky and unecessary, we don't likes it
      post.raw = '';
      post.savedComments = undefined;

      await this.db.collection('metafilter_post').save({
        _key: `${post.site}-${post.id}`,
        ...post
      }, { overwriteMode: 'update' }).then(() => saved.posts++);
    }

    this.log(`Saved ${saved.users} users, ${saved.posts} posts, and ${saved.comments} comments.`)
    return Promise.resolve();
  }

  /**
   * For the Metafilter import, preload selectively downloads and caches
   * raw user profile, post, and comment data from the site for processing.
   */
  override async fillCache(options: MetafilterImportOptions = {}) {
    const uid = Number.parseInt(process.env.METAFILTER_USER_ID ?? '');

    // If there's no cached user file, retrieve it and save it.
    if (this.files.exists(this.userFileName(uid)) === false || options?.forceUser) {
      await this.cacheUserData(uid);
    }

    const user = (await this.files.read(this.userFileName(uid))) as MetafilterUserData;
    if (this.forceParse) this.extractUserProperties(user);

    const postsToCache: Record<string, string[]> = {};
    for (const [url, commentIds] of Object.entries(user.activity ?? [])) {
      if (this.files.exists(this.postFileName(url)) === false || options?.forcePosts) {
        postsToCache[url] = commentIds;
      }
    }
    await this.cachePostsAndComments(postsToCache);

    return Promise.resolve();
  }

  protected userFileName(uid: string | number) {
    return `raw/metafilter/user-${uid}.json`;
  }

  protected postFileName(url: URL | string) {
    const parsed = new ParsedUrl(url.toString());
    return `raw/metafilter/${parsed.subdomain}/post-${parsed.path.slice(-2,1)}.json`;
  }

  async cacheUserData(uid: number) {
    const profileUrl = `https://www.metafilter.com/user/${uid}`;
    const activityUrl = `https://www.metafilter.com/activity/${uid}/`;

    // Set up the raw user data first
    const user: MetafilterUserData = { id: uid, raw: '' };

    const activity: Record<string, Set<string>> = {};

    // First, get all the post listing pages
    let crawler = new CheerioCrawler({
      maxConcurrency: 2,
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

        // Turn the set into a simple array for serialization
        user.activity = Object.fromEntries(Object.entries(activity).map(entry => [entry[0], [...entry[1]]]));
        
        this.files.ensureCache('metafilter');
        await this.files.write(this.userFileName(uid), user);
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
    this.log(`fetching ${Object.entries(activity).length} posts`);

    let crawler = new CheerioCrawler({
      maxConcurrency: 2,
      maxRequestsPerMinute: 120,
      requestHandler: async (context) => {
        const url = context.request.url;
        const pid = url.split('/').slice(-2, -1)[0];
        const $ = await context.parseWithCheerio();

        const post: MetafilterPostData = {
          id: pid,
          url: url,
          raw: $('#posts h1.posttitle, #posts div.copy, #threadside').toArray().map(e => $(e).prop('outerHTML')).join()
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

        this.files.ensure(`raw/metafilter/${post.site}`);
        await this.files.write(this.postFileName(url), post);
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
    user.handle = $('h2.monthday').text().match(/\s*([\w-]+)'s profile/)?.[1];
    user.fullname = $('span.fn').text();
    user.website = $('h2.monthday a').first().attr('href') ?? '';
    user.social = $('a[rel=me]').toArray().map(e => $(e).attr('href')).filter(isString);
  }

  extractPostProperties(post: MetafilterPostData) {
    const $ = cheerio.load(post.raw, {}, false);
    const dateline = $('h1.posttitle span.smallcopy').text().trim();

    post.site = new ParsedUrl(post.url).subdomain;
    post.title = $('h1.posttitle').text().replace(dateline, '').trim();
    post.date = dateline.match(/([a-zA-Z]+\s+\d+,\s+\d+\s+\d+\:\d+\s+[AP]M)\s+Subscribe/)?.[1];
    post.author = $('span.postbyline a').first().text();
    post.authorId = Number.parseInt($('span.postbyline a').first().attr('href')?.split('/').pop() ?? '') ?? undefined;
    post.askSection = $('span.postbyline').text().match(/\s+to\s+(\w+)\s+at/)?.[1];

    post.comments = Number.parseInt($('span.postbyline').text().trim().match(/\((\d+) comment/)?.[1] ?? '0');
    post.favorites = Number.parseInt($('span.postbyline span[id^="favcnt"]').text().split(' ')?.shift() ?? '0');
    post.tags = $('#taglist a.taglink').toArray().map(e => $(e).text().trim());

    $('span.postbyline').remove();
    post.links = $('div.copy a').toArray().map(e => $(e).attr('href') ?? ''),
    post.details = brToNl($('div.copy div.miseperator').html() ?? undefined),

    $('div.copy div.miseperator').remove();
    post.summary = brToNl($('div.copy').html() ?? undefined);

    // Let's think about this. Maybe we don't need the unified field.
    post.body = undefined;
  }
  
  extractCommentProperties(comment: MetafilterCommentData) {
    const $ = cheerio.load(comment.raw, {}, false);

    const time = $('span.smallcopy').text().match(/ at (\d+:\d+ [AP]M)\s+on /)?.[1];
    const date = $('span.smallcopy').text().match(/\s+on ([a-zA-Z]+ \d+, \d+)/)?.[1];

    comment.date = `${date} ${time}`;
    comment.author = $('span.smallcopy a').first().text();
    comment.authorId = Number.parseInt($('span.smallcopy a').first().attr('href')?.split('/').pop() ?? '') ?? undefined;
    comment.favorites = Number.parseInt($('span.smallcopy').text().match(/\[(\d+) favorite/)?.[1] ?? '0');

    $('span.smallcopy').remove();
    comment.body = brToNl($.html()) ?? undefined;
  }
}

function brToNl(val?: string){
  if (val) {
    return val
      .replaceAll('<span></span>', '')
      .replaceAll(/<br[\w/]*>/g, '\n\n')
      .replaceAll(/\n\n+/g, '\n\n').trim();
  } else return val;
}