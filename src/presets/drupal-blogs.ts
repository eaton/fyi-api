import 'dotenv/config';
import { Drupal7Import, Drupal6Import } from '../index.js';

const auth = {
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  pass: process.env.MYSQL_PASS
};

const vpj = new Drupal6Import({
  importName: '2005-viapositiva2',
  nodeTypesWithFields: ['oldsite', 'photo', 'review'],
  ignoreNodeTypes: ['lj', 'amazonnode', 'banner', 'amazon_node'],
  extraTables: [
    'delicious_link',
    'delicious_tag',
    'files',
    'links',
    'links_node',
    'amazonitem',
    'amazon_item',
    'amazonnode'
  ],
  database: {
    dbName: 'jeffblog-2008',
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    pass: process.env.MYSQL_PASS
  }
});
await vpj.fillCache();

const goddy = new Drupal7Import({
  importName: '2007-goddy',
  database: { dbName: 'goddy-2013', ...auth },
  nodeFields: {
    field_product: ['asin'],
    field_money_quote: ['value'],
    upload: ['fid', 'description'],
    field_link: ['url', 'title'],
  },
  extraTables: ['files', 'file_managed', 'amazon_item', 'amazon_book'],
  ignoreUids: [ 0, 1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20 ]
});
await goddy.fillCache();

const predicateOld = new Drupal6Import({
  importName: '2010-predicate2',
  ignoreNodeTypes: ['lj', 'amazonnode', 'banner'],
  extraTables: ['poll_choices', 'files', 'links', 'links_node'],
  nodeTypesWithFields: ['game', 'turn', 'quotes', 'recipe'],
  nodeFields: {
    ingredients: ['value'],
    related_links: ['url', 'title']
  },
  database: { dbName: 'predicate-2010', ...auth }
});
await predicateOld.fillCache();

const alt = new Drupal7Import({
  importName: '2011-angrylittletree1',
  extraTables: ['file_managed'],
  database: { dbName: 'angrylittletree-2012', ...auth }
});
await alt.fillCache();

const predicate = new Drupal7Import({
  importName: '2013-predicate3',
  extraTables: [
    'poll_choice',
    'bestreply',
    'files',
    'file_managed',
    'weblinks',
    'weblinks_node'
  ],
  nodeFields: {
    field_image: ['fid'],
    upload: ['fid', 'description'],
    field_url: ['url', 'title']
  },
  database: { dbName: 'predicate-2013', ...auth }
});
await predicate.fillCache();
