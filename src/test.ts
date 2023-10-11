import 'dotenv/config';
/*
import { Twitter } from './index.js';

const t = new Twitter({
  metrics: false,
  singles: false,
  retweets: false,
  threads: false,
  replies: false,
  favorites: false,
  files: { input: process.env.TWITTER_INPUT }
});

await t.fillCache();
*/
import { UrlResolver } from './index.js';

const testUrls = [
  'https://t.co/Jk7Cue53fv',
  'https://t.co/oqGcLJ3drM',
  'https://t.co/oqGcLJ3drM'
]
const r = new UrlResolver();
for (const u of testUrls) {
  console.log(await r.resolve(u));
}