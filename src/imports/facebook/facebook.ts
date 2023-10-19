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
} from './types.js';

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

  async fillCache(): Promise<FacebookCacheData> {
    const cacheData: FacebookCacheData = {
      profile: {},
      comments: [],
      videos: [],
      albums: [],
      posts: []
    }

    const postFiles = await this.files.findInput('posts/your_posts_*.json');
    for (const postFile of postFiles) {
      const inposts = await this.files.readInput(postFile) as FBPostsFile ?? [];
      for (const post of inposts) {
        cacheData.posts.push(makePost(post));
      }
    }
    const albumFiles = await this.files.findInput('posts/album/*.json');
    for (const albumFile of albumFiles) {
      const album = await this.files.readInput(albumFile) as (FBAlbum | undefined);
      if (album) cacheData.albums.push(makeAlbum(album));
    }

    const invideos = await this.files.readInput('posts/your_videos.json') as (FBVideosFile | undefined) ?? [];
    const incomments = await this.files.readInput('comments_and_reactions/comments.json') as (FBCommentsFile | undefined) ?? {};
    const inprofile = await this.files.readInput('profile_information/profile_information.json') as (FBProfileFile | undefined) ?? {};

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
    body: input.data.map(d => 'post' in d ? d.post : ''),
    attachments: input.attachments?.map(d => d.data)
  };
}

function makeVideo(input: FBVideo) {
  return {
    title: input.title,
    url: input.uri,
    thumbnailUrl: input.thumbnail.uri,
    description: input.description,
    exif: input.media_metadata?.video_metadata?.exif_data?.flat()
  };
}

function makeComment(input: FBComment) {
  return {

  };
}

function makeAlbum(input: FBAlbum) {
  return {};
}
