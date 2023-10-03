// import { Medium } from "./index.js";
// 
// const t = new Medium();
// await t.parseArchive();

import { parseWithCheerio } from "./index.js";

const $ = parseWithCheerio('<body><div><span>some text</span></div></body>');
const ex = await $().extract({
  body: 'body | html'
});
console.log(ex);