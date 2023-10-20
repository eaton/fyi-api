export type DrupalProfilePage = {
  uid?: number,
  handle: string,
  displayName: string,
  sites?: string[],
  age?: string,
  docEdits?: number,
  irc?: string,
  companies?: string[],
  industries?: string,
  bio?: string,
  expertise?: string[],
  events?: string[],
  contributions?: string[],
}

export type DrupalProfileActivity = {
  type: string,
  title: string,
  url: string,
  author: string,
  replies: number,
  updated: string,
}

export type DrupalProjectPage = {
  nid: number,
  type: string,
  machineName: string,
  displayName: string,
  categories?: string[],
  description?: string,
  usage?: number,
  creator?: string,
  created?: string,
  updated?: string,
}

export type DrupalIssuePage = {
  nid: number,
  reporter: string,
  created: string,
  comments?: number,
}

export type DrupalIssueComment = {
  uid: number,
  cid: number,
  nid: number,
  name: string,
  date?: string,
  body?: string,
}

export type DrupalForumPost = {
  uid: number,
  cid: number,
  nid: number,
  name: string,
  date?: string,
  title?: string,
  body?: string,
}
