import 'dotenv/config';
import { Twitter, Tumblr, Wordpress, Livejournal } from "./index.js";

await tumblr();

export async function tumblr() {
  const t = new Tumblr();
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