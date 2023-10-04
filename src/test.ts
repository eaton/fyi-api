import { Twitter, Tumblr, Wordpress } from "./index.js";

await tumblr();

export async function tumblr() {
  const t = new Tumblr();
  await t.doImport();
}

export async function twitter() {
  const t = new Twitter({
    files: {
      input: '/Volumes/archives/Backup/Service Migration Downloads/twitter'
    }
  });
  await t.fillCache();
}

export async function wordpress() {
  const w = new Wordpress({
    files: { input: '/Volumes/archives/Backup/Service Migration Downloads/wordpress' }
  });
  await w.doImport();
}