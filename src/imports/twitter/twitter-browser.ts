import { Browser, BrowserContext, Page } from 'playwright';
import { Html, CheerioExtractTemplate, ScrapedTweet, TweetUrl } from '../../index.js';

import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

/**
 * Description placeholder
 */
type TwitterBrowserOptions = {
  stealth?: boolean,

  headless?: boolean,

  template?: CheerioExtractTemplate,

  screenshot?: TwitterScreenshotOptions,

  attemptLogin?: boolean,
}

type TwitterScreenshotOptions = {
  /**
   * The format the screenshot should be taken in
   *
   * @defaultValue 'jpeg'
   */
  format?: 'jpeg' | 'png',

  /**
   * For JPEG format screenshots, the quality of the image
   *
   * @defaultValue 70
   */
  quality?: number,

  /**
   * Take double-resolution screenshots
   *
   * @defaultValue false
   */
  retina?: boolean,

  /**
   * Enforce light or dark mode for screenshot consistency
   *
   * @defaultValue 'light'
   */
  colorScheme?: 'light' | 'dark',

  viewport?: {
    height: number,
    width: number,
  }

  hideFollow?: boolean,
  
  hideActions?: boolean,
}

const browserDefaults: TwitterBrowserOptions = {
  headless: true,
  stealth: true,
  template: {
    name: 'div[data-testid="User-Name"] a | attr:href | substr:1',
    fullname: 'div[data-testid="User-Name"] a | text | split:@ | shift',
    posted: 'a time | attr:datetime',
    text: 'div[data-testid="tweetText"] span | text',
    urls: [{
      $: 'a[href*="t.co"]',
      url: '$ | attr:href',
      label: '$ | attr:aria-label',
      text: '$ | text',
    }],
    media: [{
      $: 'a[href*="/photo/"]',
      url: '$ | attr:href',
      imageUrl: 'img | attr:src',
      alt: 'img | attr:alt'
    }],
    favorites: 'a[href$="/likes"] > div > span',
    retweets: 'a[href$="/retweets"] > div > span',
    quotes: 'a[href$="/retweets/with_comments"] > div > span',
  }
}

const screenshotDefaults: TwitterScreenshotOptions = {
  colorScheme: 'light',
  format: 'jpeg',
  quality: 75,
  retina: false,
  hideActions: true,
  hideFollow: true,
  viewport: { height: 2048, width: 1024 }
}

export class TwitterBrowser {
  protected _browser?: Browser;
  protected _context?: BrowserContext;
  protected _page?: Page;
  protected _options: TwitterBrowserOptions;

  constructor(options: TwitterBrowserOptions = {}) {
    this._options = {
      ...browserDefaults,
      ...options
    };

    this._options.screenshot = {
      ...screenshotDefaults,
      ...options.screenshot
    }
  }

  async teardown() {
    if (this._browser) {
      return this._browser.close();
    }
  }

  async setup(browser?: Browser) {
    if (browser) {
      await this.teardown();
      this._browser = browser;
    } else if (this._browser === undefined) {
      if (this._options.stealth) chromium.use(StealthPlugin());
      this._browser = await chromium.launch({ headless: this._options.headless });
    }
    
    if (this._context === undefined) {
      const { colorScheme, viewport, retina } = this._options.screenshot ?? {};
      this._context = await this._browser!.newContext({
        colorScheme,
        viewport,
        deviceScaleFactor: (retina) ? 2 : undefined
      });
    }

    if (this._page === undefined || this._page.isClosed()) {
      this._page = await this._context.newPage();
      if (this._options.attemptLogin) {
        await this.attemptLogin(this._page);
      }  
    }

    return Promise.resolve(this._page);
  }

  async attemptLogin(page: Page) {
    const ov = page.viewportSize()
    await page.setViewportSize({ width: 1000, height: 1000 });
    page.goto('https://twitter.com/i/flow/login');
    await page.locator('#react-root header').waitFor({ state: 'visible', timeout: 0 });
    if (ov) return page.setViewportSize(ov);
    return Promise.resolve();
  }

  async capture(idOrUrl: string, screenshot?: boolean): Promise<ScrapedTweet> {
    let page = await this.setup();

    const tweet = new TweetUrl(idOrUrl);
  
    const response = await page.goto(tweet.href, { waitUntil: 'domcontentloaded' });
    if (!response?.ok) {
      console.log(response?.url(), response?.status, response?.statusText);
    }

    let results: ScrapedTweet = {
      id: tweet.id,
      url: page.url(),
    }

    await page.locator('main').waitFor({ state: 'visible' });
    // const html = await page.content();
    const errors = [];
    const locator = page.locator('#react-root article');
    const tweetHtml = await locator.first().innerHTML({ timeout: 2000 }).catch((err: unknown) => {
      if (err instanceof Error) {
        errors.push(err.message);
      } else {
        errors.push('Tweet timeout');
      }
      return page.innerHTML('body');
    });

    if (tweetHtml.includes('Try searching for something else.')) errors.push('Tweet deleted.');
    if (tweetHtml.includes('Something went wrong. Try reloading.')) {
      errors.push(page.url(), 'Something went wrong.');
    }

    // Check for error strings on the page; tweets may be deleted or protected.
    if (errors.length) {
      return Promise.resolve({
        success: false,
        ...results,
        errors,
      });
    } else {
      const extracted = await Html.extract(tweetHtml, this._options.template!);

      if (Array.isArray(extracted)) {
        // We shouldn't get here — our template was not, in fact, designed to return multiple results.
        return Promise.reject();
      } else {
        results = {
          success: true,
          ...results,
          ...extracted,
        };

        for (const m of results.media ?? []) {
          if (m.imageUrl) m.imageUrl = fixUrl(m.imageUrl);
        }
      }

      if (screenshot) {
        results.screenshot = await this.screenshot();
        results.screenshotFormat = this._options.screenshot?.format;
      }

      return Promise.resolve({
        success: true,
        ...results,
        ...extracted
      });
    }
  }

  async screenshot(options: TwitterScreenshotOptions = {}) {
    if (this._page === undefined) return Promise.reject();
    const opt = {
      ...screenshotDefaults,
      ...this._options.screenshot,
      ...options
    }

    // TODO: On media tweets, wait for the thumb to load.

    await this._page.evaluate(() => {
      // The top bar, which can cut off the top of long tweets
      document.querySelector('#react-root div[aria-label="Home timeline"] > div:first-child')?.remove();
      if (opt.hideFollow) {
        // The Follow button, which is enormous and blue
        document.querySelector('#react-root article div[role="button"]')?.remove();
      }
      if (opt.hideActions) {
        // The like/retweet/bookmark buttons, which are pointless in a screenshot
        document.querySelectorAll("#react-root div[role=group]")[1]?.remove();
      }
      // The "Don't miss what's happening" banner, which covers up the end of long tweets
      document.querySelector('#react-root #layers')?.remove();
      // The big ol popup dialog
      document.querySelectorAll('#react-root div[role=dialog]')?.forEach(n => n.remove());
    });

    return this._page.locator('#react-root article').screenshot({
      scale: opt.retina ? 'device' : 'css',
      type: opt.format,
      quality: opt.quality
    });
  }
}

function fixUrl(url: string) {
  const u = new URL(url, 'https://twitter.com');
  if (u.hostname === 'pbs.twimg.com') {
    u.pathname += '.' + u.searchParams.get('format');
    u.search = '';
  }
  return u.href;
}