import { Database, Filestore, Metafilter } from './index.js';

const db = new Database();
const files = new Filestore();
const mf = new Metafilter({ db, files });

await mf.preload();
// await mf.getPosts({'https://www.metafilter.com/89127/I-WANT-TO-TAKE-GOOGLES-OFF-OF-MY-HOME-PAGE': ['2945953', '2945983']});