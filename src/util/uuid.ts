import { v4 as uuidv4, v5 as uuidv5 } from 'uuid';
import hash from 'object-hash';

export function uuid(hashValue?: unknown): string {
  const namespace = '5713d04c-59b3-430e-b75f-e43e44754795';

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