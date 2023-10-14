import { NormalizedUrl, UrlMutators } from "@autogram/url-tools";
import got from "got";
// import ky from 'ky';

export interface ResolverOptions {
  normalizer?: false | UrlMutators.UrlMutator,
  known?: ResolvedUrl[],
  timeout?: number
}

export type ResolvedUrl = {
  normalized: string,
  resolved?: string | false,
  status?: number,
  message?: string,
  redirects?: string[]
};

/**
 * Wrapper class that can build a library of shortened or moved URLs and their
 * 'proper' destinations.
 */
export class UrlResolver {
  known: Map<string, ResolvedUrl>;
  timeout: number;

  constructor(options: ResolverOptions = {}) {
    if (options.normalizer === undefined) {
      // do nothing here; we just use the fallback
    } else if (options.normalizer === false) {
      NormalizedUrl.normalizer = u => u;
    } else {
      NormalizedUrl.normalizer = options.normalizer;;
    }

    this.timeout = options.timeout ?? 5000;

    // This is likely to be pretty inefficient. Down the line we'll want to create a
    // database-backed setup or something like that.
    if (Array.isArray(options.known)) {
      this.known = new Map<string, ResolvedUrl>(options.known.map(sr => [sr.normalized, sr]));
    } else {
      this.known = new Map<string, ResolvedUrl>();
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

    output = {
      normalized, 
      resolved: undefined,
      status: undefined,
      message: undefined,
      redirects: [],
    }    

    return got.head(normalized, {
      throwHttpErrors: false,
      followRedirect: true,
      timeout: { request: this.timeout },
      hooks: {
        beforeRedirect: [
          (options) => {
            // This allows us to queue up all of the redirects we encounter, even if
            // a domain fails to resolve.
            if ('url' in options && options.url instanceof URL) {
              output?.redirects?.push(options.url.toString());
            }
          }
        ]
      }
    })
    .then(res => {
      output!.resolved = output?.redirects?.pop() ?? res.url;
      output!.status = res.statusCode;
      output!.message = res.statusMessage;
      if (output?.redirects?.length === 0) output!.redirects = undefined;
      this.known.set(normalized, output!);
      return output;
    })
    .catch((err: unknown) => {
      if (err instanceof Error) {
        output!.resolved = output?.redirects?.pop() ?? output?.normalized;
        output!.status = -1;
        output!.message = err.message;
        if (output?.redirects?.length === 0) output!.redirects = undefined;
      } else {
        output!.status = -2;
      }
      this.known.set(normalized, output!);
      return output;
    });
  }

  values() {
    return this.known.values();
  }
}