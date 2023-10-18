import test from 'ava';
import path from 'path';
import { Filestore } from "../src/index.js";


test('bucketing', async t => {
  const fs = new Filestore();

  const filename = 'test.txt';
  t.is(fs.getPath(filename), filename);
  t.is(fs.getInputPath(filename),  path.join('input', filename));
  t.is(fs.getCachePath(filename),  path.join('cache', filename));
  t.is(fs.getOutputPath(filename), path.join('output', filename));
})

test('custom basepath', async t => {
  const oldBase = Filestore.base;
  Filestore.base = 'custom';
  const fs = new Filestore();

  const filename = 'test.txt';
  t.is(fs.getPath(filename), path.join('custom', filename));
  t.is(fs.getInputPath(filename),  path.join('custom', 'input', filename));
  t.is(fs.getCachePath(filename),  path.join('custom', 'cache', filename));
  t.is(fs.getOutputPath(filename), path.join('custom', 'output', filename));

  Filestore.base = oldBase;
})

