import is from '@sindresorhus/is';
import { Browser, BrowserContext, Page } from 'playwright';
import { extractWithCheerio, CheerioExtractTemplate } from '../../index.js';

import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

export type TweetCaptureResult = {
  id: string,
  url?: string,
  success?: boolean,
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
  screenshotFormat?: 'jpeg' | 'png',
  html?: string,
  errors?: string[],
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

  async capture(idOrUrl: string, screenshot?: boolean): Promise<TweetCaptureResult> {
    const page = await this.setup();

    let tweetId: string = '';
    let tweetUser: string = 'twitter';
  
    if (is.numericString(idOrUrl)) {
      tweetId = idOrUrl;
      tweetId = 'twitter';
    } else {
      const parsedUrl = new URL(idOrUrl);
      tweetId = parsedUrl.pathname.split('/')[3];
      tweetUser = parsedUrl.pathname.split('/')[1];
    }
    const url = `https://twitter.com/${tweetUser}/status/${tweetId}`;
    await page.goto(url);

    let results: TweetCaptureResult = {
      id: tweetId,
      url: page.url(),
    }

    await page.locator('main').waitFor({ state: 'visible' });
    console.log(`Got main for ${url}`)

    const html = await page.content();
    
    const errors = await page.locator('#react-root div[data-testid="error-detail"] span').allInnerTexts();

    // Check for error strings on the page; tweets may be deleted or protected.
    if (errors.length) {
      console.log(`Error text for ${url}`)
      return Promise.resolve({
        success: false,
        ...results,
        html,
        errors,
      });
    } else {
      const locator = page.locator('#react-root article');
      const extracted = await locator.innerHTML()
        .then(html => extractWithCheerio(html, this._options.template!) as Partial<TweetCaptureResult>);
      
        console.log(`extracted ${url}`)

        if (screenshot) {
        await page.evaluate(() => {
          // The top bar, which can cut off the top of long tweets
          document.querySelector('#react-root div[aria-label="Home timeline"] > div:first-child')?.remove();

          // The Follow button, which is enormous and blue
          document.querySelector('#react-root article div[role="button"]')?.remove();

          // The like/retweet/bookmark buttons, which are pointless in a screenshot
          document.querySelectorAll("#react-root div[role=group]")[1]?.remove();

          // The "Don't miss what's happening" banner, which covers up the end of long tweets
          document.querySelector('#react-root #layers')?.remove();

          // The big ol popup dialog
          document.querySelectorAll('#react-root div[role=dialog]')?.forEach(n => n.remove());
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
  }
}