import * as cheerio from 'cheerio';
import { cheerioJsonMapper, JsonTemplate, Options as ExtractOptions } from './extract.js';

type ExtendedCheerioOptions = Parameters<typeof cheerio.load>[1] & Partial<ExtractOptions>;
type CheerioInput = Parameters<typeof cheerio.load>[0];

declare module 'cheerio' {
  interface Cheerio<T> {
    extract(template: JsonTemplate): unknown;
  }
}

/**
 * A simple wrapper for Cheerio's `load` function that injects a handy plugins:
 * 
 * `$.extract(template)` shims in the behavior of cheerio's committed-but-not-yet-released
 * bulk property extraction feature. See https://github.com/denkan/cheerio-json-mapper. 
 */
export function parseWithCheerio(content: CheerioInput, options?: ExtendedCheerioOptions, isDocument?: boolean) {
  const $ = cheerio.load(content, options, isDocument)

  $.prototype.extract = function(template: JsonTemplate, options?: ExtractOptions) {
    return cheerioJsonMapper($.root(), template, options);
  };

  return $;
}
