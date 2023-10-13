import test from 'ava';
import { TweetUrl } from '../src/index.js';

test('bad url', t => {
  t.throws(() => new TweetUrl("https://twitter.com/some-borked-url"));
})

test('plain id', t => {
  const turl = new TweetUrl("12345");
  t.is(turl.id, "12345");
  t.is(turl.name, "twitter");
  t.is(turl.href, 'https://twitter.com/twitter/status/12345');
})

test('plain id with name', t => {
  const turl = new TweetUrl("12345", "username");
  t.is(turl.id, "12345");
  t.is(turl.name, "username");
  t.is(turl.href, 'https://twitter.com/username/status/12345');
})

test('plain url', t => {
  const turl = new TweetUrl("https://twitter.com/username/status/12345");
  t.is(turl.id, "12345");
  t.is(turl.name, "username");
  t.is(turl.href, 'https://twitter.com/username/status/12345');
})

test('url with name', t => {
  const turl = new TweetUrl("https://twitter.com/twitter/status/12345", "username");
  t.is(turl.id, "12345");
  t.is(turl.name, "username");
  t.is(turl.href, 'https://twitter.com/username/status/12345');
})

test('web url', t => {
  const turl = new TweetUrl("https://twitter.com/i/web/status/12345");
  t.is(turl.id, "12345");
  t.is(turl.name, "twitter");
  t.is(turl.href, 'https://twitter.com/twitter/status/12345');
})

test('web url with name', t => {
  const turl = new TweetUrl("https://twitter.com/i/web/status/12345", "username");
  t.is(turl.id, "12345");
  t.is(turl.name, "username");
  t.is(turl.href, 'https://twitter.com/username/status/12345');
})

test('alter values', t => {
  const turl = new TweetUrl("https://twitter.com/i/web/status/12345");
  turl.name = "username";
  turl.id = "09876"
  t.is(turl.id, "09876");
  t.is(turl.name, "username");
  t.is(turl.href, 'https://twitter.com/username/status/09876');
})
