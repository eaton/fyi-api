import 'dotenv/config';

import { Tumblr, MovableType, Medium, Livejournal } from '../index.js';

const auth = {
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  pass: process.env.MYSQL_PASS
};

const tbl = new Tumblr({
  name: 'tumblr',
  auth: {
    consumer_key: process.env.TUMBLR_CONSUMER_KEY ?? '',
    consumer_secret: process.env.TUMBLR_CONSUMER_SECRET ?? '',
    token: process.env.TUMBLR_TOKEN ?? '',
    token_secret: process.env.TUMBLR_TOKEN_SECRET ?? ''
  },
});
await tbl.doImport();

const mt = new MovableType({
  name: 'viapositiva-mt',
  database: { ...auth, dbName: process.env.MOVABLETYPE_DBNAME ?? '' }
});
await mt.doImport();

const med = new Medium({
  name: 'medium-eaton',
  files: { input: process.env.MEDIUM_INPUT }
});
await med.fillCache();

const lj = new Livejournal({
  name: 'livejournal',
  files: { input: process.env.LIVEJOURNAL_INPUT }
});
await lj.doImport();