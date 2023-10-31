import 'dotenv/config';
import { toPortableText, simpleStyledTextSchema } from './index.js';

console.log(JSON.stringify(toPortableText(
  '![alt text](https://example.com/image.jpeg)',
  { markdown: true, schema: simpleStyledTextSchema() }), undefined, 2));