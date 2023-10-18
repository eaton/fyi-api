import 'dotenv/config';
import { Drupal7Import, Drupal6Import } from '../index.js';

const auth = {
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  pass: process.env.MYSQL_PASS
};

const alt = new Drupal7Import({
  name: 'angrylittletree-drupal',
  database: { dbName: 'angrylittletree-2012', ...auth },
});
await alt.fillCache();

const predicate = new Drupal7Import({
  name: 'predicate-2013',
  extraTables: ['poll_choice', 'bestreply', 'files', 'file_managed'],
  nodeFields: {
    field_image: ['fid'],
    upload: ['fid', 'description'],
    field_url: ['url', 'title'],
  },
  database: { dbName: 'predicate-2013', ...auth },
});
await predicate.fillCache();

const goddy = new Drupal7Import({
  name: 'goddy',
  database: { dbName: 'goddy-2013', ...auth },
  nodeFields: {
    field_product: ['asin'],
    field_money_quote: ['value'],
    upload: ['fid', 'description'],
    field_link: ['url', 'title'],
  },
  extraTables: ['files', 'file_managed', 'amazon_item', 'amazon_book'],
});
await goddy.fillCache();

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
