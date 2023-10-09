import { BaseImportOptions } from "../index.js";

// TODO: We can't really retrieve bookmarks proper from Twitter without
// paying stupid money for the privelege. Instead, we'll accept named text
// files with URLs or Tweet IDs, and process them as if they were named bookmark
// groups. That will also make it possible to archive arbitrary lists of tweets
// complete with screenshots, which is probably interesting on its own.

/**
 * Favorites, quote tweets, media alt text, and a number of other important parts
 * of a user's twitter archive are sparsely or inconsistntly populated in the
 * default Twitter Archive. The Twitter Import allows you to turn each kind of
 * entity on and off for the import, AND allows you to specify how much work it
 * should to do look up the missing bits.
 * 
 * - metadata: Use Twitter's OEmbed endpoint to get username, post date, and raw text.
 *   mostly useful for favorites, which come in with almost no data at all.
 * - scrape: Use a headless browser to load the tweet data. This gets the same
 *   stuff that 'metadata' does, but can also capture alt text on images, like and
 *   favorite counts, etc.
 * - archive: Get all of the previous data, and take a screenshot of the tweet
 *   for archival purposes.
 */
export type TwitterLookupLevel = 'metadata' | 'scrape' | 'archive';

/**
 * A text or CSV file containing a return-delimited list of tweet URLs or IDs
 * to be archived.
 */
export type TwitterCustomImport = {

  /**
   * An optional name for the set of imported tweets.
   */
  name?: string,

  /**
   * The filename to be imported and processed; relative paths will be treated
   * as relative to the filestore's `import` directory.
   * 
   * If the filename contains glob wildcards, and multiple files are matched,
   * their contents will be deduplicated and combined for processing as a single
   * list.
   */
  filename: string,

  /**
   * The level of rigor to use when looking up the tweets; if no level is
   * specified, 'metadata' will be used for the sake of speed.
   */
  level?: TwitterLookupLevel
}

export interface TwitterImportOptions extends BaseImportOptions {
  /**
   * Look for zipped Twitter archive files in the `input` directory, and use
   * them as a migration source. If this property is set to 'newest' or 'oldest'
   * and multiple archives are found, only one will be processed.
   *
   * @defaultValue `true`
   */
  archives?: boolean | 'newest' | 'oldest',

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
   * One or more list of tweets to retrieve and process, in addition to the
   * tweets in the archive.
   * 
   * This can be a simple array of Tweet URLs, Tweet IDs, or an array of
   * pointers to txt and csv file full of tweets.
   */
  custom?: TwitterCustomImport[] | string[];
}

export type TwitterUser = Record<string, unknown> & {
  id: string,
  name: string,
  fullName?: string
}

export type TwitterPost = Record<string, unknown> & {
  id: string
  userId: string,
  name: string,
  threadId?: string,
  repliesToTweetId?: string,
  repliesToUserId?: string,
  retweetOf?: string | Partial<TwitterPost>,
  date: string,
  text: string,
  media: string[],
  urls: string[],
  mentions: string[],
  favorites: number,
  replies: number,
  presentInArchive?: [],
}

export type TwitterMedia = Record<string, unknown> & {
  id: string,
  tweetId: string,
}

export type TwitterFavorite = Record<string, unknown> & {
  id: string,
  name?: string,
  date?: string,
  text?: string,
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
