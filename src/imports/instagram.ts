import { BaseImport, uuid } from '../index.js';

type InstagramPost = {
  title?: string,
  creation_timestamp?: number,
  media: InstagramMedia[]
}

type InstagramMedia = {
  uri: string,
  creation_timestamp: number,
  title: string,
  media_metadata?: unknown
  cross_post_source?: unknown
}

export class Instagram extends BaseImport {
  collections = { instagram_post: {} };

  async doImport(): Promise<void> {
    const posts = await this.files.read('input/instagram/content/posts_1.json') as InstagramPost[];
    let mediaCount = 0;

    for (const post of posts) {
      const postId = uuid(post);
      if (post.media.length === 1) {
        await this.db.collection('instagram_post').save({
          _key: postId,
          creation_timestamp: new Date((post.media[0].creation_timestamp ?? 0) * 1000).toISOString(),
          title: post.media[0].title,
          media: [post.media[0].uri]
        });
      } else {
        await this.db.collection('instagram_post').save({
          _key: postId,
          creation_timestamp: new Date((post.creation_timestamp ?? 0) * 1000).toISOString(),
          title: post.title,
          media: post.media.map(m => m.uri)
        }).then(() => mediaCount++);
      }
    }

    this.log(`Saved ${posts.length} posts, ${mediaCount} media items.`)
    
    return Promise.resolve();
  }
}
