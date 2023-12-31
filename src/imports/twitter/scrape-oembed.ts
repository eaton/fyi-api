import is from '@sindresorhus/is';
import ky from 'ky';
import { ScrapedTweet, TweetUrl } from '../../index.js';
import { Html, Dates } from 'mangler';

type TweetOEmbedResponse = {
  url?: string;
  author_name?: string;
  author_url?: string;
  html?: string;
  type?: string;
  error?: string;
};

/**
 * Description placeholder
 *
 * @param id The URL or ID of a single tweet
 * @returns A promise resolving to the returned data; if the request failed, this will
 * be { status, statusText }. If the request was successful, the returned data will
 * be { status, statusText, url, name, fullname, text, date, urls }.
 */
export async function scrapeTweetOembed(idOrUrl: string) {
  let tweet = new TweetUrl(idOrUrl);
  let result: ScrapedTweet = { id: tweet.id };

  const json = await ky
    .get(tweet.oembed, { throwHttpErrors: false })
    .then((r) => {
      if (r.status === 404) result.deleted = true;
      if (r.status === 403) result.protected = true;
      return r;
    })
    .then((r) =>
      r.json<TweetOEmbedResponse>().catch(() => {
        return {} as TweetOEmbedResponse;
      })
    )
    .catch((err: unknown) => {
      result.status ??= -1;
      if (err instanceof Error) {
        result.errors = [err.message];
      }
      return undefined;
    });

  if (json) {
    const parsed = await Html.extract(json.html ?? '', {
      text: 'blockquote.twitter-tweet > p | html',
      date: 'blockquote.twitter-tweet > a | text',
      urls: [
        {
          $: 'blockquote.twitter-tweet > p a',
          text: '$ | text',
          url: '$ | attr:href'
        }
      ]
    });

    if (typeof parsed.date == 'string') {
      parsed.date = Dates.reformat(parsed.date, 'LLLL d, yyyy', 'yyyy-MM-dd');
    }

    if (typeof parsed.text === 'string' && parsed.text.length > 0) {
      parsed.text = toPlainText(parsed.text);
    } else {
      parsed.text = undefined;
    }

    if (is.emptyArray(parsed.urls)) parsed.urls = undefined;

    result = {
      ...result,
      url: json.url ?? tweet.href,
      handle: json.author_url?.split('/').pop(),
      displayName: json.author_name,
      ...parsed
    };
  }

  return Promise.resolve(result);
}

function toPlainText(html: string) {
  const options: Html.HtmlToTextOptions = {
    decodeEntities: true,
    wordwrap: false,
    selectors: [{ selector: 'a', options: { ignoreHref: true } }]
  };
  return Html.toText(html, options);
}
