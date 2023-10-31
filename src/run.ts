import 'dotenv/config';
import { Textile } from './index.js';

const html = Textile.toHtml('Textile integrations are available for "a wide range of platforms":/article/.');
console.log(html);