export type FacebookRawPostsFile = FacebookRawPost[];
export type FacebookRawVideosFile = {
  "videos_v2": FacebookRawVideo[]
}
export type FacebookRawCommentsFile = {
  comments_v2: FacebookRawComment[]
}

export type FacebookRawComment = {
  timestamp: 1223230578,
  data: [{ comment: { timestamp: number, comment: string, author: string } }],
  title: string
}

export type FacebookRawPost = {
  timestamp: number,
  attachments?: FacebookRawAttachment[],
  data: ({ post: string } | { update_timestamp: number })[]
}

export type FacebookRawVideo = {
  uri: string,
  creation_timestamp: number,
  media_metadata?: {
    video_metadata?: { exif_data?: Record<string, string | number>[] }
  },
  thumbnail: { uri: string },
  description: string
}
export type FacebookRawAlbumFile = {
  name: string,
  photos: [
    {
      uri: string,
      creation_timestamp: number,
      title: string,
      description: string
    }
  ],
  cover_photo: {
    uri: string,
    creation_timestamp: number,
    title: string,
    description: string
  },
  last_modified_timestamp: number,
  description: string
}

export type FacebookRawAttachment = FacebookRawMediaAttachment | FacebookRawPlaceAttachment | FacebookRawExternalContextAttachment;
export type FacebookRawMediaAttachment = { data: [{ 
  media: {
    uri: string,
    creation_timestamp: number,
    title?: string,
    description?: string,
    media_metadata?: {
      photo_metadata?: { exif_data?: Record<string, number | string>[] }
    }
  }
}]};
export type FacebookRawPlaceAttachment = { data: [{ 
  place: {
    name: string,
    coordinate?: { latitude: number, longitude: number },
    address?: string,
    url?: string
  }
}]};
export type FacebookRawExternalContextAttachment = { data: [{ 
  external_context: { url: string }
}]};