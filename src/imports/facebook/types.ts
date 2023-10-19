import is from '@sindresorhus/is';

export type FBPostsFile = FBPost[];
export type FBVideosFile = {
  "videos_v2": FBVideo[]
}
export type FBCommentsFile = {
  comments_v2: FBComment[]
}
export type FBProfileFile = {
  profile_v2: {
    username: string,
    about_me?: string,
    registration_timestamp?: number,
    profile_uri: string,
    name: {
      full_name: string,
      first_name?: string,
      middle_name?: string,
      last_name?: string
    }
    relationship?: {
      status?: string,
      anniversary?: { month?: number, day?: number, year?: number }
      timestamp?: number,
    },
    emails: { emails: string[] },
    hometown?: FbTextValue,
    current_city?: FbTextValue,
    religious_view?: FbTextValue,
    political_view?: FbTextValue,
    intro_bio?: FbTextValue
  }
}

type FbTextValue = {
  name: string,
  description?: string,
  timestamp: number
}

export type FBComment = {
  timestamp: number,
  data: [{ comment: { timestamp: number, comment: string, author: string } }],
  title: string
}

export type FBPost = {
  timestamp: number,
  attachments?: { data: FBAttachment }[],
  data: FBPostField[]
}

export type FBAttachment = 
  [{ media: FBMedia }] |
  [{ place: FBPlace }] |
  [{ external_context: { url: string }}]

type FBPostField = { post?: string };

export type FBMedia = {
  uri: string,
  creation_timestamp?: number,
  title?: string,
  description?: string,
  media_metadata?: Record<string, unknown>
}
export function isFBMedia(input: unknown): input is FBMedia {
  return (is.plainObject(input) && is.plainObject(input.media_metadata));
}

export type FBPhoto = FBMedia & {
  media_metadata?: {
    photo_metadata?: { exif_data?: Record<string, number | string>[] }
  }
}
export function isFBPhoto(input: unknown): input is FBPhoto {
  return (is.plainObject(input) && is.plainObject(input.media_metadata) && 'photo_metadata' in input.media_metadata);
}

export type FBVideo = FBMedia & {
  media_metadata?: {
    video_metadata?: { exif_data?: Record<string, string | number>[] }
  },
  thumbnail: { uri: string },
}
export function isFBVideo(input: unknown): input is FBVideo {
  return (is.plainObject(input) && is.plainObject(input.media_metadata) && 'video_metadata' in input.media_metadata);
}

export type FBAlbum = {
  name: string,
  photos: FBPhoto[],
  cover_photo: FBPhoto,
  last_modified_timestamp: number,
  description: string
}

export type FBPlace = {
  name: string,
  coordinate?: { latitude: number, longitude: number },
  address?: string,
  url?: string
}
