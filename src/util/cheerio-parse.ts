import * as cheerio from 'cheerio';
import { cheerioJsonMapper, Options as ExtractOptions, getScope, PipeFn } from 'cheerio-json-mapper';

type ExtractTemplateInput = Parameters<typeof cheerioJsonMapper>[1];
type ExtendedCheerioOptions = Parameters<typeof cheerio.load>[1] & Partial<ExtractOptions>;
type CheerioInput = Parameters<typeof cheerio.load>[0];

declare module 'cheerio' {
  interface Cheerio<T> {
    extract<T = Record<string, unknown> | unknown[]>(template: ExtractTemplateInput): Promise<T>;
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
  const pipeFns: Record<string, PipeFn> = {
    ...options.pipeFns ?? {},
    html: (input: any) => {
      const { $scope, selector, opts } = input;
      return getScope($scope, selector, opts).html();
    },
    split: ({ value, args }) => {
      if (value !== null && value !== void 0) {
        const [arg1] = args ?? [];
        const joiner = arg1?.toString() ?? ',';
        return value.toString().split(joiner).map(value => value.trim());
      }
      return void 0;
    },
    shift: ({ value }) => Array.isArray(value) ? value.shift() : void 0,
    pop: ({ value }) => Array.isArray(value) ? value.pop() : void 0,
  }

  options.pipeFns = {
    ...options.pipeFns ?? {},
    ...pipeFns
  };

  const $ = cheerio.load(content, options, isDocument)

  $.prototype.extract = (template: ExtractTemplateInput) => {
    return cheerioJsonMapper($.root(), template, options);
  }
  
  return $;
}
