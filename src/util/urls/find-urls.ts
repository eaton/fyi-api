import { FoundUrl } from "../index.js";
import urlRegex from 'url-regex';
import humanizeUrl from "humanize-url";
import { Html } from 'mangler';

type Options = {
  mode?: 'text' | 'html',
  baseUrl?: string,
  humanize?: boolean,
}

export function findUrls(input: string, options: Options = {}) {
  let urls: FoundUrl[] = [];
  if (options.mode === 'html') {
    const $ = Html.toCheerio(input);
    $('[href]').toArray().forEach(e => {
      const url: FoundUrl = {
        url: options.baseUrl ? new URL($(e).attr('href') ?? '', options.baseUrl).href : $(e).attr('href'),
        text: $(e).text(),
        title: $(e).attr('title') 
      }
      urls.push(url);
    });
  } else {
    for (const m of input.matchAll(urlRegex())) {
      urls.push({ url: m.toString() });
    }
  }

  if (options.humanize) {
    urls = urls.map(u => {
      return {
        ...u,
        title: u.title ? u.title : humanizeUrl(u.url ?? '')
      }
    })
  }

  return urls;
}