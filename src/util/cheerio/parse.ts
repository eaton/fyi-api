import * as cheerio from 'cheerio';
type CheerioInput = Parameters<typeof cheerio.load>[0];

/**
 * A simple wrapper for Cheerio's `load` function
 */
export function parseWithCheerio(content: CheerioInput, options?: cheerio.CheerioOptions, isDocument?: boolean) {
  const $ = cheerio.load(content, options, isDocument)

  // Here's where we would add custom plugins and other fun stuff.
  
  return $;
}
