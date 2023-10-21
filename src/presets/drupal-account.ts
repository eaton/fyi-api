import 'dotenv/config';
import { DrupalAccount } from '../index.js';

const da = new DrupalAccount({
  userId: process.env.DRUPAL_ORG_USER,
});

await da.fillCache();
