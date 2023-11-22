import { Html } from 'mangler';
import { launchPlaywright } from 'crawlee';

export interface QuickScrapeOptions {
  screenshot?: boolean,
  template?: Html.CheerioExtractTemplate,
};

export type QuickScrapeResults = {
  data: Record<string, unknown> | unknown[],
  screenshot?: Buffer,
  success: true
} | {
  error?: Error,
  success: false
}

const defaultTemplate: Html.CheerioExtractTemplate = {
  canonical: 'head link[rel=canonical] | attr:href',
  title: 'title',
  description: 'head meta[name=description] | attr:content',
  body: 'body | html',
}

export async function quickScrape(url: string, options: QuickScrapeOptions = {}): Promise<QuickScrapeResults> {
  let output: QuickScrapeResults = { success: false };

  const browser = await launchPlaywright();
  const page = await browser.newPage();

  await page.goto(url);
  const content = await page.content();

  if (content.length > 0) {
    output = {
      data: await Html.extract(content, options.template ?? defaultTemplate),
      success: true
    }

    if (options.screenshot) {
      output.screenshot = await page.screenshot({
        type: 'jpeg',
        quality: 90,
      })
    }
  }

  return browser.close().then(() => output);
}
