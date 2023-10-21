import 'dotenv/config';
import { DrupalOrg } from '../index.js';

const da = new DrupalOrg({
  name: 'drupal',
  userId: process.env.DRUPAL_ORG_USER,
});

await da.fillCache();
