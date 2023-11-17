import { BaseImport, BaseImportOptions } from '../index.js';
import {
  FBPostsFile,
  FBVideosFile,
  FBCommentsFile,
  FBAlbum,
  FBPost,
  FBComment,
  FBVideo,
  FBProfileFile,
  FBMedia,
  FBPhoto,
  isFBVideo,
  isFBPhoto
} from './types.js';
import is from '@sindresorhus/is';

export type FacebookCacheData = {
  profile: Record<string, unknown>;
  posts: Record<string, unknown>[];
  videos: Record<string, unknown>[];
  albums: Record<string, unknown>[];
  comments: Record<string, unknown>[];
};

export interface FacebookImportOptions extends BaseImportOptions {}

export class Facebook extends BaseImport<FacebookCacheData> {
  declare options: FacebookImportOptions;

  constructor(options: FacebookImportOptions = {}) {
    super(options);
  }

  async loadCache(): Promise<FacebookCacheData> {
    const cacheData: FacebookCacheData = {
      profile: {},
      comments: [],
      videos: [],
      albums: [],
      posts: []
    };

    if (is.emptyObject(cacheData.profile)) {
      return this.fillCache();
    } else {
      return Promise.resolve(cacheData);
    }
  }

  async fillCache(): Promise<FacebookCacheData> {
    const cacheData: FacebookCacheData = {
      profile: {},
      comments: [],
      videos: [],
      albums: [],
      posts: []
    };

    const inprofile =
      ((await this.input.readAsync(
        'profile_information/profile_information.json',
        "auto"
      )) as FBProfileFile) ?? {};
    if (inprofile) {
      cacheData.profile = makeProfile(inprofile);
      await this.cache.writeAsync(`profile.json`, cacheData.profile);
    }

    const postFiles = await this.input.findAsync({ matching: 'posts/your_posts_*.json' });
    for (const postFile of postFiles ?? []) {
      const posts =
        ((await this.input.readAsync(postFile, "auto")) as FBPostsFile) ?? [];
      for (const post of posts) {
        cacheData.posts.push(makePost(post));
      }
    }
    if (!is.emptyArray(cacheData.posts))
      await this.cache.writeAsync(`posts.json`, cacheData.posts);

    const albumFiles = await this.input.findAsync({ matching: 'posts/album/*.json' });
    for (const albumFile of albumFiles ?? []) {
      const album = (await this.input.readAsync(albumFile, "auto")) as
        | FBAlbum
        | undefined;
      if (album) cacheData.albums.push(makeAlbum(album));
    }
    if (!is.emptyArray(cacheData.albums))
      await this.cache.writeAsync(`albums.json`, cacheData.albums);

    const videosFile =
      ((await this.input.readAsync(
        'posts/your_videos.json', "auto"
      )) as FBVideosFile) ?? {};
    if (videosFile) {
      cacheData.videos = videosFile.videos_v2.map(makeVideo);
      await this.cache.writeAsync(`videos.json`, cacheData.videos);
    }

    const commentsFile =
      ((await this.input.readAsync(
        'comments_and_reactions/comments.json', "auto"
      )) as FBCommentsFile) ?? {};
    if (commentsFile) {
      cacheData.comments = commentsFile.comments_v2.map(makeComment);
      await this.cache.writeAsync(`comments.json`, cacheData.comments);
    }

    return Promise.resolve(cacheData);
  }
}

function makeProfile(input: FBProfileFile) {
  const p = input.profile_v2;
  return {
    username: p.username,
    date: p.registration_timestamp
      ? new Date(p.registration_timestamp * 1000).toISOString()
      : undefined,
    fullname: p.name.full_name,
    email: p.emails.emails.shift(),
    url: p.profile_uri,
    bio: p.intro_bio,
    about: p.about_me
  };
}

function makePost(input: FBPost) {
  return {
    title: input.title,
    date:
      input.timestamp > 0 ? new Date(input.timestamp * 1000).toISOString() : 0,
    body: input.data?.find((d) => 'post' in d)?.post,
    tags: input.tags?.map((t) => t.name),
    ...extractPostAttachments(input)
  };
}

function extractPostAttachments(input: FBPost) {
  const attch: Record<string, unknown[]> = {};
  for (const a of input.attachments ?? []) {
    for (const d of a.data) {
      if ('place' in d) {
        attch['places'] ??= [];
        attch['places'].push(d.place);
      } else if ('media' in d) {
        attch['media'] ??= [];
        attch['media'].push(makeMedia(d.media));
      } else if ('external_context' in d) {
        attch['links'] ??= [];
        attch['links'].push(d.external_context.url);
      }
    }
  }
  if (is.emptyObject(attch)) return undefined;
  return attch;
}

function makeVideo(input: FBVideo) {
  let exif: Record<string, unknown> | undefined = {};
  for (const newValues of input.media_metadata?.video_metadata?.exif_data ??
    []) {
    exif = { ...exif, ...newValues };
  }
  if (is.emptyObject(exif)) exif = undefined;

  return {
    url: input?.uri ?? undefined,
    date: input.creation_timestamp
      ? new Date(input.creation_timestamp * 1000).toISOString()
      : '',
    title: input?.title ?? undefined,
    description: input?.description ?? undefined,
    thumbnailUrl: input?.thumbnail?.uri,
    exif
  };
}

function makePhoto(input: FBPhoto) {
  let exif: Record<string, unknown> | undefined = {};
  for (const newValues of input.media_metadata?.photo_metadata?.exif_data ??
    []) {
    exif = { ...exif, ...newValues };
  }
  if (is.emptyObject(exif)) exif = undefined;

  return {
    url: input?.uri ?? undefined,
    date: input.creation_timestamp
      ? new Date(input.creation_timestamp * 1000).toISOString()
      : '',
    title: input?.title ?? undefined,
    description: input?.description ?? undefined,
    exif
  };
}

function makeComment(input: FBComment) {
  const comment = input.data?.find((d) => 'comment' in d);
  return {
    title: input.title,
    date:
      input.timestamp > 0 ? new Date(input.timestamp * 1000).toISOString() : 0,
    author: comment?.comment?.author,
    body: comment?.comment?.comment // No, really
  };
}

function makeAlbum(input: FBAlbum) {
  return {
    name: input.name,
    description: input.description,
    date:
      input.last_modified_timestamp > 0
        ? new Date(input.last_modified_timestamp * 1000).toISOString()
        : 0,
    photos: input.photos.map(makeMedia),
    cover: input.cover_photo ? makePhoto(input.cover_photo) : undefined
  };
}

export function makeMedia(input: FBMedia) {
  if (isFBVideo(input)) {
    return makeVideo(input);
  } else if (isFBPhoto(input)) {
    return makePhoto(input);
  } else if ('uri' in input) {
    return {
      url: input?.uri,
      date: input?.creation_timestamp
        ? new Date(input.creation_timestamp * 1000).toISOString()
        : 0,
      title: input?.title,
      description: input?.description
    };
  }
  throw new TypeError('Could not parse Facebook Media item');
}
