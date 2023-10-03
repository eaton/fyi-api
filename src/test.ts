import { MovableType } from "./index.js";
const t = new MovableType({
  sqlDb: 'movabletype-2005',
  tables: {
    plugins: 'mt_plugindata',
    templates: 'mt_template',
  }
});
await t.fillCache();
