import 'dotenv/config';
import { Twitter, Tumblr, Wordpress, Livejournal } from "./index.js";

await tumblr();

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
  const t = new Twitter({ files: { input: process.env.TWITTER_INPUT } });
  await t.fillCache();
}

export async function wordpress() {
  const w = new Wordpress({ files: { input: process.env.WORDPRESS_INPUT } });
  await w.doImport();
}