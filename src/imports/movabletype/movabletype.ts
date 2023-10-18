import { BaseImport, BaseImportOptions, DatabaseImportOptions } from '../../index.js';
import { Textile } from '../../index.js';
import is from '@sindresorhus/is';
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
  isEntry,
  MTData,
  MTAuthor,
  MTBlog,
  MTCategory,
  MTComment,
  MTEntry
} from './types.js';

export interface MovableTypeOptions extends BaseImportOptions, DatabaseImportOptions {
  extraTables?: Record<string, string>,
  authors?: number[]
}

export class MovableType extends BaseImport<MTData> {
  declare options: MovableTypeOptions;

  constructor(options?: MovableTypeOptions) {
    super(options);
  }

  async doImport(): Promise<void> {
    const cache = await this.loadCache();
    await this.output11ty(cache);
  }

  async loadCache(): Promise<MTData> {
    let files = await this.files.findCache('(authors,blogs,categories,comments,entries)/*.json');
    if (files.length === 0) {
      return this.fillCache();
    }

    const results: MTData = {
      blogs: {},
      authors: {},
      categories: {},
      entries: {},
      comments: {},
    };

    for (const file of files) {
      if (file.startsWith('blogs')) {
        const data = await this.files.readCache(file) as MTBlog;
        results.blogs[data.id] = data;
      } else if (file.startsWith('authors')) {
        const data = await this.files.readCache(file) as MTAuthor;
        results.authors[data.id] = data;
      } else if (file.startsWith('categories')) {
        const data = await this.files.readCache(file) as MTCategory;
        results.categories[data.id] = data;
      } else if (file.startsWith('entries')) {
        const data = await this.files.readCache(file) as MTEntry;
        results.entries[data.id] = data;
      } else if (file.startsWith('comments')) {
        const data = await this.files.readCache(file) as MTComment;
        results.comments[data.id] = data;
      }
    }

    return Promise.resolve(results);
  }

  async fillCache(): Promise<MTData> {  
    const conn = await mysql.createConnection({
      host: this.options.database?.host ?? '',
      user: this.options.database?.user ?? '',
      password: this.options.database?.pass ?? '',
      database: this.options.database?.dbName ?? ''
    });

    // The core tables we handle manually
    const tables: MovableTypeTables = {
      authors: [...(await conn.execute('SELECT * FROM `mt_author`'))[0] as MovableTypeAuthorRow[]] ?? [],
      blogs: [...(await conn.execute('SELECT * FROM `mt_blog`'))[0] as MovableTypeBlogRow[]] ?? [],
      categories: [...(await conn.execute('SELECT * FROM `mt_category`'))[0] as MovableTypeCategoryRow[]] ?? [],
      entries: [...(await conn.execute('SELECT * FROM `mt_entry`'))[0] as MovableTypeEntryRow[]] ?? [],
      comments: [...(await conn.execute('SELECT * FROM `mt_comment`'))[0] as MovableTypeCommentRow[]] ?? []
    }

    // Any additional tables the user wants to back up
    for (const [name, table] of Object.entries(this.options?.extraTables ?? {})) {
      await conn.execute(`select * from ${table}`)
        .then(results => this.files.writeCache(`tables/${name}.json`, results[0]))
        .catch((err: unknown) => this.log(err));
    }

    await conn.end();
  
    const output = this.tablesToData(tables);

    // Actually write the data
    for (const [dataType, data] of Object.entries(output)) {
      for (const [id, record] of Object.entries(data)) {
        const slug = (record.slug?.toString() ?? record.title?.toString() ?? record.name?.toString() ?? 'unknown')
        await this.files.writeCache(`${dataType}/${dataType}-${id}-${slugify(slug)}.json`, record);
      }
    }

    return Promise.resolve(output);
  }

  async output11ty(data: MTData) {
    /**
    for (const entry of Object.values(data.entries)) {
      const post = {}
    }
    return {}
    */
  }

  async outputArangoDb(data: MTData) {
    
  }

  protected tablesToData(tables: MovableTypeTables): MTData {
    const output: MTData = {
      blogs: Object.fromEntries(tables.blogs.map(e => [e.blog_id, this.buildFromRow(e)])),
      authors: Object.fromEntries(tables.authors.map(e => [e.author_id, this.buildFromRow(e)])),
      categories: Object.fromEntries(tables.categories.map(e => [e.category_id, this.buildFromRow(e)])),
      entries: Object.fromEntries(tables.entries.map(e => [e.entry_id, this.buildFromRow(e)])),
      comments: Object.fromEntries(tables.comments.map(e => [e.comment_id, this.buildFromRow(e)])),
    };
    return output;
  }

  protected buildFromRow(input: MovableTypeBlogRow): MTBlog
  protected buildFromRow(input: MovableTypeAuthorRow): MTAuthor
  protected buildFromRow(input: MovableTypeCategoryRow): MTCategory
  protected buildFromRow(input: MovableTypeEntryRow): MTEntry
  protected buildFromRow(input: MovableTypeCommentRow): MTComment
  protected buildFromRow(input: MovableTypeRow) {
    if (isBlog(input)) {
      return {
        id: input.blog_id,
        name: input.blog_name,
        url: input.blog_site_url,
        message: ultraTrim(input.blog_welcome_msg),
      } as MTBlog;
    } else if (isAuthor(input)) {
      return {
        id: input.author_id,
        type: input.author_type,
        name: input.author_name,
        nickname: ultraTrim(input.author_nickname),
        email: input.author_email,
      } as MTAuthor;
    } else if (isCategory(input)) {
      return {
        id: input.category_id,
        blog: input.category_blog_id,
        name: input.category_label,
        description: ultraTrim(input.category_description),
        parent: input.category_parent ?? undefined,
      }  as MTCategory;
    } else if (isEntry(input)) {
      return {
        id: input.entry_id,
        blog: input.entry_blog_id,
        status: input.entry_status,
        date: input.entry_created_on,
        title: input.entry_title,
        author: input.entry_author_id,
        category: input.entry_category_id ?? undefined,
        body: ultraTrim(input.entry_text),
        extended: ultraTrim(input.entry_text_more),
        keywords: keywordsToObject(input.entry_keywords) ?? keywordsToObject(input.entry_excerpt),
        format: input.entry_convert_breaks,
      } as MTEntry;
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
      } as MTComment;
    }
    return input;
  }

  protected filterText(text: string, format: string) {
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