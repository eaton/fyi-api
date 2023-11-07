import mysql from 'mysql2/promise';
import slugify from '@sindresorhus/slugify';
import {
  BaseImport,
  BaseImportOptions,
  DatabaseImportOptions
} from '../../../index.js';
import {
  D7Comment,
  D7Node,
  D7Alias,
  D7User,
  D7Term,
  D7Entity,
  D7NodeField
} from './types.js';

type Drupal7CacheData = {
  users: Record<number, D7User>;
  nodes: Record<number, D7Node>;
  nodeFields: Record<string, D7NodeField[]>;
  terms: Record<number, D7Term>;
  comments: Record<number, D7Comment>;
  aliases: Record<string, string>;
  extraTables: Record<string, unknown[]>;
};

interface Drupal7ImportOptions
  extends BaseImportOptions,
    DatabaseImportOptions {
  /**
   * A list of additional tables to pull in for post-processing.
   */
  extraTables?: string[];

  /**
   * A list of FieldAPI fields and their columns that should be added to each node's data.
   *
   * The snippet below would check the table `field_data_field_slogan` for the columns
   * `field_slogan_text` and `field_slogan_format`.
   *
   * ```
   * nodeFields: {
   *    slogan: ['text', 'format']
   * }
   * ```
   */
  nodeFields?: Record<string, string[]>;

  ignoreNodeTypes?: string[];

  ignoreUids?: number[];
}

/**
 * A basic Drupal 7 import that pulls nodes, comments, taxonomy terms, and path aliases.
 *
 * Note that it does NOT yet deal with custom fields added by CCK.
 */
export class Drupal7Import extends BaseImport<Drupal7CacheData> {
  declare options: Drupal7ImportOptions;

  constructor(options?: Drupal7ImportOptions) {
    super(options);
  }

  async fillCache(): Promise<Drupal7CacheData> {
    const data: Drupal7CacheData = {
      users: {},
      nodes: {},
      nodeFields: {},
      terms: {},
      comments: {},
      aliases: {},
      extraTables: {}
    };

    const tables = await this.loadTableData();

    for (const v of tables.nodes) {
      if ((this.options.ignoreNodeTypes ?? []).includes(v.type)) continue;
      if ((this.options.ignoreUids ?? []).includes(v.uid)) continue;

      // Stich field values into the nodes
      for (const [fieldName, values] of Object.entries(tables.nodeFields)) {
        for (const field of values) {
          if (field.nid === v.nid) {
            v.fields ??= {};
            v.fields[fieldName.replace('field_', '')] ??= [];

            const { nid, vid, delta, ...fieldValues } = field;
            v.fields[fieldName.replace('field_', '')].push(fieldValues);
          }
        }
      }

      fixDate(v);
      data.nodes[v.nid] = v;

      // Write the node
      await this.files.writeCache(`nodes/node-${v.type}-${v.nid}.json`, v);
    }

    for (const v of tables.users) {
      if ((this.options.ignoreUids ?? []).includes(v.uid)) continue;

      fixDate(v);
      data.users[v.uid] = v;
      await this.files.writeCache(
        `users/user-${slugify(v.name)}-${v.uid}.json`,
        v
      );
    }
    for (const v of tables.terms) {
      data.terms[v.tid] = v;
      await this.files.writeCache(`terms/term-${v.tid}.json`, v);
    }
    for (const v of tables.comments) {
      fixDate(v);
      data.comments[v.cid] = v;
      await this.files.writeCache(`comments/comment-${v.cid}.json`, v);
    }
    for (const v of tables.aliases) {
      data.aliases[v.alias] = v.source;
    }
    await this.files.writeCache(`aliases.json`, data.aliases);

    for (const [table, values] of Object.entries(tables.extraTables)) {
      await this.files.writeCache(`${table}.json`, values);
    }

    return Promise.resolve(data);
  }

  protected async loadTableData() {
    const conn = await mysql.createConnection({
      host: this.options.database?.host ?? '',
      user: this.options.database?.user ?? '',
      password: this.options.database?.pass ?? '',
      database: this.options.database?.dbName ?? ''
    });

    const users = (
      await conn
        .execute(
          `
      SELECT u.uid AS uid, u.name AS name, u.mail AS mail, u.created AS date FROM \`users\` u;
    `
        )
        .catch(() => [[]])
    )[0] as D7User[];

    const nodes = (
      await conn
        .execute(
          `
      SELECT
      n.nid AS nid, n.type AS type, n.title AS title, n.uid AS uid, n.status AS status, n.created AS date,
      fdb.body_value AS body, fdb.body_format AS format
      FROM \`node\` n LEFT JOIN \`field_data_body\` fdb ON n.vid = fdb.revision_id;
    `
        )
        .catch(() => [[]])
    )[0] as D7Node[];

    const terms = (
      await conn
        .execute(
          `
      SELECT
      ttd.tid AS tid, ttd.name AS name, ttd.description AS description, ttd.format AS format, ttd.weight AS weight,
      tv.machine_name as vocabulary
      FROM \`taxonomy_term_data\` ttd
      LEFT JOIN \`taxonomy_vocabulary\` tv ON tv.vid = ttd.vid;
    `
        )
        .catch(() => [[]])
    )[0] as D7Term[];

    const comments = (
      await conn
        .execute(
          `
      SELECT
      c.cid AS cid, c.nid AS nid, c.pid AS pid, c.hostname AS hostname, c.created AS date, c.name AS name, c.mail AS mail, c.homepage AS homepage, c.subject AS title,
      fcb.comment_body_value AS body, fcb.comment_body_format AS format
      FROM \`comment\` c LEFT JOIN \`field_data_comment_body\` fcb ON c.cid = fcb.entity_id
      WHERE c.status = 1;
    `
        )
        .catch(() => [[]])
    )[0] as D7Comment[];

    const nodeFields: Record<string, D7NodeField[]> = {};

    if (this.options.nodeFields) {
      // Do the queries for all the individual fields. It's hell.
      for (const [field, columns] of Object.entries(this.options.nodeFields)) {
        const tableName = `field_data_${field}`;

        const columnList: string[] = ['entity_id AS nid', 'delta AS delta'];
        for (const column of columns) {
          const columnName = `${field}_${column}`;
          columnList.push(`${columnName} AS ${column}`);
        }
        const query = `SELECT ${columnList.join(
          ', '
        )} FROM \`${tableName}\` WHERE entity_type = 'node';`;

        // Ultimately we should stitch this back into the nodes.
        nodeFields[field] = (await conn.execute(query))[0] as D7NodeField[];
      }
    }

    const extraTables: Record<string, unknown[]> = {};
    for (const table of this.options.extraTables ?? []) {
      extraTables[table] = (
        await conn.execute(`SELECT * FROM \`${table}\`;`)
      )[0] as unknown[];
    }

    const aliases = (
      await conn
        .execute(
          `
      SELECT source, alias from \`url_alias\` where language = 'und';
    `
        )
        .catch(() => [[]])
    )[0] as D7Alias[];

    await conn.end();

    return Promise.resolve({
      users,
      nodes,
      nodeFields,
      terms,
      comments,
      aliases,
      extraTables
    });
  }
}

function fixDate(input: D7Entity) {
  if ('date' in input && typeof input.date === 'number') {
    input.date = new Date(input.date * 1000).toISOString();
  }
}
