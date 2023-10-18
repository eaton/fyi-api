export type D6Entity = D6User | D6Node | D6Comment | D6Term | D6Alias;

export type D6NodeField = {
  nid: number,
  vid: number,
  [index: string]: unknown
}

export type D6User = {
  [index: string]: unknown,
  uid: number,
  name: string,
  mail: string,
  date: string
}

export type D6Node = {
  [index: string]: unknown,
  nid: number,
  type: string,
  uid: number,
  status: number,
  date: number | string,
  title: string,
  body: string,
  teaser?: string,
  format: string,
  fields?: Record<string, unknown>
}

export type D6Comment = {
  [index: string]: unknown,
  cid: number,
  nid: number,
  pid?: number,
  uid: number,
  hostname?: string,
  date: number | string,
  name?: string,
  mail?: string,
  homepage?: string,
  title?: string,
  body?: string,
  format?: string
}

export type D6Term = {
  [index: string]: unknown,
  tid: number,
  vocabulary: string,
  name: string,
  description?: string,
  weight: number
}

export type D6Alias = {
  source: string,
  alias: string
}