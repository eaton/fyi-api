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
