import { Filestore, Database, CreateCollectionOptions, FilestoreOptions } from "../index.js"
import chalk from 'chalk';

export interface BaseImportOptions extends Record<string, unknown> {
  name?: string,
  files?: Filestore | FilestoreOptions;
  db?: Database,
  logger?: (...data: unknown[]) => void;
}

/**
 * Skeleton for raw migrations; it makes it easy-ish to avoid some of the frequent
 * boilerplate code when doing cycles of testing.
 */
export abstract class BaseImport {
  collections?: Record<string, CreateCollectionOptions> = undefined;
  relationships?: Record<string, CreateCollectionOptions> = undefined;

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
    return this.options.name ?? this.constructor.name;
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
      console.log(`${chalk.bold(this.name)}:`, ...data);
    }
  }

  /**
   * A pre-migration step that can be used to fetch remote information or pre-process
   * files. `preload()` might scrape pages from a site and store them in the `/raw` directory,
   * while `doImport()` actually populates the ArangoDB instance.
   *
   * @returns A promise that resolves to a list of messages logged during the preload.
   */
  fillCache(): Promise<void> {
    return Promise.resolve();
  }

  /**
   * Every import must implement doImport(); that's just the law.   
   *
   * @returns A promise that resolves to a list of messages logged during the migration.
   */
  abstract doImport(): Promise<void>

  /**
   * Check for any necessary ArangoDB collections and create them if they don't exists.   
   *
   * @returns A promise that resolves to a dictionary of collections, noting
   * whether they were already in place or created from scratch. 
   */
  async ensureSchema(): Promise<void> {
    if (this.collections || this.relationships) {
      for (const [name, options] of Object.entries(this.collections ?? {})) {
        this.log(
          await this.db.ensureCollection(name, options).then(() => `${name} was ensured`)
        );
      }
      for (const [name, options] of Object.entries(this.relationships ?? {})) {
        this.log(
          await this.db.ensureEdgeCollection(name, options).then(() => `${name} was ensured`)
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
      for (const [name] of Object.entries(this.collections ?? {})) {
        this.log(await this.db.collection(name).exists()
          .then(exists => {
            if (exists) return this.db.collection(name).drop().then(() => `${name} destroyed`);
            return `${name} did not exist`;
          }));
      }

      for (const [name] of Object.entries(this.relationships ?? {})) {
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