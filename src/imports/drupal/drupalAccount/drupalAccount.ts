import { BaseImport, BaseImportOptions, DrupalProfilePage, DrupalTrackerActivity, ScraperImportOptions } from "../../index.js";
import { dateFromOffset, extractWithCheerio } from "../../../index.js";
import { CheerioCrawler, log } from "crawlee";
import is from '@sindresorhus/is';
import { ParsedUrl } from "@autogram/url-tools";

export interface DrupalAccountOptions extends BaseImportOptions, ScraperImportOptions {
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

  comments?: boolean,
}

type DrupalAccountCache = {
  profile: Record<string, unknown>
  projects: Record<string, unknown>[],
  activity: Record<string, unknown>[],
  comments: Record<string, unknown>[]
}

const defaults: DrupalAccountOptions = {
  baseUrl: 'https://drupal.org',
  comments: false,
}

/**
 * Extracts a user's profile information, posts and comments,
 * and project contributions from drupal.org.
 */
export class DrupalAccount extends BaseImport<DrupalAccountCache> {
  declare options: DrupalAccountOptions;
  
  constructor(options: DrupalAccountOptions = {}) {
    const opt = { ...defaults, ...options };
    super(opt);
  }

  async fillCache() {
    const uid = is.number(this.options.userId) ? this.options.userId :
      is.numericString(this.options.userId) ? Number.parseInt(this.options.userId) :
      0;

    if (uid === 0) return Promise.reject();

    const cache: DrupalAccountCache = {
      profile: {},
      activity: [],
      projects: [],
      comments: [],
    }

    // TODO: check for existing cached data.

    log.setLevel(log.LEVELS.ERROR);
    const crawler = new CheerioCrawler({
      sameDomainDelaySecs: 2,
      ...this.options.scraper,
      requestHandler: async context => {
        const pageType = getPageType(context.request.url);
        const html = context.body.toString();
        if (pageType === 'profile') {
          cache.profile = await extractProfile(html);
          await this.files.writeCache(`${cache.profile.handle}-profile.json`, cache.profile);
          this.log(`Cached drupal.org account info for ${cache.profile.handle}`)

        } else if (pageType === 'tracker') {
          // await context.enqueueLinks({
          //   globs: ['**/user/*/track*']
          // });

          // In theory we should instead visit those URLs to determine
          // their content. for now, though? Eh. It's fine.
          cache.activity.push(...await extractTrackerActivity(html, uid));
        } else {
          // Handle projects, issues, forum posts, etc.
        }
        return Promise.resolve();
      }
    });

    await crawler.addRequests([
      `${this.options.baseUrl}/user/${uid}`,
      `${this.options.baseUrl}/user/${uid}/track`,
    ]);

    await crawler.run();

    await this.files.writeCache(`${cache.profile.handle}-activity.json`, cache.activity);
    this.log(`Cached ${cache.activity.length} posts.`);
  }
}

function getPageType(url: string) {
  const parsed = new ParsedUrl(url);
  if (parsed.path[0] === 'user' && parsed.path[2] === 'track') return 'tracker';
  if (parsed.path[0] === 'user') return 'profile';
  if (parsed.path[0] === 'project' && parsed.path[2] === 'releases') return 'release'
  if (parsed.path[0] === 'project' && parsed.path[2] === 'issues') return 'issue'
  if (parsed.path[0] === 'project') return 'project'
  return 'other';
}

async function extractProfile(html: string) {
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
    companies: 'div.field-name-companies-worked-for div.field-items | text | split',
    industries: 'div.field-name-field-industries-worked-in div.field-items | text | split',
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
  .then(data => data as DrupalProfilePage)
  .then(profile => {
    if (profile.date) profile.date = dateFromOffset(profile.date);
    if (profile.name) profile.name = profile.name.split('(').shift()?.trim();
    if (profile.socialLinks) profile.socialLinks = profile.socialLinks.map(v => (v as unknown as { value: string }).value)
    if (profile.events) profile.events = profile.events.map(v => (v as unknown as { value: string }).value)
    if (profile.expertise) profile.expertise = profile.expertise.map(v => (v as unknown as { value: string }).value)
    return profile;
  });
}

async function extractTrackerActivity(html: string, targetUid?: number) {
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
  .then(data => (data.posts ?? []) as DrupalTrackerActivity[])
  .then(activity => activity.map(a => {
    a.updated = dateFromOffset(a.updated);
    return a;
  }))
  .then(activity => activity.filter(a => targetUid ? a.uid === targetUid : true));
}