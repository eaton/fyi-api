import pkg from 'textile-js';
const { parse } = pkg;
import { Html } from './index.js';

export function toHtml(input: string) {
  return parse(input);
}

export function toText(input: string) {
  return Html.toText(parse(input));
}