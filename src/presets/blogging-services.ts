import 'dotenv/config';

import { Tumblr, MovableType, Medium, Livejournal } from '../index.js';

const auth = {
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  pass: process.env.MYSQL_PASS
};

const lj = new Livejournal({
  importName: '2001-livejournal',
  files: { input: process.env.LIVEJOURNAL_INPUT }
});
if ( 0 ) await lj.doImport();

const mt = new MovableType({
  importName: '2004-viapositiva1',
  authors: [4],
  database: { ...auth, dbName: process.env.MOVABLETYPE_DBNAME ?? '' }
});
if ( 0 ) await mt.doImport();

const tbl = new Tumblr({
  importName: '2005-tumblr',
  auth: {
    consumer_key: process.env.TUMBLR_CONSUMER_KEY ?? '',
    consumer_secret: process.env.TUMBLR_CONSUMER_SECRET ?? '',
    token: process.env.TUMBLR_TOKEN ?? '',
    token_secret: process.env.TUMBLR_TOKEN_SECRET ?? ''
  }
});
await tbl.doImport();

const med = new Medium({
  importName: '2013-medium',
  files: { input: process.env.MEDIUM_INPUT }
});
if ( 0 ) await med.fillCache();
