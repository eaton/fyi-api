import { BaseImport, BaseImportOptions, DrupalOrgProfile, DrupalOrgActivity, ScraperImportOptions, DrupalOrgIssue, DrupalOrgRelease, DrupalOrgProject, DrupalOrgTopic } from "../../index.js";
import { dateFromOffset, extractWithCheerio } from "../../../index.js";
import { CheerioCrawler, log } from "crawlee";
import is from '@sindresorhus/is';
import { ParsedUrl } from "@autogram/url-tools";

export interface DrupalOrgOptions extends BaseImportOptions, ScraperImportOptions {
  /**
   * The `uid` or user name of the Drupal.org user whose profile and activity
   * should be scraped.
   */
  userId?: number | string,

  /**
   * If you happen to have a mirror of drupal.org at some other URL, well,
   * you can definitely use it.
   * 
   * @defaultValue `https://drupal.org`
   */
  baseUrl?: string,

  /**
   * Process Drupal.org nodes posted by the user
   */
  nodes?: true | string[] | false,

  /**
   * Process comments posted by the user
   */
  comments?: true | 'user' | false,
}

type DrupalOrgCache = {
  profile: Record<string, unknown>
  projects: DrupalOrgProject[],
  issues: DrupalOrgIssue[],
  releases: DrupalOrgRelease[],
  topics: DrupalOrgTopic[],
}

const defaults: DrupalOrgOptions = {
  baseUrl: 'https://drupal.org',
  comments: false,
}

/**
 * Extracts a user's profile information, posts and comments,
 * and project contributions from drupal.org.
 * 
 * This should be updated to use https://www.drupal.org/api-d7 
 * rather than scrapingg, but for now it'll do. See the docs at
 * https://www.drupal.org/drupalorg/docs/apis/rest-and-other-apis
 * for details.
 */
export class DrupalOrg extends BaseImport<DrupalOrgCache> {
  declare options: DrupalOrgOptions;
  
  constructor(options: DrupalOrgOptions = {}) {
    const opt = { ...defaults, ...options };
    super(opt);
  }

  async fillCache() {
    const uid = is.number(this.options.userId) ? this.options.userId :
      is.numericString(this.options.userId) ? Number.parseInt(this.options.userId) :
      0;

    if (uid === 0) return Promise.reject();

    const cache: DrupalOrgCache = {
      profile: {},
      projects: [],
      releases: [],
      issues: [],
      topics: []
    }

    // TODO: check for existing cached data.

    log.setLevel(log.LEVELS.ERROR);
    const crawler = new CheerioCrawler({
      sameDomainDelaySecs: 2,
      ...this.options.scraper ?? {},
      requestHandler: async context => {
        const pageType = getPageType(context.request.url);
        const html = context.body.toString();
        if (pageType === 'profile') {
          cache.profile = await extractProfile(html);
          await this.files.writeCache(`${cache.profile.handle}-profile.json`, cache.profile);
          this.log(`Cached drupal.org account info for ${cache.profile.handle}`)

        } else if (pageType === 'tracker') {
          if (this.options.nodes) {
            await context.enqueueLinks({ globs: [
              '**/user/*/track*',
              '**/(project,forum)/**'
            ]});
          }
        } else if (pageType === 'project' && this.options.nodes !== false) {
          cache.projects.push(await extractProject(html));
        } else if (pageType === 'release' && this.options.nodes !== false) {
          cache.releases.push(await extractRelease(html));
        } else if (pageType === 'issue' && this.options.nodes !== false) {
          cache.issues.push(await extractIssue(html, uid));
        } else if (pageType === 'topic' && this.options.nodes !== false) {
          cache.topics.push(await extractTopic(html, uid));
        }
        return Promise.resolve();
      }
    });

    await crawler.addRequests([
      `${this.options.baseUrl}/user/${uid}`,
      `${this.options.baseUrl}/user/${uid}/track`,
    ]);

    await crawler.run();
  }
}

function getPageType(url: string) {
  const parsed = new ParsedUrl(url);
  if (parsed.path[0] === 'user' && parsed.path[2] === 'track') return 'tracker';
  if (parsed.path[0] === 'user') return 'profile';
  if (parsed.path[0] === 'forum') return 'topic';
  if (parsed.path[0] === 'project' && parsed.path[2] === 'issues') return 'issue';
  if (parsed.path[0] === 'project' && parsed.path[2] === 'releases') return 'release';
  if (parsed.path[0] === 'project') return 'project';
  return 'other';
}

export async function extractProfile(html: string) {
  return extractWithCheerio(html, {
    handle: 'meta[property=profile:username] | attr:content',
    name: 'h1#page-title',
    date: '#user-user-full-group-profile-main > p:first-child',
    avatar: 'meta[property="og:image"] | attr:content',
    bio: 'div.field-name-field-bio div.field-items',
    socialLinks: [{
      $: 'div.field-name-field-social-links a[rel="nofollow me"]',
      value: '$ | attr:href'
    }],
    companies: 'div.field-name-companies-worked-for div.field-items | text | split:,',
    industries: 'div.field-name-field-industries-worked-in div.field-items | text | split:,',
    expertise: [{
      $: 'div.field-name-field-areas-of-expertise div.field-item',
      value: '$ | text'
    }],
    events: [{
      $: 'div.field-name-field-events-attended div.field-item',
      value: '$ | text'
    }],
    maintainer: [{
      $: 'div.view-users-maintained-projects div.views-row a',
      name: '$ | text',
      url: '$ | attr:href'
    }]
  })
  .then(data => data as DrupalOrgProfile)
  .then(profile => {
    if (profile.date) profile.date = dateFromOffset(profile.date);
    if (profile.name) profile.name = profile.name.split('(').shift()?.trim();
    if (profile.socialLinks) profile.socialLinks = profile.socialLinks.map(v => (v as unknown as { value: string }).value)
    if (profile.events) profile.events = profile.events.map(v => (v as unknown as { value: string }).value)
    if (profile.expertise) profile.expertise = profile.expertise.map(v => (v as unknown as { value: string }).value)
    return profile;
  });
}

