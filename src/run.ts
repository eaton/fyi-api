import 'dotenv/config';

import { Drupal6Import } from './index.js';

const vpj = new Drupal6Import({
  name: 'positiva-jeff-2008',
  nodeTypesWithFields: ['oldsite', 'photo', 'review'],
  ignoreNodeTypes: ['lj', 'amazonnode', 'banner'],
  extraTables: ['delicious_link', 'delicious_tag', 'files', 'links', 'links_node', 'amazonitem', 'amazon_item', 'amazonnode'],
  database: {
    dbName: 'jeffblog-2008',
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    pass: process.env.MYSQL_PASS,
  }
});
await vpj.fillCache();
