import ky from 'ky';
import is from '@sindresorhus/is';
import { Html, changeDate } from '../../index.js';

type TweetOEmbedResponse = {
  url: string,
  author_name: string,
  html: string,
  type: string,
}

type TweetOembedData = Record<string, unknown> & {
  id: string,
  url?: string,
  name?: string,
  fullname?: string,
  text?: string,
  date?: string,
  urls?: { text?: string, url: string }[],
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
export async function scrapeTweetOembed(tweet: string) {
  let tweetId: string = '';
  let tweetUser: string = 'twitter';

  if (is.numericString(tweet)) {
    tweetId = tweet;
    tweetId = 'twitter';
  } else {
    const parsedUrl = new URL(tweet);
    tweetId = parsedUrl.pathname.split('/')[2];
    tweetUser = parsedUrl.pathname.split('/')[0];
  }

  const embedUrl = new URL('https://publish.twitter.com/oembed');
  embedUrl.searchParams.set('url', `https://twitter.com/${tweetUser}/status/${tweetId}`);
  const r = await ky.get(embedUrl, { throwHttpErrors: false });
  
  let result: TweetOembedData = { id: tweetId }

  if (r.ok) {
    const json: TweetOEmbedResponse = await r.json();
  
    const parsed = await Html.extractWithCheerio(json.html, {
      text: 'blockquote.twitter-tweet > p | text',
      date: 'blockquote.twitter-tweet > a | text',
      urls: [{
        '$': 'blockquote.twitter-tweet > p',
        text: '> a | text',
        url: '> a | attr:href'
      }],
    });

    if (typeof(parsed.date) == 'string') {
      parsed.date = changeDate(parsed.date, 'LLLL d, yyyy', 'yyyy-MM-dd');
    };

    result = {
      ...result,
      url: json.url,
      name: json.url.split('/')[3],
      fullname: json.author_name,
      ...parsed
    };
  }

  return Promise.resolve(result);
}
