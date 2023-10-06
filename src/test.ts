import 'dotenv/config';
import { Twitter, Tumblr, Wordpress, Livejournal } from "./index.js";

export async function tumblr() {
  const t = new Tumblr({
    auth: {
      consumer_key: process.env.TUMBLR_CONSUMER_KEY,
      consumer_secret: process.env.TUMBLR_CONSUMER_SECRET,
      token: process.env.TUMBLR_TOKEN,
      token_secret: process.env.TUMBLR_TOKEN_SECRET
    }
  });
  await t.doImport();
}

export async function livejournal() {
  const t = new Livejournal({ files: { input: process.env.LIVEJOURNAL_INPUT } });
  await t.doImport();
}

export async function twitter() {
  const t = new Twitter({
    auth: {
      apiKey: process.env.TWITTER_API_KEY,
      apiKeySecret: process.env.TWITTER_API_KEY_SECRET,
      accessToken: process.env.TWITTER_ACCESS_TOKEN,
      accessTokenSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
      clientId: process.env.TWITTER_CLIENT_ID,
      clientSecret: process.env.TWITTER_CLIENT_SECRET,
      bearerToken: process.env.TWITTER_BEARER_TOKEN,
    },
    useApi: true,
    files: { input: process.env.TWITTER_INPUT }
  });
  console.log(t);
}

export async function wordpress() {
  const w = new Wordpress({ files: { input: process.env.WORDPRESS_INPUT } });
  await w.doImport();
}