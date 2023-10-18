import 'dotenv/config';
import { Metafilter } from '../index.js';

// This is the grand-daddy of them all
const tw = new Metafilter({
  name: '2004-metafilter',
  userId: process.env.METAFILTER_USER_ID,
  files: { input: process.env.METAFILTER_INPUT }
});
await tw.doImport();