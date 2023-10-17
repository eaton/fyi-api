import 'dotenv/config';

import { MovableType } from './index.js';

const mt = new MovableType({
  sqlDb: process.env.MOVABLETYPE_DBNAME,
  sqlHost: process.env.MYSQL_HOST,
  sqlUser: process.env.MYSQL_USER,
  sqlPass: process.env.MYSQL_PASS,
});

await mt.doImport();
