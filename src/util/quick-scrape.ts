import { Html } from 'mangler';
import { launchPlaywright } from 'crawlee';

export interface QuickScrapeOptions {
  screenshot?: boolean,
  template?: Html.CheerioExtractTemplate,
  browser?: boolean,
};

export type QuickScrapeResults = {
  data: Record<string, unknown> | Record<string, unknown>[],
  success: true
} | {
  error?: Error,
  success: false
}

export async function quickScrape(url: string, options: QuickScrapeOptions = {}): Promise<QuickScrapeResults> {
  const browser = await launchPlaywright();
  const page = await browser.newPage();

  await page.goto(url);

  return Promise.resolve({ success: false })
}
