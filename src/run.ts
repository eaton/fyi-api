import 'dotenv/config';

import { Instagram } from './index.js';

const ig = new Instagram({
  files: { input: process.env.INSTAGRAM_INPUT }
})
await ig.doImport();
