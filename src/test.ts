import 'dotenv/config'
import { Database, Filestore, Tumblr } from './index.js'

const db = new Database();
const files = new Filestore();

const t = new Tumblr({ db, files });
await t.preload();