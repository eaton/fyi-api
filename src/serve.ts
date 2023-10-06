import 'dotenv/config';
import { getOAuth2Client } from "./imports/twitter/auth.js"
import { Filestore } from './util/filestore.js';

const auth = {
  apiKey: process.env.TWITTER_API_KEY,
  apiKeySecret: process.env.TWITTER_API_KEY_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessTokenSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
  clientId: process.env.TWITTER_CLIENT_ID,
  clientSecret: process.env.TWITTER_CLIENT_SECRET,
  bearerToken: process.env.TWITTER_BEARER_TOKEN,
};

const fs = new Filestore({ cache: 'test/cache' });

// const client = await getOAuth1Client(auth.apiKey!, auth.apiKeySecret!);
const client = await getOAuth2Client(auth.clientId!, auth.clientSecret!, fs);
console.log(await client.currentUserV2());
