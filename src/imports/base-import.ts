import { Filestore, Database, FilestoreOptions } from "../index.js"
import chalk from 'chalk';
import { kebabCase } from "../index.js";

/**
 * Core options supported by most imports
 */
export interface BaseImportOptions extends Record<string, unknown> {
  name?: string,
  files?: Filestore | FilestoreOptions;
  db?: Database,
  logger?: (...data: unknown[]) => void;
}

/**
 * Auth and connectivity options for imports that use a SQL database
 */
export interface DatabaseImportOptions {
  database?: {
    host?: string,
    user?: string,
    pass?: string,
    dbName?: string,
  }
}

/**
 * Concurrency and timing options for imports that scrape pages
 */
export interface ScraperImportOptions extends Record<string, unknown> {
  maxRequestsPerMinute?: number,
  maxConcurrency?: number,
  sameDomainDelaySec?: number
}

/**
 * Skeleton for raw migrations; it makes it easy-ish to avoid some of the frequent
 * boilerplate code when doing cycles of testing.
 */
export abstract class BaseImport<CacheType = unknown> {
  collections?: string[] = undefined;
  relationships?: string[] = undefined;
  cacheData?: CacheType;

  constructor(protected options: BaseImportOptions = {}) {};

  get status() {
    return {
      name: this.name,
      input: this.files.input,
      cache: this.files.cache,
      output: this.files.output,
    }
  }

  get name(): string {
    return this.options.name ?? kebabCase(this.constructor.name);
  }

  get db(): Database {
    if (this.options.db === undefined) {
      this.options.db = new Database();
    }
    return this.options.db;
  }

  get files(): Filestore {
    if (this.options.files instanceof Filestore) {
      return this.options.files;
    } else {
      this.options.files = new Filestore({
        bucket: this.name,
        ...this.options.files
      });
      return this.options.files;
    }
  }

  log(...data: unknown[]) {
    if (this.options.logger) {
      this.options.logger(data)
    } else {
      if (typeof(data[0]) === 'string') {
        data[0] = `${chalk.bold(this.name)}: ` + data[0];
        console.log(...data);
      } else {
        console.log(`${chalk.bold(this.name)}:`, ...data);
      }
    }
  }

  /**
   * Every import must implement doImport(); that's just the law.   
   */
  async doImport(): Promise<void> {
    this.log('No data migration; loading the cache.');
    await this.loadCache()
    return Promise.resolve();
  }
  
  /**
   * A pre-migration step that loads any locally cached data for the migration into memory.
   * 
   * @returns A promise that resolves to a dictionary of all cached data.
   */
  async loadCache(): Promise<CacheType | void> {
    this.log('No cache loader; filling the cache. ')
    await this.fillCache();
    return Promise.resolve();
  }
  
  /**
   * A pre-migration step that can be used to fetch remote information or pre-process
   * files. `preload()` might scrape pages from a site and store them in the `/raw` directory,
   * while `doImport()` actually populates the ArangoDB instance.
   *
   * @returns A promise that resolves to a dictionary of all cached data.
   */
  async fillCache(): Promise<CacheType| void> {
    this.log('No caching implementation.')
    return Promise.resolve();
  }
  
  /**
   * Deletes the cached data for the current import process.
   * 
   * This should probably be used sparingly, unless you're testing configuration.
   */
  async clearCache(): Promise<string[]> {
    this.log('No cache-clearing implementation.')
    return Promise.resolve([]);
  }

  /**
   * Check for any necessary ArangoDB collections and create them if they don't exists.   
   *
   * @returns A promise that resolves to a dictionary of collections, noting
   * whether they were already in place or created from scratch. 
   */
  async ensureSchema(): Promise<void> {
    if (this.collections || this.relationships) {
      for (const name of this.collections ?? []) {
        this.log(
          await this.db.ensureCollection(name).then(() => `${name} was ensured`)
        );
      }
      for (const name of this.relationships ?? []) {
        this.log(
          await this.db.ensureEdgeCollection(name).then(() => `${name} was ensured`)
        );
      }
    }
    return Promise.resolve();
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
  async destroySchema(): Promise<void> {
    if (this.collections || this.relationships) {
      for (const name of this.collections ?? []) {
        this.log(await this.db.collection(name).exists()
          .then(exists => {
            if (exists) return this.db.collection(name).drop().then(() => `${name} destroyed`);
            return `${name} did not exist`;
          }));
      }

      for (const name of this.relationships ?? []) {
        this.log(await this.db.collection(name).exists()
          .then(exists => {
            if (exists) return this.db.collection(name).drop().then(() => `${name} destroyed`);
            return `${name} did not exist`;
          }));
      }
    }
    return Promise.resolve();
  }
}