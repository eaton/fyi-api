import 'dotenv/config';

import { Twitter, TwitterImportOptions } from './index.js';

const opt: TwitterImportOptions = {
  files: { input: process.env.TWITTER_INPUT },
  media: true,
  favorites: true,
  metrics: true,
  cleanupUrls: true,
  populateFavorites: true,
  populateAltText: true,
}

const twitter = new Twitter(opt);
await twitter.loadCache();
