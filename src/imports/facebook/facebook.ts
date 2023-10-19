import { BaseImport, BaseImportOptions } from "../index.js";
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
  isFBPhoto,
} from './types.js';
import is from '@sindresorhus/is';

export type FacebookCacheData = {
  profile: Record<string, unknown>,
  posts: Record<string, unknown>[],
  videos: Record<string, unknown>[],
  albums: Record<string, unknown>[],
  comments: Record<string, unknown>[],
}

export interface FacebookImportOptions extends BaseImportOptions {

}

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
    }

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
    }

    const inprofile = await this.files.readInput('profile_information/profile_information.json') as FBProfileFile ?? {};
    cacheData.profile = makeProfile(inprofile);

    const postFiles = await this.files.findInput('posts/your_posts_*.json');
    for (const postFile of postFiles) {
      const posts = await this.files.readInput(postFile) as FBPostsFile ?? [];
      for (const post of posts) {
        cacheData.posts.push(makePost(post));
      }
    }

    const albumFiles = await this.files.findInput('posts/album/*.json');
    for (const albumFile of albumFiles) {
      const album = await this.files.readInput(albumFile) as (FBAlbum | undefined);
      if (album) cacheData.albums.push(makeAlbum(album));
    }

    const videosFile = await this.files.readInput('posts/your_videos.json') as FBVideosFile ?? {};
    cacheData.videos = videosFile.videos_v2.map(makeVideo);

    const commentsFile = await this.files.readInput('comments_and_reactions/comments.json') as FBCommentsFile ?? {};
    cacheData.comments = commentsFile.comments_v2.map(makeComment);

    // Do we want to split these?
    await this.files.writeCache(`profile.json`, cacheData.profile);
    await this.files.writeCache(`posts.json`, cacheData.posts);
    await this.files.writeCache(`videos.json`, cacheData.videos);
    await this.files.writeCache(`albums.json`, cacheData.albums);
    await this.files.writeCache(`comments.json`, cacheData.comments);

    return Promise.resolve(cacheData);
  }
}

function makeProfile(input: FBProfileFile) {
  const p = input.profile_v2;
  return {
    username: p.username,
    fullname: p.name.full_name,
    email: p.emails.emails.shift(),
    url: p.profile_uri,
  }
}

function makePost(input: FBPost) {
  return {
    date: input.timestamp > 0 ? new Date(input.timestamp * 1000).toISOString() : 0,
    body: input.data?.find(d => 'post' in d)?.post,
    attachments: input.attachments?.map(d => d.data)
  };
}

function makeVideo(input: FBVideo) {
  return {
    url: input.uri,
    date: input.creation_timestamp ? new Date(input.creation_timestamp * 1000).toISOString() : 0,
    title: input.title,
    description: input.description,
    thumbnailUrl: input.thumbnail.uri,
    exif: input.media_metadata?.video_metadata?.exif_data?.flat()
  }
}

function makePhoto(input: FBPhoto) {
  return {
    url: input.uri,
    date: input.creation_timestamp ? new Date(input.creation_timestamp * 1000).toISOString() : 0,
    title: input.title,
    description: input.description,
    exif: input.media_metadata?.photo_metadata?.exif_data?.flat()
  }
}

function makeComment(input: FBComment) {
  const comment = input.data?.find(d => 'comment' in d);
  return {
    title: input.title,
    date: input.timestamp > 0 ? new Date(input.timestamp * 1000).toISOString() : 0,
    author: comment?.comment?.author,
    body: comment?.comment?.comment, // No, really
  };
}

function makeAlbum(input: FBAlbum) {
  return {
    name: input.name,
    description: input.description,
    date: input.last_modified_timestamp > 0 ? new Date(input.last_modified_timestamp * 1000).toISOString() : 0,
    photos: input.photos.map(makeMedia),
    cover: input.cover_photo ? makePhoto(input.cover_photo) : undefined
  }
}

function makeMedia(input: FBMedia) {
  if (isFBVideo(input)) {
    return makeVideo(input);
  } else if (isFBPhoto(input)) {
    return makePhoto(input);
  } else if ('uri' in input) {
    return {
      url: input.uri,
      date: input.creation_timestamp ? new Date(input.creation_timestamp * 1000).toISOString() : 0,
      title: input.title,
      description: input.description,
    }
  }
  throw new TypeError('Could not parse Facebook Media item');
}
