import 'dotenv/config';
import { Twitter } from './index.js';

const auth = {
  apiKey: process.env.TWITTER_API_KEY,
  apiKeySecret: process.env.TWITTER_API_KEY_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessTokenSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
  clientId: process.env.TWITTER_CLIENT_ID,
  clientSecret: process.env.TWITTER_CLIENT_SECRET,
  bearerToken: process.env.TWITTER_BEARER_TOKEN,
};

const t = new Twitter({ auth, bookmarks: true, files: { import: process.env.TWITTER_INPUT } });
await t.cacheApiBookmarks();