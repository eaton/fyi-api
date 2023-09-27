import 'dotenv/config'
import { Database } from './database.js'

import { v4 as uuidv4, v5 as uuidv5 } from 'uuid';
import hash from 'object-hash';

export async function getDb() {
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


export function makeUuid(hashValue?: unknown): string {
  const namespace = '9fc3e7e5-59d7-4d55-afa0-98a978f49bab';

  if (hashValue) {
    if (typeof hashValue !== 'object') {
      hashValue = { data: hashValue };
    }

    const hashOutput = hash(hashValue as Record<string, unknown>, {
      encoding: 'buffer',
    });

    return uuidv5(hashOutput, namespace);
  }

  return uuidv4();
}