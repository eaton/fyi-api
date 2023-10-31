import is from '@sindresorhus/is';
import { Browser, BrowserContext, Page, PageScreenshotOptions, chromium } from 'playwright';
import { BaseImport, BaseImportOptions, Html, CheerioExtractTemplate, uuid} from "../index.js";
import { fileTypeFromBuffer } from 'file-type';
import slugify from '@sindresorhus/slugify';
import humanizeUrl from 'humanize-url';

interface UrlImportOptions extends BaseImportOptions {
  /**
   * A single URL, or a list of named URLs to import in sequence.
   * If multiple URLs are passed in, captured data and screenshots
   * will be placed in a subdirectory based on the name.
   */
  url?: string | string[] | Record<string, string>,
  
  /**
   * An optional callback that, given a Playwright Page object, can perform
   * actions before the page DOM is saved or screenshots are taken.
   * 
   * Returning `false` aborts page capture, returning `true` or returning
   * no value at all allows capture to continue after the action function
   * executes.
   */
  action?: (page: Page) => Promise<boolean | void>

  /**
   * Capture a JPEG or PNG screenshot of the page. If `true`, default Playwright
   * capture options will be used. If an array of `UrlScreenshotOptions` is passed
   * in, one image will be captured for each set of options.
   */
  saveScreenshot?: boolean | UrlScreenshotOptions | UrlScreenshotOptions[],

  /**
   * Save the raw HTTP response data to a JSON file for later use.
   */
  saveRaw?: boolean,
  
  /**
   * Save the raw HTTP response body for later use. (This covers images,
   * JSON responses, etc as well as HTML pages).
   */
  saveBody?: boolean,

  /**
   * If the URL resolves to a renderable page, save the page's rendered DOM
   * as an HTML file.
   */
  saveDom?: boolean,

  /**
   * If the URL resolves to a renderable page, save it to a PDF file.
   */
  savePdf?: boolean | PdfOptions

  /**
   * If the page contains an HTML or XML payload, extract specific data from
   * it using the CheerioExtractor. See the `CheerioExtractTemplate` interface
   * for details.  
   */
  saveData?: CheerioExtractTemplate
}

type PdfOptions = Parameters<Page['pdf']>[0];

interface UrlScreenshotOptions extends PageScreenshotOptions {
  viewport?: {
    height: number,
    width: number,
  },
}

/**
 * Option defaults
 */

const defaults: UrlImportOptions = {
  saveDom: true,
}

const screenshotDefaults: UrlScreenshotOptions = {
  type: 'jpeg'
}

const pdfDefaults: PdfOptions = {
  displayHeaderFooter: false,
}

export class UrlImport extends BaseImport {
  declare options: UrlImportOptions;
  protected browser?: Browser;
  protected context?: BrowserContext;
  protected page?: Page;

  constructor(options: UrlImportOptions) {
    if (options.saveScreenshot === true) {
      options.saveScreenshot = screenshotDefaults;
    } else if (is.plainObject(options.saveScreenshot)) {
      options.saveScreenshot = { ...screenshotDefaults, ...options?.saveScreenshot };
    } else if (is.array(options.saveScreenshot)) {
      options.saveScreenshot = options.saveScreenshot.map(o => { return { ...screenshotDefaults, ...o } });
    }

    if (options.savePdf === true) {
      options.savePdf = pdfDefaults;
    } else if (is.plainObject(options.savePdf)) {
      options.savePdf = { ...pdfDefaults, ...options?.savePdf };
    }

    super({ ...defaults, ...options });
  }


  /**
   * Launches a browser and prepares it for use.
   */
  async setup(): Promise<Page> {
    this.browser ??= await chromium.launch();
    this.context ??= await this.browser.newContext();
    this.page ??= await this.context.newPage();
    return Promise.resolve(this.page);
  }

  /**
   * Disposes of the pages and browser instance used for capture.
   */
  async teardown() {
    return this.page?.close()
      .then(() => this.context?.close())
      .then(() => this.browser?.close())
  }
  
  async fillCache() {
    // Here's where we do the business
    await this.setup();

    if (this.options.url === undefined) {
      return Promise.resolve();
    } else if (is.string(this.options.url)) {
      const name = slugify(humanizeUrl(this.options.url));
      await this.captureUrl(this.options.url, name);
    } else if (is.array<string>(this.options.url)) {
      for (const url of this.options.url) {
        const name = slugify(humanizeUrl(url));
        await this.captureUrl(url, name);
      }
    } else {
      for (const [name, url] of Object.entries(this.options.url)) {
        await this.captureUrl(url, name);
      }
    }
  }

  async captureUrl(url: string, name?: string, options?: UrlImportOptions) {
    const opt = { ...this.options, ...options };
    const page = await this.setup();
    const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 0 });

    if (is.null(response)) {
      this.log(`Couldn't load ${url}`);
      return Promise.resolve();
    }
    
    if (opt.saveBody || opt.saveRaw) {
      const buffer = await response.body();

      if (opt.saveBody) {
        const ft = await fileTypeFromBuffer(buffer);
        const extension = ft?.ext ?? 'bin';
        await this.files.writeCache(`${name ?? 'page'}-body.${extension}`, buffer)
      }
  
      if (opt.saveRaw) {
        const raw = {
          url: response.url(),
          headers: await response.allHeaders(),
          body: buffer.toString(),
        }
        await page.content().then(html => this.files.writeCache(`${name ?? 'page'}-response.json`, raw));
      }
    }
    
    if (opt.action) {
      const result = await opt.action(page);
      if (result === false) {
        this.log(`Action callback aborted import of ${url}`);
        return Promise.resolve();
      }
    }

    if (opt.saveDom) {
      await page.content().then(html => this.files.writeCache(`${name ?? 'page'}-dom.html`, html));
    }

    if (opt.savePdf && opt.savePdf !== true) {
      const buffer = await page.pdf(opt.savePdf);
      await this.files.writeCache(`${name ?? 'page'}.pdf`, buffer);
    }

    if (opt.saveScreenshot && opt.saveScreenshot !== true) {
      const optset = Array.isArray(opt.saveScreenshot) ? opt.saveScreenshot : [opt.saveScreenshot];
      for (const singleOpt of optset) {
        await this.takeScreenshot(singleOpt, name);
      }
    }

    if (opt.saveData) {
      await page.content()
        .then(html => Html.extract(html, opt.saveData!))
        .then(data => this.files.writeCache(`${name ?? 'page'}-data.json`, data));
    }
  }

  async takeScreenshot(options: UrlScreenshotOptions, name?: string) {
    const page = await this.setup();
    
    // this is absolutely terrible, but we need a way to avoid screenshots overwriting each other
    const hash = uuid(options).slice(0,8);
    if (options.viewport) {
      await page.setViewportSize(options.viewport);
    }
    const buffer = await page.screenshot(options);
    return this.files.writeCache(`${name ?? 'page'}.${hash}.${options.type}`, buffer);
  }
}

/**
 * This helper function can be passed in as the action callback when capturing
 * pages from Internet Archive Wayback Machine snapshots. It hides the Wayback
 * navigator bar on screenshots and PDFs.
 */
export async function hideWayback(page: Page): Promise<void> {
  if (!page.url().startsWith('https://web.archive.org/web/')) return Promise.resolve();
  await page.evaluate(() => {
    document.querySelector('#wm-ipp-base')?.remove();
    document.querySelector('#wm-ipp-print')?.remove();
  });
  return Promise.resolve();
}