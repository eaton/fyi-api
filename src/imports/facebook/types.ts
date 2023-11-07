import is from '@sindresorhus/is';

// Posts live in in /posts/your_posts_\d+.json
export type FBPostsFile = FBPost[];

// Posts live in in /posts/your_videos.json
export type FBVideosFile = {
  videos_v2: FBVideo[];
};

// Comments live in in /comments_and_reactions/comments.json
export type FBCommentsFile = {
  comments_v2: FBComment[];
};

// Lives in /profile_information/profile_information.json
export type FBProfileFile = {
  profile_v2: {
    username: string;
    about_me?: string;
    registration_timestamp?: number;
    profile_uri: string;
    name: {
      full_name: string;
      first_name?: string;
      middle_name?: string;
      last_name?: string;
    };
    relationship?: {
      status?: string;
      anniversary?: { month?: number; day?: number; year?: number };
      timestamp?: number;
    };
    emails: { emails: string[] };
    hometown?: FbTextValue;
    current_city?: FbTextValue;
    religious_view?: FbTextValue;
    political_view?: FbTextValue;
    intro_bio?: FbTextValue;
  };
};

// This file lives in /your_topics/your_topics.json
export type FBYourTopics = { inferred_topics_v2: string[] };

type FbTextValue = {
  name: string;
  description?: string;
  timestamp: number;
};

export type FBComment = {
  timestamp: number;
  data: [{ comment: { timestamp: number; comment: string; author: string } }];
  title: string;
};

export type FBPost = {
  title?: string;
  timestamp: number;
  attachments?: { data: FBAttachment }[];
  tags?: { name: string }[];
  data: FBPostField[];
};

export type FBAttachment =
  | { media: FBMedia }[]
  | { place: FBPlace }[]
  | { external_context: { url: string } }[];

type FBPostField = { post?: string };

export type FBMedia = {
  uri: string;
  creation_timestamp?: number;
  title?: string;
  description?: string;
  media_metadata?: Record<string, unknown>;
};
export function isFBMedia(input: unknown): input is FBMedia {
  return is.plainObject(input) && is.plainObject(input.media_metadata);
}

export type FBPhoto = FBMedia & {
  media_metadata?: {
    photo_metadata?: { exif_data?: Record<string, number | string>[] };
  };
};
export function isFBPhoto(input: unknown): input is FBPhoto {
  return (
    is.plainObject(input) &&
    is.plainObject(input.media_metadata) &&
    'photo_metadata' in input.media_metadata
  );
}

export type FBVideo = FBMedia & {
  media_metadata?: {
    video_metadata?: { exif_data?: Record<string, unknown>[] };
  };
  thumbnail: { uri: string };
};
export function isFBVideo(input: unknown): input is FBVideo {
  return (
    is.plainObject(input) &&
    is.plainObject(input.media_metadata) &&
    'video_metadata' in input.media_metadata
  );
}

export type FBAlbum = {
  name: string;
  photos: FBPhoto[];
  cover_photo: FBPhoto;
  last_modified_timestamp: number;
  description: string;
};

export type FBPlace = {
  name: string;
  coordinate?: { latitude: number; longitude: number };
  address?: string;
  url?: string;
};

// Message threads live in /messages/(archived_threads|filtered_threads|message_requests|inbox)/[\w\d]+/message_1.json
export type FBThread = {
  title: string;
  thread_type?: string;
  thread_path?: string;
  magic_words: string[];
  participants: { name: string }[];
  messages: FBThreadMessage[];
};

export type FBThreadMessage = {
  sender_name: string;
  timestamp_ms: number;
  ip?: string;
  content?: string;
  photos?: { uri: string }[];
  type: string;
  is_unsent: boolean;
};
