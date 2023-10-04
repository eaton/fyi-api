import { Twitter } from "./index.js";

const t = new Twitter({
  files: {
    input: '/Volumes/archives/Backup/Service Migration Downloads/twitter'
  }
});
await t.fillCache();
