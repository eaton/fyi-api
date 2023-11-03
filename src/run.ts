import { findUrls } from "./index.js";
const raw = `https://foo.bar.baz
http://www.example.com?hello=foo`;
console.log(findUrls(raw, { humanize: true }));