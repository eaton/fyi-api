import 'dotenv/config';
import { DrupalOrg } from '../index.js';

const ddo = new DrupalOrg({
  importName: 'drupal',
  userId: process.env.DRUPAL_ORG_USER
});

await ddo.fillCache();
