import { BaseImport, BaseImportOptions } from '../../index.js';
import { Client } from 'tumblr.js';
import { TumblrUser, TumblrPost, TumblrBlog } from './types.js';
import { Dates, Markdown } from 'mangler';

export interface TumblrImportOptions extends BaseImportOptions {
  auth?: {
    consumer_key: string;
    consumer_secret: string;
    token: string;
    token_secret: string;
  };
}

type TumblrCache = {
  blogs: Record<string, TidyBlog>,
  posts: TidyPost[],
};

export class Tumblr extends BaseImport<TumblrCache> {
  declare options: TumblrImportOptions;

  collections = ['tumblr_user', 'tumblr_blog', 'tumblr_post'];

  constructor(options: TumblrImportOptions = {}) {
    super(options);
  }

  async doImport(): Promise<void> {
    const cache = await this.loadCache();
    const out = this.output;

    for (const post of cache.posts) {
      if (post.body) {
        let content = Markdown.fromHtml(post.body);
        const extra: Record<string, unknown> = {
          platform: 'tumblr',
          id: post.id,
        };

        let originalUrl = post.post_url;

        if (post.type === 'photo') {
          // download the photo
          if (post.source_url) {
            content = `[![${post.source_title}](${post.url})](${post.source_url})\n\n${content}`;
          } else {
            content = `![](${post.url})\n\n${content}`;
          }
        } else if (post.type === 'link' || post.type === 'video') {
          originalUrl = post.url?.toString() ?? originalUrl;
          if (post.source_title === 'metafilter.com') continue;
          if (post.source_url) {
            content = `Via [${post.source_title}](${post.source_url})]...\n\n${content}`;
          }
        }

        const data: Record<string, unknown> = {
          title: post.title ?? '',
          date: post.date,
          slug: post.slug ?? '',
          publisher: post.blog,
          url: originalUrl,
          ...extra
        };

        if (post.tags && post.tags.length) {
          extra['tags'] = post.tags;
        }

        const date = post.date.split(' ')[0];
        out.write(`${post.blog}/${date}-${post.slug}.md`, { data, content });
      } else { 
        this.log(`No body; skipping ${post.post_url}`);
      }
    }

    return Promise.resolve();
  }

  async loadCache(): Promise<TumblrCache> {
    this.cacheData = {
      blogs: {},
      posts: []
    };

    this.cache.find({ matching: '*/blog-*.json' })
      .forEach(file => {
        const blog = this.cache.read(file, 'auto') as TidyBlog;
        this.cacheData!.blogs[blog.name] = blog;
      });

    this.cache.find({ matching: '*/post-*.json' })
      .forEach(file => {
        const post = this.cache.read(file, 'auto') as TidyPost;
        this.cacheData!.posts.push(post);
      });
    
    if (!Object.entries(this.cacheData.blogs).length && !this.cacheData.posts.length) {
      await this.fillCache();
    }

    return Promise.resolve(this.cacheData); 
  }

  async fillCache(): Promise<TumblrCache> {
    this.cacheData ??= {
      blogs: {},
      posts: []
    };

    if (!this.options.auth) {
      this.log('No cached data, no API auth keys provided.');
      return Promise.resolve(this.cacheData);
    }

    const t = new Client(this.options.auth);

    const userInfoResponse: TumblrUser = await t.userInfo();
    const user = userInfoResponse.user;
    await this.cache.writeAsync(
      `user-${user.name}.json`,
      this.tidyUser(userInfoResponse)
    );

    for (const blogInfo of user.blogs) {
      await this.cache.writeAsync(
        `${blogInfo.name}/blog-${blogInfo.name}.json`, this.tidyBlog(blogInfo)
      );
      this.cacheData.blogs[blogInfo.name] = this.tidyBlog(blogInfo);

      const blogPostsResponse = (await t.blogPosts(blogInfo.name)) as {
        posts: TumblrPost[];
      };
      for (const post of blogPostsResponse.posts) {
        const date = post.date.split(' ')[0];
        await this.cache.writeAsync(
          `${blogInfo.name}/post-${date}-${post.slug}.json`,
          this.tidyPost(post)
        );
        this.cacheData.posts.push(this.tidyPost(post));
      }
    }

    this.log(`Cached ${user.blogs.length} blogs associated with ${user.name}`);

    return Promise.resolve(this.cacheData);
  }

  tidyPost(post: TumblrPost) {
    return {
      type: post.type,
      blog: post.blog_name,
      id: post.id_string,
      post_url: post.post_url,
      slug: post.slug,
      date: Dates.parseJSON(post.date).toISOString(),
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

  tidyUser(user: TumblrUser) {
    return {
      name: user.user.name,
      likes: user.user.likes,
      following: user.user.following,
      blogs: user.user.blogs.map((b) => this.tidyBlog(b))
    };
  }

  tidyBlog(blog: TumblrBlog) {
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

type TidyPost = ReturnType<Tumblr['tidyPost']>;
type TidyBlog = ReturnType<Tumblr['tidyBlog']>;
