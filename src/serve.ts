import 'dotenv/config';
import { Filestore } from './index.js';

import { captureTweets } from './imports/twitter/scrape.js';

const f = new Filestore({ cache: 'storage' });

const process = true;
if (process) {
  const testTweets = [
    '841652377841209345',   // Simple text tweet, second in a thread
    '1666840107452620803',  // Tweet with url embed, first in a thread
    '1624448832607068164',  // Standalone, multiple media, with alt
    '1604694281234546689',  // Orphaned thread child; interim tweet deleted; interim tweet by different user,
    '1467915664459538436',  // Four photos with alt
  ];

  const results = await captureTweets(testTweets, { screenshot: true });
  for (const t of results) {
    if (t.success) {
      const { screenshot, success, ...json } = t;
      if (t.screenshot) await f.writeCache(`screenshots/tweet-${t.id}.${t.screenshotFormat}`, t.screenshot);
      f.writeCache(`favorites/favorite-${json.id}.json`, json);
    }
  }
}
