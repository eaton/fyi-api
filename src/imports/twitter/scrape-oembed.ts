import is from '@sindresorhus/is';
import ky from 'ky';
import { Html, TweetParsedData, changeDate, TweetUrl } from '../../index.js';

type TweetOEmbedResponse = {
  url?: string,
  author_name?: string,
  author_url?: string,
  html?: string,
  type?: string,
  error?: string,
}

/**
 * Description placeholder
 *
 * @param id The URL or ID of a single tweet
 * @returns A promise resolving to the returned data; if the request failed, this will
 * be { status, statusText }. If the request was successful, the returned data will
 * be { status, statusText, url, name, fullname, text, date, urls }.
 */
export async function scrapeTweetOembed(idOrUrl: string) {
  const tweet = new TweetUrl(idOrUrl);
  const r = await ky.get(tweet.oembed, { throwHttpErrors: false });

  let result: TweetParsedData = { id: tweet.id }
  const json = await r.json<TweetOEmbedResponse>().catch(() => { return {} as TweetOEmbedResponse });

  if (r.ok) {
    const parsed = await Html.extractWithCheerio(json.html ?? '', {
      text: 'blockquote.twitter-tweet > p | html',
      date: 'blockquote.twitter-tweet > a | text',
      links: [{
        $: 'blockquote.twitter-tweet > p a',
        text: '$ | text',
        url: '$ | attr:href'
      }],
    });

    if (typeof(parsed.date) == 'string') {
      parsed.date = changeDate(parsed.date, 'LLLL d, yyyy', 'yyyy-MM-dd');
    };

    if (typeof(parsed.text) === 'string' && parsed.text.length > 0) {
      parsed.text = toPlainText(parsed.text);
    } else {
      parsed.text = undefined;
    }

    if (is.emptyArray(parsed.links)) parsed.links = undefined;

    result = {
      ...result,
      url: json.url,
      name: json.url?.split('/')[3],
      fullname: json.author_name?.toString() ?? undefined,
      ...parsed
    };
  } else {
    result.status = r.status;
    result.message = r.statusText;
  }

  return Promise.resolve(result);
}

function toPlainText(html: string) {
  const options: Html.HtmlToTextOptions = {
    decodeEntities: true,
    wordwrap: false,
    selectors: [
      { selector: 'a', options: { ignoreHref: true } },
    ],
  };
  return Html.toText(html, options);
}