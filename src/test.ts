import 'dotenv/config';
import { Twitter } from './index.js';

const t = new Twitter({
  archive: 'newest',
  metrics: false,
  singles: false,
  retweets: false,
  threads: false,
  replies: false,
  favorites: 'metadata',
  files: { input: process.env.TWITTER_INPUT }
});

await t.fillCache();