import 'dotenv/config';
import { Twitter } from './index.js';

const t = new Twitter({
  bookmarks: true,
  files: {
    input: process.env.TWITTER_INPUT
  }
});

await t.loadBookmarks();