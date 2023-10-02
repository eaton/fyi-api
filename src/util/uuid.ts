import { v4 as uuidv4, v5 as uuidv5 } from 'uuid';
import hash from 'object-hash';

export function uuid(input?: unknown): string {
  const namespace = '5713d04c-59b3-430e-b75f-e43e44754795';

  if (input) {
    const hashOutput = hash(input, { encoding: 'buffer' });
    return uuidv5(hashOutput, namespace);
  }

  return uuidv4();
}