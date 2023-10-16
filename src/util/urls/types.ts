export interface FoundUrl {
  [index: string]: unknown,
  text?: string,
  title?: string,
  url?: string,
  normalized?: string,
  redirects?: string[],
  resolved?: string,
  status?: number,
  message?: string,
}
