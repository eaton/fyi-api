import { NormalizedUrl, UrlMutators } from "@autogram/url-tools";
import ky from 'ky';

export interface ResolverOptions {
  normalizer?: false | UrlMutators.UrlMutator,
  known?: StoredResult[],
}

type StoredResult = {
  normalized: string,
  resolved?: string | false,
  status: number,
  message?: string,
};

/**
 * Wrapper class that can build a library of shortened or moved URLs and their
 * 'proper' destinations.
 */
export class UrlResolver {
  known: Map<string, StoredResult>;

  constructor(options: ResolverOptions = {}) {
    if (options.normalizer === undefined) {
      // do nothing here; we just use the fallback
    } else if (options.normalizer === false) {
      NormalizedUrl.normalizer = u => u;
    } else {
      NormalizedUrl.normalizer = options.normalizer;;
    }

    // This is likely to be pretty inefficient. Down the line we'll want to create a
    // database-backed setup or something like that.
    if (options.known) {
      this.known = new Map<string, StoredResult>(options.known.map(sr => [sr.normalized, sr]));
    } else {
      this.known = new Map<string, StoredResult>();
    }
  }

  lookup(url: string) {
    const normalized = new NormalizedUrl(url).href;
    return this.known.get(normalized);
  }
  
  // This WON'T detect anything other than 301 and 302 redirects,
  // unfortunately. META and JS redirects will take additional work.

  async resolve(url: string, base?: URL) {
    const normalized = new NormalizedUrl(url, base).href;
    let output = this.lookup(normalized);

    if (output) {
      return Promise.resolve(output);
    }

    return ky.head(normalized, { throwHttpErrors: false })
      .then(res => {
        output = {
          normalized, 
          resolved: res.url,
          status: res.status,
          message: res.statusText
        }
      })
      .catch((err: unknown) => {
        if (err instanceof Error) {
          output = {
            normalized, 
            status: -1,
            message: err.message
          }
        } else {
          output = { normalized, status: -2 }
        }
      })
      .finally(() => {
        output ??= { normalized, status: -3 };
        this.known.set(normalized, output);
        return output;
      });
  }

  values() {
    return this.known.values();
  }
}