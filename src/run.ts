import 'dotenv/config';

// import t from 'tap';
import { Twitter, TwitterImportOptions } from './index.js';

const opt: TwitterImportOptions = {
  files: {
    input: process.env.TWITTER_INPUT,
    cache: 'test/cache'
  },
  resolveUrls: true,
  headless: false,
}

const twitter = new Twitter(opt);
await twitter.loadCache();
