export type DrupalOrgProfile = {
  handle?: string,
  name?: string,
  date?: string,
  avatar?: string,
  socialLinks?: string[],
  companies?: string[],
  industries?: string[],
  bio?: string,
  expertise?: string[],
  events?: string[],
  maintainer?: string[]
}

export type DrupalOrgActivity = {
  type: string,
  title: string,
  url: string,
  author: string,
  uid: number,
  replies: number,
  updated: string,
}

export type DrupalOrgNode = {
  nid: number,
  url: string,
  uid: number,
  author: string,
  title?: string,
  body?: string,
  date: string
}

export type DrupalOrgTopic = DrupalOrgNode & {
  replies?: DrupalOrgComment[]
}

export type DrupalOrgProject = DrupalOrgNode & {
  machineName: string,
  displayName: string,
  tags?: string[],
  usage?: number,
  creator?: string,
}

export type DrupalOrgIssue = DrupalOrgNode & {
  project: string,
  priority?: string,
  tags?: string[]
  followers?: number,
  status?: string,
  replies?: DrupalOrgComment[],
}

export type DrupalOrgRelease = DrupalOrgNode & {
  project?: string,
  version?: string
  creator?: string,
}

export type DrupalOrgComment = {
  cid: number,
  nid?: number,
  uid: number,
  author: string,
  date: string,
  title?: string,
  body?: string,
  changes?: { property: string, value: string }[]
}
