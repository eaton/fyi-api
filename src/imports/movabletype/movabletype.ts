import { BaseImport, BaseImportOptions } from '../../index.js';

import humanizeUrl from 'humanize-url';
import slugify from '@sindresorhus/slugify';
import mysql from 'mysql2/promise';

import {
  MovableTypeTables,
  MovableTypeAuthorRow,
  MovableTypeBlogRow,
  MovableTypeCategoryRow,
  MovableTypeCommentRow,
  MovableTypeEntryRow
} from './types.js';

export interface MovableTypeOptions extends BaseImportOptions {
  sqlHost?: string,
  sqlUser?: string,
  sqlPass?: string,
  sqlDb?: string,
  tables?: Record<string, string>,
}

export class MovableType extends BaseImport<MovableTypeTables> {
  declare options: MovableTypeOptions;

  async loadCache(): Promise<Record<string, MovableTypeTables>> {
    let results: Record<string, MovableTypeTables> = {};

    // TODO
    // Load per-blog cache and return it, if it exists.
    // If it doesn't, load the table cache and group it
    // If that doesn't, try to populate the cache from the SQL database.

    return Promise.resolve(results);
  }

  async fillCache(): Promise<Record<string, MovableTypeTables>> {  
    this.files.ensureOutput('movabletype/unfiltered');
  
    const conn = await mysql.createConnection({
      host: this.options.sqlHost ?? process.env.MYSQL_HOST,
      user: this.options.sqlUser ?? process.env.MYSQL_USER,
      password: this.options.sqlPass ?? process.env.MYSQL_PASS,
      database: this.options.sqlDb ?? process.env.MYSQL_DB
    });

    // The core tables we handle manually
    const tables: Partial<MovableTypeTables> = {};
    tables.authors = [...(await conn.execute('SELECT * FROM `mt_author`'))[0] as MovableTypeAuthorRow[]] ?? [];
    tables.blogs = [...(await conn.execute('SELECT * FROM `mt_blog`'))[0] as MovableTypeBlogRow[]] ?? [];
    tables.categories = [...(await conn.execute('SELECT * FROM `mt_category`'))[0] as MovableTypeCategoryRow[]] ?? [];
    tables.entries = [...(await conn.execute('SELECT * FROM `mt_entry`'))[0] as MovableTypeEntryRow[]] ?? [];
    tables.comments = [...(await conn.execute('SELECT * FROM `mt_comment`'))[0] as MovableTypeCommentRow[]] ?? [];

    // Any additional tables the user wants to back up
    for (const [name, table] of Object.entries(this.options?.tables ?? {})) {
      await conn.execute(`select * from ${table}`)
        .then(results => this.files.writeCache(`tables/${name}.json`, results[0]))
        .catch((err: unknown) => this.log(err));
    }

    await conn.end();
  
    const blogs = await this.groupTablesByBlog(tables);

    for (const blog_tables of Object.values(blogs)) {
      const blogName = blog_tables.blogs[0].blog_name;
      const blogSlug = slugify(blogName);
      for (const [name, set] of Object.entries(blog_tables)) {
        await this.files.writeCache(`blog-${blogSlug}/${name}.json`, set);
      }
      this.log(`"${blogName}" cached (${blog_tables.entries.length} entries, ${blog_tables.comments.length} comments)`);
    }

    return Promise.resolve(blogs);
  }

  async groupTablesByBlog(tables: Partial<MovableTypeTables> = {}): Promise<Record<string, MovableTypeTables>> {
    const results: Record<string, MovableTypeTables> = {};

    for (const blog of tables.blogs ?? []) {
      const blogSlug = slugify(humanizeUrl(blog.blog_site_url));

      const entries = tables.entries?.filter(e => e.entry_blog_id === blog.blog_id) ?? [];
      const comments = tables.comments?.filter(c => c.comment_blog_id === blog.blog_id) ?? [];
      const categories = tables.categories?.filter(c => c.category_blog_id === blog.blog_id) ?? [];
      const authors = tables.authors?.filter(
        a => entries?.find(e => e.entry_author_id === a.author_id)
      ) ?? [];
      results[blogSlug] = { blogs: [blog], entries, comments, categories, authors };
    }
    
    return Promise.resolve(results);
  }
}
