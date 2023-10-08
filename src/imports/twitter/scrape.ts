import ky from 'ky';
import { Browser, Page } from 'playwright';
import { Html, changeDate, extractWithCheerio } from '../../index.js';

import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';


/**
 * Twitter has become increasingly agressive about moving any automated
 * traffic to its API, and (coincidentally) increasing the API usage rates
 * by a factor of 10 or more. So, here we are — still scraping to get
 * certain data.
 * 
 * There are two main approaches used here:
 * 
 * - Load a copy of headless Chrome and control it using Playwright.
 *   Log network traffic to get the raw data goodness, scrape the DOM
 *   to extract anything necessary, and generate screenshots to
 *   preserve stuff that's likely to vanish behind paywalls or service
 *   failure.
 * 
 * - Hit the OEmbed endpoint at publish.twitter.com that's used for
 *   'tweet embedding' and twase out the important bits. This doesn't
 *   us as much information as some techniques, but it's particularly
 *   effective at getting some basic metadata for favorites.
 */

type TweetOembedData = Record<string, unknown> & {
  url: string,
  author_name: string,
  html: string,
  type: string,
}

export function getTweetUrl(id: string, name = 'twitter') {
  return `https://twitter.com/${name}/status/${id}`;
}

/**
 * Description placeholder
 *
 * @param id The ID of a single tweet
 * @returns A promise resolving to the returned data; if the request failed, this will
 * be { status, statusText }. If the request was successful, the returned data will
 * be { status, statusText, url, name, fullname, text, date, urls }.
 */
export async function scrapeTweet(id: string) {
  const embedUrl = new URL('https://publish.twitter.com/oembed');
  embedUrl.searchParams.set('url', getTweetUrl(id));

  const r = await ky.get(embedUrl, { throwHttpErrors: false });
  
  let result: Record<string, unknown> = {
    status: r.status,
    statusText: r.statusText,
  };

  if (r.ok) {
    const json: TweetOembedData = await r.json();

    const parsed = await Html.extractWithCheerio(json.html, {
      text: 'blockquote.twitter-tweet > p | text',
      date: 'blockquote.twitter-tweet > a | text',
      urls: [{
        '$': 'blockquote.twitter-tweet > p',
        text: '> a | text',
        url: '> a | attr:href'
      }],
    });

    if (typeof(parsed.date) == 'string') {
      parsed.date = changeDate(parsed.date, 'LLLL d, yyyy', 'yyyy-MM-dd');
    };

    result = {
      ...result,
      url: json.url,
      name: json.url.split('/')[3],
      fullname: json.author_name,
      ...parsed
    };
  }

  return Promise.resolve(result);
}

type TweetCaptureOptions = {
  screenshot?: boolean,
  screenshotFormat?: 'jpeg' | 'png',
  page?: Page;
}

type TweetCaptureResult = {
  id: string,
  success: false
} | {
  id: string,
  success: true,
  name?: string,
  fullname?: string,
  date?: string,
  text?: string,
  media?: unknown[],
  links?: unknown[],
  favorites?: string,
  retweets?: string,
  quotes?: string,
  screenshot?: Buffer
  screenshotFormat?: 'jpeg' | 'png'
}

/**
 * A more resource-intensive scraping method that uses a headless browser to load
 * the tweet and parse out individual variables. This is currently the only way
 * to retrieve the alt text for tweet media, aside from dropping $100-$5000/mo
 * on a paid Twitter Developer Account.
 */
export async function captureTweets(id: string | string[], options: TweetCaptureOptions = {}) {
  let browser: Browser | undefined = undefined;
  const ids = Array.isArray(id) ? id : [id];
  const results: TweetCaptureResult[] = [];

  if (!options.page) {
    // Running in headless is deeply annoying, but it'll have to do.
    chromium.use(StealthPlugin());
    browser = await chromium.launch();
    const context = await browser.newContext({

      colorScheme: 'light',
      viewport: { width: 1028, height: 2048 },
      deviceScaleFactor: 2,
    });
    options.page = await context.newPage();
  }

  for (const tweet of ids) {
    const result = await _captureTweet(tweet, options);
    results.push(result);
  }

  if (browser) {
    await browser.close();
  }

  return Promise.resolve(results);
}

/**
 * Given a Playwright Page with a single tweet, return a screen capture pre-cropped
 * to the tweet itself.
 * 
 * All of our logic for making tweets presentable lives here; it takes in a handle
 * to the already-loaded tweet page, removes a handful of DOM elements that can bork
 * the screenshot, then does the capture and returns a buffer to the image.
 */
async function _captureTweet(id: string, options: TweetCaptureOptions): Promise<TweetCaptureResult> {
  const url = getTweetUrl(id);
  let result: TweetCaptureResult | undefined;

  if (!options.page) return Promise.resolve({ id, success: false });
  const page = options.page;
  await page.goto(url);

  if (page.url() === 'https://twitter.com') {
    result = { id, success: false };
  } else {
    result = { id, success: true };
  
    const locator = page.locator('#react-root article');
    await locator.isVisible()
    await locator.scrollIntoViewIfNeeded();

    if (options.screenshot) {
      await page.evaluate(() => {
        // Remove the 'follow' button
        document.querySelector('#react-root article div[role="button"]')?.remove();

        // Remove the "Don't miss what's happening" banner
        document.querySelector("#layers")?.remove();

        // Finally, hide the like/retweet/bookmark buttons
        document.querySelectorAll("div[role=group]")[1]?.remove();
      });

      result.screenshot = await locator.screenshot({
        scale: 'device',
        type: options.screenshotFormat,
      });
      result.screenshotFormat = options.screenshotFormat ?? 'jpeg';
    }

    const extracted = await locator.innerHTML()
      .then(html => {
        return extractWithCheerio(html, tweetExtractionTemplate) as Partial<TweetCaptureResult>
      });

    result = { ...result, ...extracted };
  }

  return Promise.resolve(result!); 
}

const tweetExtractionTemplate = {
  name: 'div[data-testid="User-Name"] a | attr:href | substr:1',
  fullname: 'div[data-testid="User-Name"] a | text | split:@ | shift',
  posted: 'a time | attr:datetime',
  text: 'div[data-testid="tweetText"] span | text',
  links: [{
    $: 'a[href*="t.co"]',
    href: '$ | attr:href',
    title: '$ | attr:aria-label',
    text: '$ | text',
  }],
  media: [{
    $: 'a[href*="/photo/"]',
    href: '$ | attr:href',
    src: 'img | attr:src',
    alt: 'img | attr:alt'
  }],
  favorites: 'a[href$="/likes"] > div > span',
  retweets: 'a[href$="/retweets"] > div > span',
  quotes: 'a[href$="/retweets/with_comments"] > div > span',
};