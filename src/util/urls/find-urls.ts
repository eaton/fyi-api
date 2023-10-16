import { FoundUrl, Html } from "../index.js";

export function findUrls(input: string, mode: 'text' | 'dom') {
  const urls: FoundUrl[] = [];
  if (mode === 'text') {
    
  } else {
    const $ = Html.toCheerio(input);
    $('[href]').toArray().forEach(e => {
      const url: FoundUrl = {
        url: $(e).attr('href'),
        text: $(e).text(),
        title: $(e).attr('title') 
      }
      urls.push(url);
    })
  }
}