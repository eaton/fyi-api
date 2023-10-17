import { BaseImport, BaseImportOptions } from '../../index.js';
import { Textile } from '../../index.js';
import is from '@sindresorhus/is';
import humanizeUrl from 'humanize-url';
import slugify from '@sindresorhus/slugify';
import mysql from 'mysql2/promise';

import {
  MovableTypeTables,
  MovableTypeAuthorRow,
  MovableTypeBlogRow,
  MovableTypeCategoryRow,
  MovableTypeCommentRow,
  MovableTypeEntryRow,
  MovableTypeRow,
  isAuthor,
  isBlog,
  isCategory,
  isComment,
  isEntry
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

  constructor(options?: MovableTypeOptions) {
    super(options);
  }

  async loadCache(): Promise<Record<string, MovableTypeTables>> {
    let results: Record<string, MovableTypeTables> = {};

    // TODO
    // Load per-blog cache and return it, if it exists.
    // If it doesn't, load the table cache and group it
    // If that doesn't, try to populate the cache from the SQL database.

    return Promise.resolve(results);
  }

  async fillCache(): Promise<Record<string, MovableTypeTables>> {  
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
        await this.files.writeCache(`${blogSlug}-${name}.json`, set.map(r => this.buildFromRow(r as MovableTypeRow)));
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

  buildFromRow(input: MovableTypeRow) {
    if (isBlog(input)) {
      return {
        id: input.blog_id,
        name: input.blog_name,
        url: input.blog_site_url,
        message: ultraTrim(input.blog_welcome_msg),
      }
    } else if (isAuthor(input)) {
      return {
        id: input.author_id,
        type: input.author_type,
        name: input.author_name,
        nickname: ultraTrim(input.author_nickname),
        email: input.author_email,
      }
    } else if (isCategory(input)) {
      return {
        id: input.category_id,
        blog: input.category_blog_id,
        name: input.category_label,
        description: ultraTrim(input.category_description),
        parent: input.category_parent ?? undefined,
      }
    } else if (isEntry(input)) {
      return {
        id: input.entry_id,
        blog: input.entry_blog_id,
        status: input.entry_status,
        date: input.entry_created_on,
        title: input.entry_title,
        author: input.entry_author_id,
        category: input.entry_category_id ?? undefined,
        // excerpt: ultraTrim(input.entry_excerpt), // We never actually used this, it's borked
        body: ultraTrim(input.entry_text),
        extended: ultraTrim(input.entry_text_more),
        keywords: keywordsToObject(input.entry_keywords) ?? keywordsToObject(input.entry_excerpt),
        format: input.entry_convert_breaks,
      }
    } else if (isComment(input)) {
      return {
        id: input.comment_id,
        blog: input.comment_blog_id,
        entry: input.comment_entry_id,
        ip: input.comment_ip,
        date: input.comment_created_on,
        name: ultraTrim(input.comment_author),
        email: ultraTrim(input.comment_email),
        url: ultraTrim(input.comment_url),
        body: input.comment_text,
      }
    }
    return input;
  }

  filterText(text: string, format: string) {
    return text;
    if (format === 'textile_2') {
      return Textile.toHtml(text);
    } else if (format === '__default__') {
      return mtLinebreaks(text);
    } else {
      return text;
    }
  }
}

function mtLinebreaks(text: string) {
  return text;
}

function ultraTrim(input: string | null | undefined) {
  if (is.nonEmptyStringAndNotWhitespace(input)) return input.trim();
  return undefined;
}

function keywordsToObject(keywords?: string) {
  if (!keywords) return undefined;
  const keyValues = keywords.split('\n');
  return Object.fromEntries(keyValues.map(kv => kv.split('=')));
}