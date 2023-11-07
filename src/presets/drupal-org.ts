import 'dotenv/config';
import { DrupalOrg } from '../index.js';

const ddo = new DrupalOrg({
  name: 'drupal',
  userId: process.env.DRUPAL_ORG_USER
});

await ddo.fillCache();
