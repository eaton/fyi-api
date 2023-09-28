import { Database as ArangoDB } from 'arangojs';
import { CreateCollectionOptions } from 'arangojs/collection';
export { CreateCollectionOptions } from 'arangojs/collection';

export class Database extends ArangoDB {

  static async setup() {
    const db = new Database({
      url: process.env.ARANGO_URL,
      databaseName: process.env.ARANGO_DB,
      auth: {
        username: process.env.ARANGO_USER ?? 'root',
        password: process.env.ARANGO_PASS
      }
    });
    return db;
  }

  async ensure(name: string, document = true, options: CreateCollectionOptions = {}) {
    return this.collection(name).exists()
      .then(exists => {
        if (exists) return this.collection(name);
        if (document) return this.createCollection(name, options);
        return this.createEdgeCollection(name, options);
      })
  }

  async empty(name: string) {
    return this.collection(name).exists()
      .then(exists => {
        if (exists) {
          return this.collection(name).truncate().then(() => true);
        } else {
          return false;
        }
      })
  }
}
