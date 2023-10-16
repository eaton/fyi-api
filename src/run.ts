import 'dotenv/config';

import { Twitter, TwitterImportOptions } from './index.js';

const opt: TwitterImportOptions = {
  files: { input: process.env.TWITTER_INPUT },
  media: false,
  favorites: true,
  resolveUrls: false,
  scrape: false,
  headless: false,
  metrics: false,
}

const twitter = new Twitter(opt);
// await twitter.loadCache();
await twitter.fillIncompleteTweets();
