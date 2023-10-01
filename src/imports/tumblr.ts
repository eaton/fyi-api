import 'dotenv/config'

import { Import } from "./import-base.js";
import { Client } from 'tumblr.js';

export type UserInfo = {
  user: {
    name: string,
    likes: number,
    following: number,
    default_post_format: string,
    blogs: UserBlogInfo[],  
  }
}

export type UserBlogInfo = {
  admin: boolean,
  ask: boolean,
  ask_anon: boolean,
  ask_page_title: string,
  asks_allow_media: boolean,
  avatar: unknown,
  can_chat: boolean,
  can_send_fan_mail: boolean,
  can_submit: boolean,
  can_subscribe: boolean,
  description: string,
  drafts: number,
  facebook: string,
  facebook_opengraph_enabled: string,
  followed: boolean,
  followers: number,
  members: number,
  is_blocked_from_primary: boolean,
  is_nsfw: boolean,
  messages: number,
  name: string,
  posts: number,
  primary: boolean,
  queue: number,
  share_likes: boolean,
  submission_page_title: string,
  submission_terms: {
    accepted_types: string[],
    tags: string[],
    title: string,
    guidelines: 'string',
  },
  subscribed: boolean,
  theme: TumblrTheme,
  title: string,
  total_posts: number,
  tweet: string,
  twitter_enabled: boolean,
  twitter_send: boolean,
  type: string,
  updated: number,
  url: string,
  uuid: string
};

export type BlogPost = {
  type: string,
  is_blocks_post_format: boolean,
  blog_name: string,
  id: string,
  id_string: string,
  is_blazed: boolean,
  is_blaze_pending: boolean,
  can_ignite: boolean,
  can_blaze: boolean,
  post_url: string,
  slug: string,
  date: string,
  timestamp: number,
  state: string,
  format: string,
  reblog_key: string,
  tags: string[],
  short_url: string,
  summary: string,
  should_open_in_legacy: boolean,
  recommended_source?: string,
  recommended_color?: string,
  followed: boolean,
  liked: boolean,
  note_count: number,
  title: string,
  body: string,
  can_like: boolean,
  interactability_reblog: string,
  interactability_blaze: string,
  can_reblog: boolean,
  can_send_in_message: boolean,
  muted: boolean,
  mute_end_timestamp: number,
  can_mute: boolean,
  can_reply: boolean,
  display_avatar: boolean
};

export type TumblrTheme = {
  avatar_shape: string,
  background_color: string,
  body_font: string,
  header_bounds: string,
  header_image: string,
  header_image_focused: string,
  header_image_poster: string,
  header_image_scaled: string,
  header_stretch: boolean,
  link_color: string,
  show_avatar: boolean,
  show_description: boolean,
  show_header_image: boolean,
  show_title: boolean,
  title_color: string,
  title_font: string,
  title_font_weight: string
};

export class Tumblr extends Import {
  doImport(): Promise<string[]> {
    throw new Error('Method not implemented.');
  }
  
  async preload(): Promise<Record<string, string>> {
    let blogIds: string[] = [];
    if (process.env.TUMBLR_BLOGS) {
      blogIds = process.env.TUMBLR_BLOGS?.split(',').map(b => b.trim()) ?? [];
    }

    const t = new Client({
      consumer_key: process.env.TUMBLR_CONSUMER_KEY,
      consumer_secret: process.env.TUMBLR_CONSUMER_SECRET,
      token: process.env.TUMBLR_TOKEN,
      token_secret: process.env.TUMBLR_TOKEN_SECRET
    });

    this.files.ensure('raw/tumblr');

    const userInfoResponse: UserInfo = await t.userInfo();
    const user = userInfoResponse.user;
    await this.files.write(`raw/tumblr/${user.name}.json`, user);

    for (const blogInfo of user.blogs) {
      if (blogIds.length > 0 && !blogIds.includes(blogInfo.name)) {
        continue;
      }

      this.files.ensure(`raw/tumblr/${blogInfo.name}`);
      await this.files.write(`raw/tumblr/${blogInfo.name}/${blogInfo.name}-meta.json`, blogInfo);

      // Bail out if a list of blogs was given, and the current one doesn't appear in it.
      const blogPostsResponse = await t.blogPosts(blogInfo.name) as { posts: BlogPost[] };
      for (const post of blogPostsResponse.posts) {
        const date = post.date.split(' ')[0];
        await this.files.write(`raw/tumblr/${blogInfo.name}/${date}-${post.slug}.json`, post);
      }
    }

    return Promise.resolve({});
  }
}
