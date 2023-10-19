import { Facebook } from './index.js';

const ui = new Facebook({
  files: { input: process.env.FACEBOOK_INPUT }
});

await ui.fillCache();
