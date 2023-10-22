import test from 'ava';
import {
  extractProfile,
  extractTrackerActivity,
  extractProject,
  extractIssue,
  extractTopic,
  extractRelease
} from "../../src/index.js";
import { readFileSync } from 'fs';

const data = {
  profile: readFileSync('test/drupal/fixtures/profile.html'),
  tracker: readFileSync('test/drupal/fixtures/tracker.html'),
  project: readFileSync('test/drupal/fixtures/project.html'),
  release: readFileSync('test/drupal/fixtures/release.html'),
  issue: readFileSync('test/drupal/fixtures/issue.html'),
  topic: readFileSync('test/drupal/fixtures/topic.html')
}

test('profile node parsing', async t => {
  const parsed = await extractProfile(data.profile.toString());
  t.not(parsed, undefined);
  t.is(parsed.handle, 'eaton');
  t.is(parsed.name, 'Jeff Eaton');
})

test('tracker list parsing', async t => {
  const parsed = await extractTrackerActivity(data.tracker.toString());
  t.not(parsed, undefined);
  t.is(parsed[0].title, 'Gutenberg');
})

test('project node parsing', async t => {
  const parsed = await extractProject(data.project.toString());
  t.not(parsed, undefined);
})

test('release node parsing', async t => {
  const parsed = await extractRelease(data.release.toString());
  t.not(parsed, undefined);
})

test('issue node parsing', async t => {
  const parsed = await extractIssue(data.issue.toString());
  t.not(parsed, undefined);
})

test('topic node parsing', async t => {
  const parsed = await extractTopic(data.topic.toString());
  t.not(parsed, undefined);
})
