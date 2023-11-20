import { quickScrape } from "./util/quick-scrape.js";
import { Disk, Html, Text, Markdown } from "mangler";

// https://alistapart.com/article/battle-for-the-body-field/
// https://www.smashingmagazine.com/2013/06/controlling-presentation-in-structured-content/

type article = {
  url: string,
  date: Date,
  title: string,
  summary?: string,
  body: string,
  tags?: string[],
  comments?: number,
}

