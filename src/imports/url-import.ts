import { Browser, BrowserContext, Page } from 'playwright';
import { BaseImport, BaseImportOptions, extractWithCheerio, CheerioExtractTemplate} from "../index.js";

interface UrlImportOptions extends BaseImportOptions {
  /**
   * A single URL, or a list of named URLs to import in sequence.
   * If multiple URLs are passed in, captured data and screenshots
   * will be placed in a subdirectory based on the name.
   */
  url?: string | Record<string, string>,
  
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
  screenshot?: boolean | UrlScreenshotOptions | UrlScreenshotOptions[],

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
  savePage?: boolean,

  /**
   * If the page contains an HTML or XML payload, extract specific data from
   * it using the CheerioExtractor. See the `CheerioExtractTemplate` interface
   * for details.  
   */
  savePageData?: CheerioExtractTemplate
}

interface UrlScreenshotOptions {
  viewport?: {
    height: number,
    width: number,
    scale?: number,
  },
  format: 'jpeg' | 'png',
}

export class UrlImport extends BaseImport {

}