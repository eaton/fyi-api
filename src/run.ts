import 'dotenv/config';
import { Twitter } from './index.js';

const t = new Twitter({
  name: '2007-twitter',
  files: { input: process.env.TWITTER_INPUT },
  threads: true,
  favorites: true,
  retweets: true,
});
await t.loadCache();
console.log(t.cacheStats());