import is from '@sindresorhus/is';

/**
 * A convenience wrapper for individual Tweet URLs
 */
export class TweetUrl extends URL {
  constructor(idOrUrl: string, name?: string) {
    let id = idOrUrl;
    if (is.numericString(idOrUrl)) {
      name = 'twitter';
    } else if (idOrUrl.includes('/i/web/status/')) {
      name = 'twitter';
      id = idOrUrl.match(/^https?\:\/\/twitter.com\/i\/web\/status\/(\d+)/)?.[1] ?? '';  
    } else if (idOrUrl.includes('/status/')) {
      [name, id] = idOrUrl.match(/^https?\:\/\/twitter.com\/([a-zA-Z0-9_-]+)\/status\/(\d+)/)?.slice(1,3) ?? [];  
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