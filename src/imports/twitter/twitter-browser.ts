import { Browser, BrowserContext, Page } from 'playwright';
import { extractWithCheerio, CheerioExtractTemplate, TweetParsedData, TweetUrl } from '../../index.js';

import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

/**
 * Description placeholder
 */
type TwitterBrowserOptions = {
  stealth?: boolean,

  headless?: boolean,

  template?: CheerioExtractTemplate,

  screenshot?: TwitterScreenshotOptions
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

  static defaultExtractionTemplate: CheerioExtractTemplate = {
  };

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

    if (this._page === undefined) {
      this._page = await this._context.newPage();
    }
    return Promise.resolve(this._page);
  }

  async capture(idOrUrl: string, screenshot?: boolean): Promise<TweetParsedData> {
    const page = await this.setup();
    const tweet = new TweetUrl(idOrUrl);
  
    await page.goto(tweet.href);

    let results: TweetParsedData = {
      id: tweet.href,
      url: page.url(),
    }

    await page.locator('main').waitFor({ state: 'visible' });
    const html = await page.content();
    const errors = await page.locator('#react-root div[data-testid="error-detail"] span').allInnerTexts();

    // Check for error strings on the page; tweets may be deleted or protected.
    if (errors.length) {
      return Promise.resolve({
        success: false,
        ...results,
        html,
        errors,
      });
    } else {
      const locator = page.locator('#react-root article');
      let extracted = await locator.innerHTML().then(html => extractWithCheerio(html, this._options.template!));

      if (Array.isArray(extracted)) {
        // We shouldn't get here — our template was not, in fact, designed to return multiple results.
        return Promise.reject();
      } else {
        results = {
          success: true,
          ...results,
          ...extracted,
        };
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
