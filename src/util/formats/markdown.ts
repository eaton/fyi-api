import { parse } from 'marked';
import TurndownService from 'turndown';

export function toHtml(input: string) {
  return parse(input);
}

export function fromHtml(input: string) {
  const turndownService = new TurndownService();
  return turndownService.turndown(input);
}