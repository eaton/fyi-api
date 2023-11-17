import 'dotenv/config';
import { Twitter, Instagram, Facebook } from '../index.js';

const fb = new Facebook({
  importName: '2007-facebook',
  files: { input: process.env.FACEBOOK_INPUT }
});
await fb.fillCache();

const ig = new Instagram({
  importName: '2011-instagram',
  files: { input: process.env.INSTAGRAM_INPUT }
});
await ig.doImport();

// This is the grand-daddy of them all
const tw = new Twitter({
  importName: '2007-twitter',
  files: { input: process.env.TWITTER_INPUT },
  retweets: true,
  favorites: true
});
await tw.loadCache();
