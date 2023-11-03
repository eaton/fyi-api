import { BaseImport, makeMedia } from '../../index.js';
import { IGCachedPost, InstagramPost, InstagramProfileChunk } from './types.js';
import { Ids } from 'mangler';

type InstagramCache = {
  posts: IGCachedPost[],
  profile: Record<string, string>
};

export class Instagram extends BaseImport<InstagramCache> {
  collections = ['instagram_post'];

  async loadCache(): Promise<InstagramCache> {
    return this.fillCache();
  }

  async fillCache(): Promise<InstagramCache> {
    const cache: InstagramCache = {
      posts: [],
      profile: {}
    }

    const files = await this.files.findInput('content/posts_*.json');
    let mediaCount = 0;
    for (const file of files) {
      const raw = await this.files.readInput(file) as InstagramPost[];
      for (const incoming of raw) {
        const post: IGCachedPost = {
          id: Ids.uuid(incoming),
          date: incoming.creation_timestamp ? new Date(incoming.creation_timestamp * 1000).toISOString() : undefined,
          title: incoming.title?.toString() ?? '',
          media: []
        };
        for (const m of incoming.media) {
          post.media.push(makeMedia(m))
          mediaCount++;
        }
        cache.posts.push(post);
      }
    }

    const profileFiles = ['login_and_account_creation/signup_information.json', 'personal_information/personal_information.json']
    for (const file of profileFiles) {
      const raw = await this.files.readInput(file) as Record<string, InstagramProfileChunk[]>;
      for (const chunks of Object.values(raw)) {
        for (const chunk of chunks) {
          for (const [key, values] of Object.entries(chunk.string_map_data)) {
            if (values.href !== '') {
              cache.profile[key] = values.href;
            } else if (values.timestamp !== 0) {
              cache.profile[key] = new Date(values.timestamp * 1000).toISOString();
            } else if (values.value !== ''){
              cache.profile[key] = values.value;
            }
          }
        }
      }
    }

    await this.files.writeCache(`profile-${cache.profile['Username']}.json`, cache.profile)
    for (const p of cache.posts) {
      await this.files.writeCache(`posts/post-${p.id}.json`, p);
    }
    
    this.log(`Cached ${cache.posts.length} posts by ${cache.profile['Username']} with ${mediaCount} media items`)

    return Promise.resolve(cache);
  }

  async savePosts(cache: InstagramCache): Promise<void> {
    for (const post of cache.posts) {
      await this.db.collection('instagram_post').save({ _key: post.id, ...post });
    }
  }
}
