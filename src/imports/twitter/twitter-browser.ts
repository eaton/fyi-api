import is from '@sindresorhus/is';
import { Browser, BrowserContext, Page } from 'playwright';
import { extractWithCheerio, CheerioExtractTemplate } from '../../index.js';

import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

type TweetCaptureResult = {
  id: string,
  url?: string,
  success: false,
  html?: string,
  errors?: string[],
} | {
  id: string,
  url?: string,
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
 * Description placeholder
 */
type TwitterBrowserOptions = {
  stealth?: boolean,

  headless?: boolean,

  template?: CheerioExtractTemplate,

  screenshot?: {
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
    colorScheme?: 'light' | 'dark'
  }
}

export class TwitterBrowser {
  protected _browser?: Browser;
  protected _context?: BrowserContext;
  protected _page?: Page;
  protected _options: TwitterBrowserOptions;

  static defaultExtractionTemplate: CheerioExtractTemplate = {
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

  constructor(options: TwitterBrowserOptions = {}) {
    this._options = {
      stealth: true,
      headless: true,
      template: TwitterBrowser.defaultExtractionTemplate,
      ...options
    };

    this._options.screenshot ??= {
      format: 'jpeg',
      quality: 75,
      colorScheme: 'light',
      retina: false,
      ...options.screenshot ?? {}
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
      this._context = await this._browser!.newContext({
        colorScheme: this._options.screenshot?.colorScheme ? this._options.screenshot.colorScheme : undefined,
        viewport: this._options.screenshot?.retina ? { width: 1024, height: 2048 } : undefined,
        deviceScaleFactor: (this._options.screenshot && this._options.screenshot.retina) ? 2 : undefined
      });  
    }

    if (this._page === undefined) {
      this._page = await this._context.newPage();
    }
    return Promise.resolve(this._page);
  }

  async capture(idOrUrl: string, screenshot: boolean) {
    const page = await this.setup();

    let tweetId: string = '';
    let tweetUser: string = 'twitter';
  
    if (is.numericString(idOrUrl)) {
      tweetId = idOrUrl;
      tweetId = 'twitter';
    } else {
      const parsedUrl = new URL(idOrUrl);
      tweetId = parsedUrl.pathname.split('/')[2];
      tweetUser = parsedUrl.pathname.split('/')[0];
    }
    const url = `https://twitter.com/${tweetUser}/status/${tweetId}`;
    await page.goto(url);

    let results: Partial<TweetCaptureResult> = {
      id: tweetId,
      url: page.url(),
    }
    const html = await page.content();
    
    // Check for error strings on the page; tweets may be deleted or protected.
    if (html.includes('error')) {
      results = {
        success: false,
        ...results,
        html,
        errors: ["The tweet couldn't be loaded."],
      };
    } else {
      const locator = page.locator('#react-root article');
      const extracted = await locator.innerHTML()
        .then(html => extractWithCheerio(html, this._options.template!) as Partial<TweetCaptureResult>);

      if (screenshot) {
        await page.evaluate(() => {
          // The top bar, which can cut off the top of long tweets
          document.querySelector('#react-root article div[aria-label="Home Timeline"]')?.remove();
          // The Follow button, which is enormous and blue
          document.querySelector('#react-root article div[role="button"]')?.remove();
          // The "Don't miss what's happening" banner, which covers up the end of long tweets
          document.querySelector("#layers")?.remove();
          // The like/retweet/bookmark buttons, which are pointless in a screenshot
          document.querySelectorAll("div[role=group]")[1]?.remove();
        });
  
        const screenshot = await locator.screenshot({
          scale: 'device',
          type: this._options.screenshot?.format,
        });

        results = {
          success: true,
          ...results,
          ...extracted,
          screenshot,
          screenshotFormat: this._options.screenshot?.format
        };
      }
      return Promise.resolve({
        success: true,
        ...results,
        ...extracted
      });
    }

    return Promise.resolve(results);
  }
}