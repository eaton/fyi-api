import { Database, CreateCollectionOptions } from "../storage/database.js"
import { Filestore } from "../storage/filestore.js"

export interface ImportOptions extends Record<string, unknown> {
  db?: Database,
  files?: Filestore,
  logLevel?: number,
}

/**
 * Skeleton for raw migrations; it makes it easy-ish to avoid some of the frequent
 * boilerplate code when doing cycles of testing.
 */
export abstract class Import {
  logLevel: number = 0;

  private _db?: Database;
  private _files?: Filestore;

  get db(): Database {
    if (this._db) return this._db;
    throw new Error('No ArangoDB connection');
  }

  get files(): Filestore {
    if (this._files) return this.files;
    throw new Error('No filesystem wrapper');
  }

  collections?: string[] | Record<string, CreateCollectionOptions>;
  relationships?: string[] | Record<string, CreateCollectionOptions>;

  constructor(options: ImportOptions = {}) {
    if (options.db) this._db = options.db;
    if (options.files) this._files = options.files;
    if (options.logLevel) this.logLevel = options.logLevel;
  };

  /**
   * A pre-migration step that can be used to fetch remote information or pre-process
   * files. `preload()` might scrape pages from a site and store them in the `/raw` directory,
   * while `doImport()` actually populates the ArangoDB instance.
   *
   * @returns A promise that resolves to a list of messages logged during the preload.
   */
  preload(): Promise<Record<string, string>> {
    return Promise.resolve({});
  }

  /**
   * Every import must implement doImport(); that's just the law.   
   *
   * @returns A promise that resolves to a list of messages logged during the migration.
   */
  abstract doImport(): Promise<string[]>

  /**
   * Check for any necessary ArangoDB collections and create them if they don't exists.   
   *
   * @returns A promise that resolves to a dictionary of collections, noting
   * whether they were already in place or created from scratch. 
   */
  async ensureSchema(): Promise<Record<string, string>> {
    const results: Record<string, string> = {};

    if (this.db === undefined) {
      // We can't ensure tables if that happens, duh
    } else {
      if (this.collections === undefined) {
        // Do nothing!
      } else if (Array.isArray(this.collections)) {
        for (const name of this.collections) {
          results[name] = await this.db?.ensureCollection(name).then(c => 'ensured')
        }
      } else {
        for (const [name, options] of Object.entries(this.collections)) {
          results[name] = await this.db?.ensureCollection(name, options).then(c => 'ensured')
        }
      }

      if (this.relationships === undefined) {
        // Do nothing!
      } else if (Array.isArray(this.relationships)) {
        for (const name of this.relationships) {
          results[name] = await this.db?.ensureEdgeCollection(name).then(c => 'ensured')
        }
      } else {
        for (const [name, options] of Object.entries(this.relationships)) {
          results[name] = await this.db?.ensureEdgeCollection(name, options).then(c => 'ensured')
        }
      }
    }

    return Promise.resolve(results);
  }

  /**
   * Destroy any ArangoDB collections unique to this import, discarding their data.
   * 
   * NOTE: During early testing, this is often used right before `ensureSchema()`,
   * but obviously it should not be used when doing ongoing updates. Because it
   * nukes everything.
   * 
   * @returns A promise that resolves to a list of collections deleted, and the number
   * of records that were discarded.
   *
   * @returns {Promise<Record<string, number>>}
   */
  async destroySchema(): Promise<Record<string, string>> {
    const results: Record<string, string> = {};

    if (this.db === undefined) {
      // We can't ensure tables if that happens, duh
    } else {
      if (this.collections === undefined) {
        // Do nothing!
      } else if (Array.isArray(this.collections)) {
        for (const name of this.collections) {
          await this.db.collection(name).exists()
            .then(exists => {
              if (exists) return this.db.collection(name).drop().then(() => 'removed');
              return 'already gone';
            })
        }
      } else {
        for (const [name] of Object.entries(this.collections)) {
          await this.db.collection(name).exists()
            .then(exists => {
              if (exists) return this.db.collection(name).drop().then(() => 'removed');
              return 'already gone';
            })
        }
      }

      if (this.relationships === undefined) {
        // Do nothing!
      } else if (Array.isArray(this.relationships)) {
        for (const name of this.relationships) {
          await this.db.collection(name).exists()
            .then(exists => {
              if (exists) return this.db.collection(name).drop().then(() => 'removed');
              return 'already gone';
            })
        }
      } else {
        for (const [name] of Object.entries(this.relationships)) {
          await this.db.collection(name).exists()
            .then(exists => {
              if (exists) return this.db.collection(name).drop().then(() => 'removed');
              return 'already gone';
            })
        }
      }
    }

    return Promise.resolve(results);
  }
}