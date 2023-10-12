import t from 'tap';
import { UrlResolver } from '../src/index.js';

const r = new UrlResolver();

t.test('caching', async t => {
  t.ok(r.lookup('https://t.co/oqGcLJ3drM') === undefined, "fresh url can't be looked up");
  await r.resolve('https://t.co/oqGcLJ3drM');
  t.ok(r.lookup('https://t.co/oqGcLJ3drM') !== undefined, 'seen url can be looked up');
  t.end();
})

t.test('dead domains', async t => {
  const result = await r.resolve('https://domain-that-does-not-exist.zzz');
  t.equal(result?.status, -1, 'dead hostname generates -1 status');
  t.end()
})

t.test('redirects', async t => {
  const result = await r.resolve('https://nghttp2.org/httpbin/absolute-redirect/5');
  t.equal(result?.redirects?.length, 4, 'all redirects accounted for');
  t.end();
})
