export type MediumUserInfo = {
  id: string,
  url: string,
  email: string,
  name: string,
  fullname: string,
  twitter_id?: string,
  archive_exported_at: string,
  medium_member_at: string,
  image_url: string,
  publications: { writer?: unknown[], editor?: unknown[] }
}

export type MediumArticle = {
  id: string,
  filename: string,
  url: string,
  author: Partial<MediumUserInfo>,
  title: string,
  subtitle: string,
  published_at: string,
  draft: boolean,
  tags: string[],
  topics: string[],
  claps: number,
  image_url: string,
  lang: string,
  publication_id: string,
  word_count: number,
  reading_time: number,
  responses_count: number,
  voters: number,
}
