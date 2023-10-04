import { BaseImport, BaseImportOptions } from "../../index.js";
import { Client } from 'tumblr.js';
import { TumblrUser, TumblrPost } from "./types.js";

export interface TumblrImportOptions extends BaseImportOptions {
  auth?: {
    consumer_key: string,
    consumer_secret: string,
    token: string,
    token_secret: string
  }
}

export class Tumblr extends BaseImport {
  declare options: TumblrImportOptions;

  collections = { 
    tumblr_user: {},
    tumblr_blog: {},
    tumblr_post: {},
  }

  async fillCache(): Promise<void> {
    if (this.options.auth) {
      return this.fillCacheFromApi();
    } else {
      this.log('No cached data, no API auth keys provided.');
    }
  }

  async fillCacheFromApi(): Promise<void> {
    const t = new Client(this.options.auth);

    const userInfoResponse: TumblrUser = await t.userInfo();
    const user = userInfoResponse.user;
    await this.files.writeCache(`user-${user.name}.json`, user);

    for (const blogInfo of user.blogs) {
      await this.files.writeCache(`${blogInfo.name}/blog-${blogInfo.name}.json`, blogInfo);

      const blogPostsResponse = await t.blogPosts(blogInfo.name) as { posts: TumblrPost[] };
      for (const post of blogPostsResponse.posts) {
        const date = post.date.split(' ')[0];
        await this.files.writeCache(`${blogInfo.name}/post-${date}-${post.slug}.json`, post);
      }
    }

    this.log(`Cached ${user.blogs.length} blogs associated with ${user.name}`);

    return Promise.resolve();
  }
}
