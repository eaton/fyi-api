import mysql from 'mysql2/promise';
import slugify from '@sindresorhus/slugify';
import { BaseImport, BaseImportOptions, DatabaseImportOptions } from '../../../index.js';
import { D6Comment, D6Node, D6Alias, D6User, D6Term, D6Entity, D6NodeField } from './types.js';

type Drupal6CacheData = {
  users: Record<number, D6User>,
  nodes: Record<number, D6Node>,
  nodeFields: Record<string, D6NodeField[]>,
  terms: Record<number, D6Term>,
  comments: Record<number, D6Comment>,
  aliases: Record<string, string>,
  extraTables: Record<string, unknown[]>
};

interface Drupal6ImportOptions extends BaseImportOptions, DatabaseImportOptions {

  /**
   * A list of additional tables to pull in for post-processing.
   */
  extraTables?: string[]

  /**
   * A list of node types with extra fields stored using the CCK module.
   */
  nodeTypesWithFields?: string[],

  // Multivalue CCK fields, a special hell
  nodeFields?: Record<string, string[]>,

  /**
   * A list of node types to be ignored when caching and exporting.
   */
  ignoreNodeTypes?: string[],

  ignoreUids?: number[],
}

/**
 * A basic Drupal 7 import that pulls nodes, comments, taxonomy terms, and path aliases.
 * 
 * Note that it does NOT yet deal with custom fields added by CCK.
 */
export class Drupal6Import extends BaseImport<Drupal6CacheData> {
  declare options: Drupal6ImportOptions;

  constructor(options?: Drupal6ImportOptions) {
    super(options);
  }

  async fillCache(): Promise<Drupal6CacheData> {  
    const data: Drupal6CacheData = {
      users: {},
      nodes: {},
      nodeFields: {},
      terms: {},
      comments: {},
      aliases: {},
      extraTables: {},
    }

    const tables = await this.loadTableData();

    for (const v of tables.nodes) {
      // Bail if it's an ignore-able node type
      if ((this.options.ignoreNodeTypes ?? []).includes(v.type)) continue;
      if ((this.options.ignoreUids ?? []).includes(v.uid)) continue;
      
      // Stich field values into the nodes
      for (const [nodeType, fields] of Object.entries(tables.nodeFields)) {
        if (v.type === nodeType)
        for (const field of fields) {
          if (field.nid === v.nid) {
            const { nid, vid, ...columns } = field;
            v.fields = Object.fromEntries(Object.entries(columns).map(e => [e[0].replace('field_', ''), e[1]]));
          }
        }
      }

      // Stich field values into the nodes
      for (const [nodeType, fields] of Object.entries(tables.nodeFields)) {
        if (v.type === nodeType)
        for (const field of fields) {
          if (field.nid === v.nid) {
            const { nid, vid, ...columns } = field;
            v.fields = Object.fromEntries(Object.entries(columns).map(e => [e[0].replace('field_', ''), e[1]]));
          }
        }
      }
      
      // Stich field values into the nodes
      for (const [fieldName, values] of Object.entries(tables.nodeMultiValueFields)) {
        for (const field of values) {
          if (field.nid === v.nid) {
            v.fields ??= {}
            v.fields[fieldName] ??= [];
            const { nid, delta, ...fieldValues } = field;
            const f = v.fields[fieldName];
            if (Array.isArray(f)) {
              f.push(fieldValues);
            }
          }
        }
      }

      if (v.body === v.teaser) v.teaser = undefined;

      fixDate(v);
      data.nodes[v.nid] = v;

      // Write the node
      await this.files.writeCache(`nodes/node-${v.type}-${v.nid}.json`, v);
    }

    for (const v of tables.users) {
      if ((this.options.ignoreUids ?? []).includes(v.uid)) continue;

      fixDate(v);
      data.users[v.uid] = v;
      await this.files.writeCache(`users/user-${slugify(v.name)}-${v.uid}.json`, v);
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

    const users = (await conn.execute(`
      SELECT u.uid AS uid, u.name AS name, u.mail AS mail, u.created AS date FROM \`users\` u;
    `).catch(() => [[]]))[0] as D6User[];

    const nodes = (await conn.execute(`
      SELECT
      n.nid AS nid, n.type AS type, n.title AS title, n.uid AS uid, n.status AS status, n.created AS date,
      nr.body AS body, nr.teaser as teaser, nr.format AS format
      FROM \`node\` n LEFT JOIN \`node_revisions\` nr ON n.vid = nr.vid;
    `).catch(() => [[]]))[0] as D6Node[];

    const terms = (await conn.execute(`
      SELECT
      td.tid AS tid, td.name AS name, td.description AS description, td.weight AS weight,
      v.name as vocabulary
      FROM \`term_data\` td
      LEFT JOIN \`vocabulary\` v ON v.vid = td.vid;
    `).catch(() => [[]]))[0] as D6Term[];

    const comments = (await conn.execute(`
      SELECT
      c.cid AS cid, c.nid AS nid, c.pid AS pid, c.hostname AS hostname, c.timestamp AS date, c.name AS name, c.mail AS mail, c.homepage AS homepage, c.subject AS title, c.comment AS body
      FROM \`comments\` c
      WHERE c.status = 0;
  `).catch(() => [[]]))[0] as D6Comment[];

  const nodeFields: Record<string, D6NodeField[]> = {};
  const nodeMultiValueFields: Record<string, D6NodeField[]> = {};
    
    // Do the queries for all the individual fields. It's hell.
    for (const nodeType of this.options.nodeTypesWithFields ?? []) {
      const query = `SELECT * FROM \`content_type_${nodeType}\``;
      nodeMultiValueFields[nodeType] = (await conn.execute(query))[0] as D6NodeField[];
    }
    
    if (this.options.nodeMultiValueFields) {
      // Do the queries for all the individual fields. It's hell.
      for (const [field, columns] of Object.entries(this.options.nodeMultiValueFields)) {
        const tableName = `content_field_${field}`;

        const columnList: string[] = ['nid', 'vid', 'delta'];
        for (const column of columns) {
          const columnName = `field_${field}_${column}`;
          columnList.push(`${columnName} AS ${column}`)
        }
        const query = `SELECT ${columnList.join(', ')} FROM \`${tableName}\` WHERE entity_type = 'node';`;

        // Ultimately we should stitch this back into the nodes. 
        nodeMultiValueFields[field] = (await conn.execute(query))[0] as D6NodeField[];
      }
    }

    const extraTables: Record<string, unknown[]> = {};
    for (const table of this.options.extraTables ?? []) {
      extraTables[table] = (await conn.execute(`SELECT * FROM \`${table}\`;`))[0] as unknown[];
    }

    const aliases = (await conn.execute(`
      SELECT dst AS source, src AS alias from \`url_alias\`;
    `).catch(() => [[]]))[0] as D6Alias[];

    await conn.end();

    return Promise.resolve({
      users, nodes, nodeFields, nodeMultiValueFields, terms, comments, aliases, extraTables
    });
  }
}

function fixDate(input: D6Entity) {
  if ('date' in input && typeof input.date === 'number') {
    input.date = new Date(input.date * 1000).toISOString();
  }
}