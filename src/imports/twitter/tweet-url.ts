import is from '@sindresorhus/is';

/**
 * A convenience wrapper for individual Tweet URLs
 */
export class TweetUrl extends URL {
  constructor(idOrUrl: string, name?: string) {
    let id = idOrUrl;
    if (is.numericString(idOrUrl)) {
      // We handle defaulting the name to 'twitter' later
    } else if (idOrUrl.includes('/i/web/status/')) {
      id =
        idOrUrl.match(/^https?\:\/\/twitter.com\/i\/web\/status\/(\d+)/)?.[1] ??
        '';
    } else if (idOrUrl.includes('/status/')) {
      const match = idOrUrl.match(
        /^https?\:\/\/twitter.com\/([a-zA-Z0-9_-]+)\/status\/(\d+)/
      );
      if (match) {
        name ??= match[1];
        id = match[2];
      }
    } else {
      throw new TypeError('Not a valid tweet URL');
    }
    super(`/${name ?? 'twitter'}/status/${id}`, 'https://twitter.com');
  }

  get id(): string {
    return this.pathname.split('/')[3];
  }
  set id(id: string) {
    const parts = this.pathname.split('/');
    parts[3] = id;
    this.pathname = parts.join('/');
  }

  get name() {
    return this.pathname.split('/')[1];
  }
  set name(name: string) {
    const parts = this.pathname.split('/');
    parts[1] = name;
    this.pathname = parts.join('/');
  }

  get oembed() {
    const oEmbedUrl = new URL('https://publish.twitter.com/oembed');
    oEmbedUrl.searchParams.set('url', this.href);
    oEmbedUrl.searchParams.set('omit_script', 't');
    return oEmbedUrl.href;
  }
}
