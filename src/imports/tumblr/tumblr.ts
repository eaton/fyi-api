import { BaseImport, BaseImportOptions } from '../../index.js';
import { Client } from 'tumblr.js';
import { TumblrUser, TumblrPost, TumblrBlog } from './types.js';

export interface TumblrImportOptions extends BaseImportOptions {
  auth?: {
    consumer_key: string;
    consumer_secret: string;
    token: string;
    token_secret: string;
  };
}

export class Tumblr extends BaseImport {
  declare options: TumblrImportOptions;

  collections = ['tumblr_user', 'tumblr_blog', 'tumblr_post'];

  constructor(options: TumblrImportOptions = {}) {
    super(options);
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
    await this.cache.writeAsync(
      `user-${user.name}.json`,
      this.tidyUser(userInfoResponse)
    );

    for (const blogInfo of user.blogs) {
      await this.cache.writeAsync(
        `${blogInfo.name}/blog-${blogInfo.name}.json`,
        this.tidyBlog(blogInfo)
      );

      const blogPostsResponse = (await t.blogPosts(blogInfo.name)) as {
        posts: TumblrPost[];
      };
      for (const post of blogPostsResponse.posts) {
        const date = post.date.split(' ')[0];
        await this.cache.writeAsync(
          `${blogInfo.name}/post-${date}-${post.slug}.json`,
          this.tidyPost(post)
        );
      }
    }

    this.log(`Cached ${user.blogs.length} blogs associated with ${user.name}`);

    return Promise.resolve();
  }

  protected tidyPost(post: TumblrPost) {
    return {
      type: post.type,
      blog: post.blog_name,
      id: post.id_string,
      post_url: post.post_url,
      slug: post.slug,
      date: post.date,
      title: post.title ?? undefined,
      url:
        post.url ??
        post.permalink_url ??
        post.photos?.[0].original_size['url'] ??
        post.image_permalink ??
        undefined,
      source_title: post.source_title ?? post.publisher ?? undefined,
      source_url: post.source_url ?? undefined,
      body:
        post.caption ??
        post.description ??
        post.body ??
        post.summary ??
        undefined,
      tags: post.tags.length ? post.tags : undefined
    };
  }

  protected tidyUser(user: TumblrUser) {
    return {
      name: user.user.name,
      likes: user.user.likes,
      following: user.user.following,
      blogs: user.user.blogs.map((b) => this.tidyBlog(b))
    };
  }

  protected tidyBlog(blog: TumblrBlog) {
    return {
      id: blog.uuid,
      name: blog.name,
      url: blog.url,
      title: blog.title ?? undefined,
      description: blog.description,
      posts: blog.total_posts,
      nsfw: blog.is_nsfw,
      guidelines: blog?.submission_terms?.guidelines
    };
  }
}
