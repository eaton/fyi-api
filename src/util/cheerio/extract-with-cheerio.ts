import { cheerioJsonMapper, getScope, PipeFnMap, JsonTemplate } from 'cheerio-json-mapper'
import * as cheerio from 'cheerio';

export type CheerioExtractTemplate = JsonTemplate;

const pipeFns: PipeFnMap = {
  html: ({ $scope, selector, opts }) => getScope($scope, selector, opts).html(),
  shift: ({ value }) => Array.isArray(value) ? value.shift() : void 0,
  pop: ({ value }) => Array.isArray(value) ? value.pop() : void 0,
  split: ({ value, args }) => {
    if (value !== null && value !== void 0) {
      const [arg1] = args ?? [];
      const joiner = arg1?.toString() ?? ',';
      return value.toString().split(joiner).map(value => value.trim());
    }
    return void 0;
  }
}

type MappedReturn<T extends string | unknown[] | Record<string, unknown>> = 
  T extends string ? unknown : (
    T extends unknown[] ? unknown[] : Record<string, unknown>
  );

export async function extractWithCheerio<T extends string | JsonTemplate>(
  input: string | Buffer | cheerio.AnyNode | cheerio.Cheerio<cheerio.AnyNode>,
  template: T,
): Promise<MappedReturn<T>> {
  const htmlOrNode = (input instanceof Buffer) ? input.toString() : input;
  return cheerioJsonMapper(htmlOrNode, template, { pipeFns })
    .then(results => results as MappedReturn<T>)
}