export async function extractTrackerActivity(html: string, targetUid?: number) {
  return extractWithCheerio(html, {
    posts: [{
      $: 'div#content-inner table tbody tr:not(:first-child)',
      type: 'td:nth-child(1)',
      title: 'td:nth-child(2)',
      url: 'td:nth-child(2) a | attr:href',
      author: 'td:nth-child(3) a.username',
      uid: 'td:nth-child(3) a.username | attr:data-uid | parseAs:int',
      replies: 'td.replies | parseAs:int',
      updated: 'td:nth-child(5)'
    }],
  })
  .then(data => (data.posts ?? []) as DrupalOrgActivity[])
  .then(activity => activity.map(a => {
    a.updated = dateFromOffset(a.updated);
    return a;
  }))
  .then(activity => activity.filter(a => targetUid ? a.uid === targetUid : true));
}

export async function extractIssue(html: string, userId?: number) {
  return extractWithCheerio(html, {
    title: '#page-subtitle',
    nid: 'head link[rel="shortlink"] | attr:href | split:/ | pop',
    url: 'head link[rel="canonical"] | attr:href',

    body: 'div.field-name-body div.field-item | html',

    status: '#block-project-issue-issue-metadata div.field-name-field-issue-status div.field-item',
    author: '#block-project-issue-issue-metadata div.field-name-project-issue-created-by a | attr:href | split:/ | pop',
    uid: 'div.field-name-project-issue-created-by a | attr:data-uid | parseAs:int',
    date: '#block-project-issue-issue-metadata div.field-name-project-issue-created div.field-item',
    tags: [{ $: '#about-tags', value: 'dt' }],
    priority: '#block-project-issue-issue-metadata div.field-name-field-issue-priority div.field-item',
    followers: 'span.flag-project-issue-follow span.flag-tracker-count | split | shift | trim',

    replies: [{
      $: 'section.comments div.comment:not(div.system-message)',
      cid: '$ | attr:id | substr:8 | parseAs:int',
      author: 'div.submitted *.username | text | default',
      uid: 'div.submitted *.username | attr:data-uid | default:0 | parseAs:int',
      date: 'div.submitted time | attr:datetime',
      body: 'div.content div.field-name-comment-body div.field-item | html',
      changes: [{
        $: 'table.nodechanges-field-changes tr',
        key: 'td.nodechanges-label | split:: | shift',
        value: 'td.nodechanges-new | substr:2'
      }]
    }]
  })
  .then(data => (data ?? {}) as DrupalOrgIssue)
}

export async function extractProject(html: string) {
  return extractWithCheerio(html, {
    title: '#page-subtitle',
    nid: 'head link[rel="shortlink"] | attr:href | split:/ | pop',
    url: 'head link[rel="canonical"] | attr:href',

    body: 'div.field-name-body div.field-item | html',

    tags: [{
      $: 'ul.project-info li:nth-child(1) a',
      value: '$ | text'
    }],
    usage: 'ul.project-info li:nth-child(2) a strong | replace:, | parseAs:int | default:0',
    creator: 'ul.project-info li:nth-child(3) a',
    date: 'ul.project-info li:nth-child(3) time:nth-child(2) | parseAs:date',
    favorites: '#block-drupalorg-project-follow a.log-in-to-star | text | split | shift | replace:, | parseAs:int | default:0'
  })
  .then(data => (data ?? {}) as DrupalOrgProject)
}

export async function extractTopic(html: string, userId?: number) {
  return extractWithCheerio(html, {
    title: '#page-subtitle',
    nid: 'head link[rel="shortlink"] | attr:href | split:/ | pop',
    url: 'head link[rel="canonical"] | attr:href',
    
    author: 'div.node-forum div.submitted span.username',
    uid: 'div.node-forum div.submitted a | attr:data-uid | parseAs:int',
    date: 'div.node-forum div.submitted time | attr:datetime',

    body: 'div.node-forum div.field-name-body div.field-item | html',

    replies: [{
      $: 'section.comments div.comment',
      cid: '$ | attr:id | substr:8 | parseAs:int',
      nid: '$ | attr:id | substr:8 | parseAs:int',
      author: 'div.submitted *.username | text',
      uid: 'div.submitted *.username | attr:data-uid | default:0 | parseAs:int',
      date: 'div.submitted time | attr:datetime',
      title: 'h3',
      body: 'div.content div.field-name-comment-body div.field-item | html'
    }]
  })
  .then(data => (data ?? {}) as DrupalOrgTopic)
}

export async function extractRelease(html: string) {
  return extractWithCheerio(html, {
    title: '#page-subtitle',
    nid: 'head link[rel="shortlink"] | attr:href | split:/ | pop',
    url: 'head link[rel="canonical"] | attr:href',

    project: 'head link[rel="canonical"] | attr:href | split:/ | index:4',
    version: 'head link[rel="canonical"] | attr:href | split:/ | index:6',
    creator: 'div.group-release-sidebar > div.release-info > a',
    date: 'head meta[property="article:published_time"] | attr:content',

    body: 'div.field-name-body div.field-item | html',
  })
  .then(data => (data ?? {}) as DrupalOrgTopic)
}
