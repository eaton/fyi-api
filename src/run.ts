import 'dotenv/config';

// import t from 'tap';
import { Twitter, TwitterImportOptions } from './index.js';

const opt: TwitterImportOptions = {
  files: { input: process.env.TWITTER_INPUT },
  resolveUrls: true,
  headless: false,
  metrics: false,
}

const twitter = new Twitter(opt);
await twitter.loadCache();
