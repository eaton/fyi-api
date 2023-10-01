import { Database, CreateCollectionOptions } from "../util/database.js"
import { Filestore } from "../util/filestore.js"

export interface BaseImportOptions extends Record<string, unknown> {
  db?: Database,
  files?: Filestore,
  logLevel?: number,
}

/**
 * Skeleton for raw migrations; it makes it easy-ish to avoid some of the frequent
 * boilerplate code when doing cycles of testing.
 */
export abstract class BaseImport {
  logLevel: number = 0;

  private _db?: Database;
  private _files?: Filestore;

  get db(): Database {
    if (this._db === undefined) {
      this._db = new Database();
    }
    return this._db;
  }

  get files(): Filestore {
    if (this._files === undefined) {
      this._files = new Filestore();
    }
    return this._files;
  }

  collections?: Record<string, CreateCollectionOptions>;
  relationships?: Record<string, CreateCollectionOptions>;

  constructor(options: BaseImportOptions = {}) {
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
  async ensureSchema(): Promise<string[]> {
    const results: string[] = [];
    if (this.collections || this.relationships) {
      for (const [name, options] of Object.entries(this.collections ?? {})) {
        results.push(
          await this.db.ensureCollection(name, options).then(() => `${name} was ensured`)
        );
      }
      for (const [name, options] of Object.entries(this.relationships ?? {})) {
        results.push(
          await this.db.ensureEdgeCollection(name, options).then(() => `${name} was ensured`)
        );
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
  async destroySchema(): Promise<string[]> {
    const results: string[] = [];

    if (this.collections || this.relationships) {
      for (const [name] of Object.entries(this.collections ?? {})) {
        results.push(await this.db.collection(name).exists()
          .then(exists => {
            if (exists) return this.db.collection(name).drop().then(() => `${name} destroyed`);
            return `${name} did not exist`;
          }));
      }

      for (const [name] of Object.entries(this.relationships ?? {})) {
        results.push(await this.db.collection(name).exists()
          .then(exists => {
            if (exists) return this.db.collection(name).drop().then(() => `${name} destroyed`);
            return `${name} did not exist`;
          }));
      }
    }
    return Promise.resolve(results);
  }
}