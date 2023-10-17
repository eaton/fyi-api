import 'dotenv/config';

import { Drupal7Import } from './index.js';

const alt = new Drupal7Import({
  name: 'angrylittletree-drupal',
  fileField: 'attachments',
  database: {
    dbName: 'angrylittletree-2012',
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    pass: process.env.MYSQL_PASS
  }
});

await alt.fillCache();


const predicate = new Drupal7Import({
  name: 'predicate-2013',
  fileField: 'assets',
  nodeFields: {
    
  },
  database: {
    dbName: 'predicate-2013',
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    pass: process.env.MYSQL_PASS
  }
});

await predicate.fillCache();

/*
const goddy = new Drupal7Import({
  name: 'goddy',
  database: {
    dbName: 'goddy-2013',
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    pass: process.env.MYSQL_PASS
  }
});

await goddy.fillCache();
*/