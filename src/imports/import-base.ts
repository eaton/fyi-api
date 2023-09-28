import { Database, CreateCollectionOptions } from "../storage/database.js"
import { Filestore } from "../storage/filestore.js"

/**
 * Skeleton for raw migrations; it makes it easy-ish to avoid some of the frequent
 * boilerplate code when doing cycles of testing.
 */
export abstract class Import {
  constructor(protected db: Database, protected files: Filestore) {};

  abstract collections: string | string[] | Record<string, CreateCollectionOptions>;
  abstract relationships: string | string[] | Record<string, CreateCollectionOptions>;

  /**
   * Every import must implement doImport(); that's just the law.   
   *
   * @returns A promise that resolves to a list of messages logged during the migration.
   */
  abstract doImport(options?: Record<string, unknown>): Promise<Record<string, string>>

  /**
   * A pre-migration step that can be used to fetch remote information or pre-process
   * files. `preload()` might scrape pages from a site and store them in the `/raw` directory,
   * while `doImport()` actually populates the ArangoDB instance.
   *
   * @returns A promise that resolves to a list of messages logged during the preload.
   */
  preload(options?: Record<string, unknown>): Promise<Record<string, string>> {
    return Promise.resolve({});
  }

  /**
   * Check for any necessary ArangoDB collections and create them if they don't exists.   
   *
   * @returns A promise that resolves to a dictionary of collections, noting
   * whether they were already in place or created from scratch. 
   */
  async ensureSchema(options?: Record<string, unknown>): Promise<Record<string, string>> {
    return Promise.resolve({});
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
    return Promise.resolve({});
  }
}