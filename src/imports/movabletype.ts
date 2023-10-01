import { BaseImport, BaseImportOptions } from '../index.js';
import mysql from 'mysql2/promise';

export interface MovableTypeOptions extends BaseImportOptions {
  sqlHost?: string,
  sqlUser?: string,
  sqlPass?: string,
  sqlDb?: string,
}

export class MovableType extends BaseImport {
  sqlHost?: string;
  sqlUser?: string;
  sqlPass?: string;
  sqlDb?: string;

  constructor(options?: MovableTypeOptions) {
    super(options);

    this.sqlHost = options?.sqlHost ?? process.env.MYSQL_HOST
    this.sqlUser = options?.sqlUser ?? process.env.MYSQL_USER
    this.sqlPass = options?.sqlPass ?? process.env.MYSQL_PASS
    this.sqlDb = options?.sqlDb ?? process.env.MYSQL_DB
  }

  async doImport(): Promise<string[]> {
    throw new Error('Method not implemented.');
  }

  async preload() {  
    this.files.ensure('raw/movabletype/unfiltered');
  
    const conn = await mysql.createConnection({
      host: this.sqlHost,
      user: this.sqlUser,
      password: this.sqlPass,
      database: this.sqlDb
    });

    const messages: string[] = [];

    await conn.execute('SELECT * FROM `mt_blog`')
      .then(results => this.files.write('raw/movabletype/unfiltered/blogs.json', results[0]))
      .then(() => messages.push('Blogs saved'));
  
    await conn.execute('SELECT * FROM `mt_author`')
      .then(results => this.files.write('raw/movabletype/unfiltered/authors.json', results[0]))
      .then(() => messages.push('Authors saved'));
  
    await conn.execute('SELECT * FROM `mt_category`')
      .then(results => this.files.write('raw/movabletype/unfiltered/categories.json', results[0]))
      .then(() => messages.push('Categories saved'));
  
    await conn.execute('SELECT * FROM `mt_entry`')
      .then(results => this.files.write('raw/movabletype/unfiltered/entries.json', results[0]))
      .then(() => messages.push('Entries saved'));
  
    await conn.execute('SELECT * FROM `mt_comment` WHERE comment_visible = 1')
      .then(results => this.files.write('raw/movabletype/unfiltered/comments.json', results[0]))
      .then(() => messages.push('Comments saved'));
  
    await conn.end();
  
    return Promise.resolve(messages);
  }
}
