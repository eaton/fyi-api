import { QuickScrapeOptions, quickScrape } from "./util/quick-scrape.js";
// import { Disk, Html, Text, Markdown } from "mangler";

const pages: Record<string, QuickScrapeOptions> = {
  "https://alistapart.com/article/battle-for-the-body-field/": {

  },
  "https://www.smashingmagazine.com/2013/06/controlling-presentation-in-structured-content/": {

  }
} 

export type article = {
  url: string,
  date: Date,
  title: string,
  summary?: string,
  body: string,
  tags?: string[],
  comments?: number,
}

for (const [url, options] of Object.entries(pages)) {
  await quickScrape(url, options);
}