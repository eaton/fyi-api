export type InstagramProfileChunk = {
  title: string,
  media_map_data: Record<string, unknown>,
  string_map_data: Record<string, InstagramProfileValue>,
};

export type InstagramProfileValue = {
  href: string,
  value: string,
  timestamp: number
};

export type InstagramPost = {
  title?: string,
  creation_timestamp: number,
  media: InstagramMedia[]
};

export type InstagramMedia = {
  uri: string,
  creation_timestamp: number,
  title: string,
  media_metadata?: {
    photo_metadata?: {
      exif_data?: Record<string, string | number>[]
    }
  },
  cross_post_source?: unknown
};

export type IGCachedPost = {
  id: string,
  title?: string,
  date?: string,
  media: {
    url: string,
    date: string,
    title?: string,
    exif?: Record<string, unknown>
  }[]
};

