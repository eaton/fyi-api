import { ArchiveSyntheticInfo } from "twitter-archive-reader";
import { BaseImportOptions } from "../index.js";

// TODO: We can't really retrieve bookmarks proper from Twitter without
// paying stupid money for the privelege. Instead, we'll accept named text
// files with URLs or Tweet IDs, and process them as if they were named bookmark
// groups. That will also make it possible to archive arbitrary lists of tweets
// complete with screenshots, which is probably interesting on its own.

export type TwitterImportCache = {
  [index: string]: unknown,

  /**
   * Archives processed during the import, keyed by date.
   */
  archives: ArchiveSyntheticInfo[],

  /**
   * All known tweets, regardless of user.
   */
  tweets: Map<string, TwitterPost>,

  /**
   * An index of children for every tweet that is a thread.
   */
  threads: Map<string, Set<string>>,

  /**
   * Individual media entities processed during the import.
   * These may be imported from a Twitter Archive, or synthesized
   * when scraping public tweets.
   */
  media: Map<string, TwitterMedia>,

  /**
   * An index of Tweet IDs saved as favorites.
   */
  favorites: Map<string, Set<string>>,

  /**
   * A list day-by-day analytics numbers for the specified Twitter user.
   */
  metrics: Map<string, TwitterAnalyticsRow[]>,
}

/**
 * Favorites, quote tweets, media alt text, and a number of other important parts
 * of a user's twitter archive are sparsely or inconsistntly populated in the
 * default Twitter Archive. The Twitter Import allows you to turn each kind of
 * entity on and off for the import, AND allows you to specify how much work it
 * should to do look up the missing bits.
 * 
 * - basic: Use Twitter's OEmbed endpoint to get username, post date, and raw text.
 *   mostly useful for favorites, which come in with almost no data at all.
 * - scrape: Use a headless browser to load the tweet data. This gets the same
 *   stuff that 'metadata' does, but can also capture alt text on images, like and
 *   favorite counts, etc.
 * - archive: Get all of the previous data, and take a screenshot of the tweet
 *   for archival purposes.
 */
export type TwitterLookupLevel = false | 'basic' | 'scrape' | 'screenshot';

export type TwitterLookupLevelFunction = ((tweet: TwitterPost) => TwitterLookupLevel);

export interface TwitterImportOptions extends BaseImportOptions {

  scrape?: TwitterLookupLevel | TwitterLookupLevelFunction,

  scrapingLimit?: number,

  scrapingInterval?: number,

  resolveUrls?: boolean,

  /**
   * Look for zipped Twitter archive files in the `input` directory, and use
   * them as a migration source. If this property is set to 'newest' or 'oldest'
   * and multiple archives are found, only one will be processed.
   *
   * @defaultValue `true`
   */
  archive?: boolean | 'newest' | 'oldest',

  /**
   * Process retweets from saved Twitter Archives. Because Retweets generally
   * come with full data for the underlying tweet, we don't bother with the
   * full Lookup options.
   *
   * @defaultValue `true`
   */
  retweets?: boolean,

  /**
   * Process standalone tweets (i.e., tweets that are not part of a thread)
   * from saved Twitter Archives.
   *
   * @defaultValue `true`
   */
  singles?: boolean,

  /**
   * Process multi-tweet threads by the Twitter Archive's user.
   *
   * @defaultValue `true`
   */
  threads?: boolean

  /**
   * Process replies to other users' tweets from saved Twitter Archives.
   *
   * @defaultValue `true`
   */
  replies?: boolean,

  /**
   * Look for day-by-day analytics exports in CSV format, and use them as
   * a migration source.
   *
   * @defaultValue `true`
   */
  metrics?: boolean,

  /**
   * Process favorited tweets from saved Twitter Archives.
   *
   * @defaultValue `true`
   */
  favorites?: boolean | TwitterLookupLevel,

  /**
   * Process media details.
   */
  media?: boolean,

  /**
   * One or more list of tweets to retrieve and process, in addition to the
   * tweets in the archive.
   * 
   * This can be an array of tweet URLS, a filename containing a list of tweet
   * URLs, or a glob string matching multiple files full of tweet URLs. By default,
   * or when set to `true`, it will treat any .txt files in the input directory as
   * custom tweet lists.
   * 
   * @defaultValue: `*.txt`
   */
  custom?: boolean | string | string[];
}

export type TwitterUser = Record<string, unknown> & {
  id: string,
  name: string,
  fullName?: string
}

export type TwitterPost = Record<string, unknown> & {
  id: string
  url?: string,
  status?: number,
  userId?: string,
  name?: string,
  fullName?: string,
  threadId?: string,
  repliesToTweetId?: string,
  repliesToUserId?: string,
  date?: string,
  text?: string,
  media?: Record<string, string>[],
  urls?: Record<string, string>[],
  mentions?: string[],
  favorites?: number,
  retweets?: number,
  replies?: number,
  quotes?: number,
  bookmarks?: number,
}

export type ScrapedTweet = TwitterPost & {
  success?: boolean,
  errors?: string[],
  html?: string,
  screenshot?: Buffer
  screenshotFormat?: 'jpeg' | 'png',
}

export type TwitterMedia = Record<string, unknown> & {
  id: string,
  tweetId: string,
  url?: string,
  mediaUrl?: string,
  alt?: string
  filetype?: string,
}

export type TwitterAnalyticsSet = {
  username?: string,
  start?: string,
  end?: string,
  locale?: string,
  rows: TwitterAnalyticsRow[],
}

export type TwitterAnalyticsRow = Record<string, string> & {
  date: string,
  tweetsPublished?: string,
  impressions?: string,
  engagements?: string,
  engagementRate?: string,
  retweets?: string,
  replies?: string,
  likes?: string,
  profileClicks?: string,
  urlClicks?: string,
  hashtagClick?: string,
  detailExpands?: string,
  permalinkClicks?: string,
  appOpens?: string,
  appInstalls?: string,
  follows?: string,
  emailTweet?: string,
  dialPhone?: string,
  mediaViews?: string,
  mediaEngagements?: string,
};
