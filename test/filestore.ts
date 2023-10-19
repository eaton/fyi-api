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
  const fs = new Filestore({ base: 'base' });
  const filename = 'test.txt';

  t.is(fs.getPath(filename), path.join('base', filename));
  t.is(fs.getInputPath(filename),  path.join('base', 'input', filename));
  t.is(fs.getCachePath(filename),  path.join('base', 'cache', filename));
  t.is(fs.getOutputPath(filename), path.join('base', 'output', filename));
})

test('basepath with bucket prefix', async t => {
  const fs = new Filestore({ base: 'base', bucket: 'bucket' });
  const filename = 'test.txt';

  t.is(fs.getPath(filename), path.join('base', filename));
  t.is(fs.getInputPath(filename),  path.join('base', 'input', 'bucket', filename));
  t.is(fs.getCachePath(filename),  path.join('base', 'cache', 'bucket', filename));
  t.is(fs.getOutputPath(filename), path.join('base', 'output', 'bucket', filename));
})
