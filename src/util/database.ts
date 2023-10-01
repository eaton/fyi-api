import { Database as ArangoDB } from 'arangojs';
import { Config } from 'arangojs/connection';
import { CreateCollectionOptions } from 'arangojs/collection';
export { CreateCollectionOptions } from 'arangojs/collection';

export class Database extends ArangoDB {
  constructor(config?: Config) {
    const envDefaults = {
      url: process.env.ARANGO_URL,
      databaseName: process.env.ARANGO_DB,
      auth: {
        username: process.env.ARANGO_USER ?? 'root',
        password: process.env.ARANGO_PASS
      }
    };

    if (!config) {
      super(envDefaults);
    } else {
      super(config);
    }
  }

  async push(item: any, id?: string): Promise<boolean> {
    // Set the _collection and _key variables from the incoming ID if it exists,
    // and the item's own _id property if IT exists. If they're still not populated,
    // try the item's _collection and _key properties.
    let [_collection, _key] = ((id ?? item._id)?.split('/') ?? []);
    _collection ??= item._collection;
    _key ??= item._key;
    const _id = [_collection, _key].join('/');

    if (_collection === undefined) {
      Promise.reject(new Error('Item has no _collection property, and no collection was specified.'));
    }
    if (_key === undefined) {
      Promise.reject(new Error('Item has no unique key, and none was given.'));
    }

    return this.collection(_collection)
      .save({ ...item, _id, _key, _collection  }, { overwriteMode: 'update' })
      .then(() => true);
  }

  async delete(id: string, collection?: string) {
    const _id = [id, collection].filter(Boolean).join('/');
    const [_collection, _key] = _id.split('/');

    return this.collection(_collection).remove({ _key })
      .then(() => true);
  }

  async ensureCollection(name: string, options: CreateCollectionOptions = {}) {
    return this.collection(name).exists()
      .then(exists => {
        if (exists) return this.collection(name);
        return this.createCollection(name, options);
      })
  }

  async ensureEdgeCollection(name: string, options: CreateCollectionOptions = {}) {
    return this.collection(name).exists()
      .then(exists => {
        if (exists) return this.collection(name);
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
