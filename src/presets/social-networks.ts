import 'dotenv/config';
import { Twitter, Instagram, Facebook } from '../index.js';

// This is the grand-daddy of them all
const tw = new Twitter({
  name: '2007-twitter',
  files: { input: process.env.TWITTER_INPUT }
});
await tw.fillCache();

const fb = new Facebook({
  name: '2007-facebook',
  files: { input: process.env.FACEBOOK_INPUT }
})
await fb.fillCache();

const ig = new Instagram({
  name: '2011-instagram',
  files: { input: process.env.INSTAGRAM_INPUT }
})
await ig.doImport();
