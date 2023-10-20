import { BaseImport, BaseImportOptions, ScraperImportOptions } from "../../index.js";

import { extractWithCheerio } from "../../../index.js";
import { CheerioCrawler } from "crawlee";

export interface DrupalAccountOptions extends BaseImportOptions, ScraperImportOptions {
  /**
   * The `uid` or user name of the Drupal.org user whose profile and activity
   * should be scraped.
   */
  user?: string | number,

  /**
   * If you happen to have a mirror of drupal.org at some other URL, well,
   * you can definitely use it.
   * 
   * @defaultValue `https://drupal.org`
   */
  baseUrl?: string,

  /**
   * A list of node types to ignore when collecting user activity. These should
   * be Drupal 'machine names' like `project-release`, rather than readable
   * labels like `Release`.
   */
  ignoreNodeTypes?: string[],
}

type DrupalAccountCache = {
  profile: Record<string, unknown>
  projects: Record<string, unknown>[],
  posts: Record<string, unknown>[],
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
    // https://www.drupal.org/user/[user-id] or https://www.drupal.org/u/[user-name]
    // https://www.drupal.org/user/[user-id]/track

    // We should check for existing cached data.
    await new CheerioCrawler({
      ignoreSslErrors: true,
    }).run();
  }
}

async function extractProfile(html: string) {
  return extractWithCheerio(html, {
    name: 'meta[property=profile:username] | attr:content',
    age: '#user-user-full-group-profile-main p:first-child()',
    avatar: 'meta[property=og:image] | attr:content',
    socialLinks: [{
      $: 'div.field-name-field-social-links',
      value: 'a[rel=nofollow me] | attr:href'
    }],
    companies: 'div.field-name-companies-worked-for div.field-items | text | split',
    industries: 'div.field-name-field-industries-worked-in div.field-items | text | split',
    bio: 'div.field-name-field-bio field-type-text-long div.field-items',
    expertise: [{
      $: 'div.field-name-field-areas-of-expertise div.field-items',
      value: 'div.field-item | text'
    }],
    events: [{
      $: 'div.field-name-field-events-attended div.field-items',
      value: 'div.field-item | text'
    }],
    maintainer: [{
      $: 'div.view-users-maintained-projects div.field-items',
      value: 'div.field-item | text'
    }]
  });
}

async function extractTrackerActivity(html: string) {
  return extractWithCheerio(html, {
    posts: [{
      $: 'div#content-inner table tbody tr:not(:first-child)',
      type: '> td:nth-child(0)',
      title: '> td:nth-child(1)',
      url: '> td:nth-child(1) a attr:href',
      author: '> td:nth-child(2) a.username',
      uid: '> td:nth-child(2) a.username | attr:data-uid | parseAs:int',
      replies: '> td.replies | parseAs:int',
      updated: '> td:nth-child(4)'
    }],
  })
}
