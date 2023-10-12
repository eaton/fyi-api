import 'dotenv/config';

// import t from 'tap';
import { Twitter, TwitterImportOptions } from '../src/index.js';

const opt: TwitterImportOptions = {
  files: { input: process.env.TWITTER_INPUT, cache: 'test/cache' },
  metadata: true,
  archive: 'merge',
  favorites: true,
  singles: false,
  retweets: false,
  replies: false,
  threads: false,
  media: false,
  metrics: false
}

const twitter = new Twitter(opt);
await twitter.loadCache();
