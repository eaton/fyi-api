import { ArchiveSyntheticInfo } from 'twitter-archive-reader';
import { BaseImportOptions, FoundUrl } from '../../index.js';
import { TweetIndex } from './tweet-index.js';

// TODO: We can't really retrieve bookmarks proper from Twitter without
// paying stupid money for the privelege. Instead, we'll accept named text
// files with URLs or Tweet IDs, and process them as if they were named bookmark
// groups. That will also make it possible to archive arbitrary lists of tweets
// complete with screenshots, which is probably interesting on its own.

export type TwitterImportCache = {
  [index: string]: unknown;

  /**
   * Archives processed during the import, keyed by date.
   */
  archives: ArchiveSyntheticInfo[];

  /**
   * All known tweets, regardless of user.
   */
  tweets: Map<string, TwitterPost>;

  /**
   * An index of children for every tweet that is a thread.
   */
  threads: Map<string, Set<string>>;

  /**
   * Individual media entities processed during the import.
   * These may be imported from a Twitter Archive, or synthesized
   * when scraping public tweets.
   */
  media: Map<string, TwitterMedia>;

  /**
   * An index of Tweet IDs to record interactions like retweeting, favoriting, bookmarking, etc.
   */
  tweetIndex: TweetIndex;
};

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

export type TwitterLookupLevelFunction = (
  tweet: TwitterPost
) => TwitterLookupLevel;

export interface TwitterImportOptions extends BaseImportOptions {
  attemptLogin?: boolean;

  resolveUrls?: boolean;

  /**
   * Look for zipped Twitter archive files in the `input` directory, and use
   * them as a migration source. If this property is set to 'newest' or 'oldest'
   * and multiple archives are found, only one will be processed.
   *
   * @defaultValue `true`
   */
  archive?: boolean | 'newest' | 'oldest';

  /**
   * Process retweets from saved Twitter Archives. Because Retweets generally
   * come with full data for the underlying tweet, we don't bother with the
   * full Lookup options.
   *
   * @defaultValue `true`
   */
  retweets?: boolean;

  /**
   * Process multi-tweet threads by the Twitter Archive's user.
   *
   * @defaultValue `true`
   */
  threads?: boolean;

  /**
   * Process favorited tweets from saved Twitter Archives.
   *
   * @defaultValue `true`
   */
  favorites?: boolean;

  /**
   * Process media details.
   */
  media?: boolean;
}

export type TwitterUser = {
  [index: string]: unknown;
  userId?: string;
  handle?: string;
  displayName?: string;
};

export type TwitterPost = TwitterUser & {
  id: string;
  url?: string;
  status?: number;
  threadId?: string;
  threadChildren?: string[];
  opId?: string;
  opHandle?: string;
  date?: string;
  text?: string;
  media?: TwitterMedia[];
  urls?: FoundUrl[];
  mentions?: string[];
  favorites?: number;
  retweets?: number;
  replies?: number;
  quotes?: number;
  bookmarks?: number;
  scraped?: boolean;
};

export type TwitterMedia = Record<string, unknown> & {
  id: string;
  tweetId?: string;
  text?: string;
  url?: string;
  imageUrl?: string;
  videoUrl?: string;
  alt?: string;
  incomplete?: boolean;
};

export type ScrapedTweet = TwitterPost & {
  success?: boolean;
  errors?: string[];
  html?: string;
  screenshot?: Buffer;
  screenshotFormat?: 'jpeg' | 'png';
};

export type TwitterMetricsRow = Record<string, unknown> & {
  handle?: string;
  date: string;
  tweetsPublished?: number;
  impressions?: number;
  engagements?: number;
  engagementRate?: number;
  retweets?: number;
  replies?: number;
  likes?: number;
  profileClicks?: number;
  urlClicks?: number;
  hashtagClick?: number;
  detailExpands?: number;
  permalinkClicks?: number;
  appOpens?: number;
  appInstalls?: number;
  follows?: number;
  emailTweet?: number;
  dialPhone?: number;
  mediaViews?: number;
  mediaEngagements?: number;
};
