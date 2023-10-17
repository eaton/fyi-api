export type D7Entity = D7User | D7Node | D7Comment | D7Term | D7Alias;

export type D7NodeField = {
  nid: number,
  delta: number,
  [index: string]: unknown
}

export type D7User = {
  [index: string]: unknown,
  uid: number,
  name: string,
  mail: string,
  date: string
}

export type D7Node = {
  [index: string]: unknown,
  nid: number,
  type: string,
  uid: number,
  status: number,
  date: number | string,
  title: string,
  body: string,
  format: string,
}

export type D7Comment = {
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
  body?: string,
  format?: string
}

export type D7Term = {
  [index: string]: unknown,
  tid: number,
  vocabulary: string,
  name: string,
  description?: string,
  format: string,
  weight: number
}

export type D7Alias = {
  source: string,
  alias: string
}