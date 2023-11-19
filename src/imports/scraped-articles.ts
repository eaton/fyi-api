import { Ids, Html, Urls } from "mangler";
import { BaseImport, BaseImportOptions, ScraperImportOptions } from "./base-import.js";
import { PlaywrightCrawler } from "crawlee";
import * as ss from 'superstruct';

export interface ArticleScraperOptions extends BaseImportOptions, ScraperImportOptions {
  template?: Html.CheerioExtractTemplate,
  images?: boolean | string,
}

const ScrapedArticleSchema = ss.object({
  url: ss.string(),
  date: ss.optional(ss.string()),
  title: ss.optional(ss.string()),
  summary: ss.optional(ss.string()),
  hed: ss.optional(ss.string()),
  dek: ss.optional(ss.string()),
  body: ss.optional(ss.string()),
  tags: ss.optional(ss.array(ss.string())),
  error: ss.optional(ss.string()),
  extra: ss.optional(ss.object()),
});

type ScrapedArticle = ss.Infer<typeof ScrapedArticleSchema>

const defaultTemplate: Html.CheerioExtractTemplate = {
  url: 'head link[rel=canonical] | attr:href',
  title: 'head title',
  summary: 'meta[name=description] | attr:content',
  body: 'body',
}

/**
 * Description placeholder
 */
export class ArticleScraper extends BaseImport<Map<string, ScrapedArticle>> {
  declare options: ArticleScraperOptions;

  constructor(options: ArticleScraperOptions = {}) {
    super(options);
  }

  async loadCache(): Promise<Map<string, ScrapedArticle>> {
    // Load the cache first
    if (!this.cacheData) {
      this.cacheData = new Map<string, ScrapedArticle>();
    }
    
    this.cache.find({ matching: '*.json' })
      .forEach(f => { 
        const json = this.cache.read(f, "auto");
        const article = ss.validate(json, ScrapedArticleSchema)[1];
        if (article) {
          this.cacheData?.set(article.url, article);
        }
      });
    
    // Let the filler check if there are any requested URLs that
    // don't exist in the cache
    await this.fillCache();

    // Return the final cache
    return Promise.resolve(this.cacheData);
  }

  async fillCache(): Promise<Map<string, ScrapedArticle>> {
    if (!this.cacheData) {
      this.cacheData = new Map<string, ScrapedArticle>();
    }
    
    const toScrape: string[] = [];

    // Find any of the incoming urls that aren't in the already-cached data.
    this.input.find({ matching: '*.{csv,txt,tsv}' }).forEach(f => {
      const text = this.input.read(f, "utf8") ?? '';
      Urls.find(text, 'url').map(u => u.href).forEach(u => {
        if (!this.cacheData?.has(u)) toScrape.push(u);
      });
    });

    if (toScrape.length) {
      await this.scrape(toScrape);
    }

    return Promise.resolve(this.cacheData);    
  }

  async scrape(urls: string[]) {
    return new PlaywrightCrawler({
      requestHandler: async (context) => {

        // use Html.extract with the passed-in JSON structure,
        const body = await context.page.content();
        const data = await Html.extract(body, this.options.template ?? defaultTemplate);
        const parsed = ss.validate(data, ScrapedArticleSchema)[1];

        // Then write the data to disk and pop it into the cache
        if (parsed) {
          this.cacheData?.set(context.request.url, parsed);
          this.cache.write(Ids.uuid(context.request.url) + '.json', parsed);
          this.log('Scraped ' + parsed.title);
        } else {
          const err = {
            url: context.request.url,
            error: 'Could not scrape/parse'
          };
          this.cacheData?.set(context.request.url, err);
          this.cache.write(Ids.uuid(context.request.url) + '.json', err);
          this.log(`Couldn't scrape ${context.request.url}`);
        }
        return Promise.resolve();
      }
    }).run(urls);
  }
}