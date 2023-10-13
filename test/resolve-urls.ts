import test from 'ava';
import { UrlResolver } from '../src/index.js';

const r = new UrlResolver();

test('caching', async t => {
  t.assert(r.lookup('https://t.co/oqGcLJ3drM') === undefined, "fresh url can't be looked up");
  await r.resolve('https://t.co/oqGcLJ3drM');
  t.assert(r.lookup('https://t.co/oqGcLJ3drM') !== undefined, 'seen url can be looked up');
})

test('dead domains', async t => {
  const result = await r.resolve('https://domain-that-does-not-exist.zzz');
  t.is(result?.status, -1, 'dead hostname generates -1 status');
})

test('redirects', async t => {
  const result = await r.resolve('https://nghttp2.org/httpbin/absolute-redirect/5');
  t.is(result?.redirects?.length, 4, 'all redirects accounted for');
})
