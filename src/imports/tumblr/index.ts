import 'dotenv/config'

import { Import } from "../import-base.js";
import { Client } from 'tumblr.js';
import { BlogPost, UserInfo } from './types.js';

import fpkg from 'fs-extra';
const { ensureDir, writeJSON } = fpkg;

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

    await ensureDir('raw/tumblr');

    const userInfoResponse: UserInfo = await t.userInfo();
    const user = userInfoResponse.user;
    await writeJSON(`raw/tumblr/${user.name}.json`, user, { spaces: 2 });

    for (const blogInfo of user.blogs) {
      if (blogIds.length > 0 && !blogIds.includes(blogInfo.name)) {
        continue;
      }

      await ensureDir(`raw/tumblr/${blogInfo.name}`);
      await writeJSON(`raw/tumblr/${blogInfo.name}/${blogInfo.name}-meta.json`, blogInfo, { spaces: 2 });

      // Bail out if a list of blogs was given, and the current one doesn't appear in it.
      const blogPostsResponse = await t.blogPosts(blogInfo.name) as { posts: BlogPost[] };
      for (const post of blogPostsResponse.posts) {
        const date = post.date.split(' ')[0];
        await writeJSON(`raw/tumblr/${blogInfo.name}/${date}-${post.slug}.json`, post, { spaces: 2 });
      }
    }

    return Promise.resolve({});
  }
}
