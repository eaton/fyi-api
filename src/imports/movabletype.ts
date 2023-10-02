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

  async doImport(): Promise<void> {
    throw new Error('Method not implemented.');
  }

  async fillCache(): Promise<void> {  
    this.files.ensureOutput('movabletype/unfiltered');
  
    const conn = await mysql.createConnection({
      host: this.sqlHost,
      user: this.sqlUser,
      password: this.sqlPass,
      database: this.sqlDb
    });

    await conn.execute('SELECT * FROM `mt_blog`')
      .then(results => this.files.writeCache('movabletype/blogs.json', results[0]))
      .then(() => this.log('Blogs cached'));
  
    await conn.execute('SELECT * FROM `mt_author`')
      .then(results => this.files.writeCache('movabletype/authors.json', results[0]))
      .then(() => this.log('Authors cached'));
  
    await conn.execute('SELECT * FROM `mt_category`')
      .then(results => this.files.writeCache('movabletype/categories.json', results[0]))
      .then(() => this.log('Categories cached'));
  
    await conn.execute('SELECT * FROM `mt_entry`')
      .then(results => this.files.writeCache('movabletype/entries.json', results[0]))
      .then(() => this.log('Entries cached'));
  
    await conn.execute('SELECT * FROM `mt_comment` WHERE comment_visible = 1')
      .then(results => this.files.writeCache('movabletype/comments.json', results[0]))
      .then(() => this.log('Comments cached'));
  
    await conn.end();
  
    return Promise.resolve();
  }
}
