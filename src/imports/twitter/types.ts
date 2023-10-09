import type { TwitterAuthData } from "./auth.js";
import { BaseImportOptions } from "../index.js";

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
   * Process favorited tweets from saved Twitter Archives.
   *
   * @defaultValue `true`
   */
  favorites?: boolean,

  /**
   * Process retweets from saved Twitter Archives.
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
   * Use the Twitter API to migrate bookmarked tweets.
   *
   * @defaultValue `true`
   */
  bookmarks?: boolean,

  /**
   * Use the Twitter API to retrieve alt text for media items in processed
   * tweet archives.
   *
   * @defaultValue `false`
   */
  populateAltText?: boolean,

  /**
   * Use the Twitter API to migrate bookmarked tweets.
   *
   * @defaultValue `true`
   */
  populateFavorites?: boolean,

  /**
   * Twitter's API is strictly rate-limited, and paid access is pricey a f.
   * this property contains various bundles of tokens, keys, and secrets
   * but can be set to `false` to prevent any authenticated requests.
   * 
   * If you do want to use the API to pull in additional metadata (like alt
   * text for media, and twitter bookmarks), you'll need to register at the
   * {@link Twitter Developer Portal | 
   *
   * @defaultValue `false`
   */
  auth?: false | TwitterAuthData,
}

export type TwitterUser = Record<string, unknown> & {
  id: string,
  name: string,
  fullName?: string
}

export type TwitterPost = Record<string, unknown> & {
  id: string
  userId: string,
  userName: string,
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
