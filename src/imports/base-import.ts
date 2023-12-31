import { Database } from '../index.js';
import { Disk } from 'mangler';
import chalk from 'chalk';
import { Text } from 'mangler';
import path from 'path';

/**
 * Core options supported by most imports
 */
export interface BaseImportOptions extends Record<string, unknown> {
  importName?: string;
  files?: {
    base?: string,
    input?: string,
    cache?: string,
    output?: string,
  },
  db?: Database;
  logger?: (...data: unknown[]) => void;
}

/**
 * Auth and connectivity options for imports that use a SQL database
 */
export interface DatabaseImportOptions {
  database?: {
    host?: string;
    user?: string;
    pass?: string;
    dbName?: string;
  };
}

/**
 * Concurrency and timing options for imports that scrape pages
 */
export interface ScraperImportOptions extends Record<string, unknown> {
  maxRequestsPerMinute?: number;
  maxConcurrency?: number;
  sameDomainDelaySec?: number;
}

/**
 * Skeleton for raw migrations; it makes it easy-ish to avoid some of the frequent
 * boilerplate code when doing cycles of testing.
 */
export abstract class BaseImport<CacheType = unknown> {
  collections?: string[] = undefined;
  relationships?: string[] = undefined;
  cacheData?: CacheType;
  input: typeof Disk;
  cache: typeof Disk;
  output: typeof Disk;

  constructor(protected options: BaseImportOptions = {}) {
    if (options.files?.base) {
      const base = Disk.dir(options.files?.base);
      this.input = base.dir(options?.files?.input ?? path.join('input', this.name));
      this.cache = base.dir(options?.files?.cache ?? path.join('cache', this.name));
      this.output = base.dir(options?.files?.output ?? path.join('output', this.name));
    } else {
      this.input = Disk.dir(options?.files?.input ?? path.join('input', this.name));
      this.cache = Disk.dir(options?.files?.cache ?? path.join('cache', this.name));
      this.output = Disk.dir(options?.files?.output ?? path.join('output', this.name));  
    }
  }

  get name(): string {
    return this.options.importName ?? Text.toCase.kabob(this.constructor.name);
  }

  get db(): Database {
    if (this.options.db === undefined) {
      this.options.db = new Database();
    }
    return this.options.db;
  }

  log(...data: unknown[]) {
    if (this.options.logger) {
      this.options.logger(data);
    } else {
      if (typeof data[0] === 'string') {
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
    await this.loadCache();
    return Promise.resolve();
  }

  /**
   * A pre-migration step that loads any locally cached data for the migration into memory.
   *
   * @returns A promise that resolves to a dictionary of all cached data.
   */
  async loadCache(): Promise<CacheType | void> {
    this.log('No cache loader; filling the cache. ');
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
  async fillCache(): Promise<CacheType | void> {
    this.log('No caching implementation.');
    return Promise.resolve();
  }

  /**
   * Deletes the cached data for the current import process.
   *
   * This should probably be used sparingly, unless you're testing configuration.
   */
  async clearCache(): Promise<string[]> {
    this.log('No cache-clearing implementation.');
    return Promise.resolve([]);
  }

  async buildOutput(): Promise<void> {
    this.log('No final output implementation.');
    return Promise.resolve();
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
          await this.db
            .ensureEdgeCollection(name)
            .then(() => `${name} was ensured`)
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
        this.log(
          await this.db
            .collection(name)
            .exists()
            .then((exists) => {
              if (exists)
                return this.db
                  .collection(name)
                  .drop()
                  .then(() => `${name} destroyed`);
              return `${name} did not exist`;
            })
        );
      }

      for (const name of this.relationships ?? []) {
        this.log(
          await this.db
            .collection(name)
            .exists()
            .then((exists) => {
              if (exists)
                return this.db
                  .collection(name)
                  .drop()
                  .then(() => `${name} destroyed`);
              return `${name} did not exist`;
            })
        );
      }
    }
    return Promise.resolve();
  }
}
