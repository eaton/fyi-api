export type TwitterAnalyticsSet = {
  username: string,
  start: string,
  end: string,
  rows: TwitterAnalyticsRow[],
}

export type TwitterAnalyticsRow = Record<string, string | number | undefined> & {
  date: string,
  tweets?: number,
  impressions?: number,
  engagements?: number,
  engagementRate?: number,
  retweets?: number,
  replies?: number,
  likes?: number,
  profileClicks?: number,
  urlClicks?: number,
  hashtagClick?: number,
  detailExpands?: number,
  permalinkClicks?: number,
  appOpens?: number,
  appInstalls?: number,
  follows?: number,
  emailTweet?: number,
  dialPhone?: number,
  mediaViews?: number,
  mediaEngagements?: number,
};
