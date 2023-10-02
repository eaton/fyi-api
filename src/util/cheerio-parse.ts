import * as cheerio from 'cheerio';
import { cheerioJsonMapper, Options as ExtractOptions, getScope } from 'cheerio-json-mapper';

type ExtractTemplateInput = Parameters<typeof cheerioJsonMapper>[1];
type ExtendedCheerioOptions = Parameters<typeof cheerio.load>[1] & Partial<ExtractOptions>;
type CheerioInput = Parameters<typeof cheerio.load>[0];

declare module 'cheerio' {
  interface Cheerio<T> {
    extract(template: ExtractTemplateInput): Promise<unknown>;
  }
}

/**
 * A simple wrapper for Cheerio's `load` function that injects a number of handy plugins:
 * 
 * `$.extract(template)` shims in the behavior of cheerio's committed-but-not-yet-released
 * bulk property extraction feature. See https://github.com/denkan/cheerio-json-mapper. 
 */
export function cheerioParse(content: CheerioInput, options?: ExtendedCheerioOptions, isDocument?: boolean) {
  options ??= {};
  options.pipeFns ??= {};
  options.pipeFns['html'] = htmlPipe;

  const $ = cheerio.load(content, options, isDocument)

  $.prototype.extract = (template: ExtractTemplateInput) => {
    return cheerioJsonMapper($.root(), template, options);
  }
  
  return $;
}

const htmlPipe = (input: any) => {
  const { $scope, selector, opts } = input;
  return getScope($scope, selector, opts).html();
};
