import fs from 'node:fs/promises';

import type { ConnectorTransactionInput } from './types.js';

export async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

export async function readJsonFileOrStdin(file: string): Promise<unknown> {
  const text = file === '-' ? await readStdin() : await fs.readFile(file, 'utf8');
  return JSON.parse(text);
}

export function asTransactionArray(value: unknown): ConnectorTransactionInput[] {
  if (!Array.isArray(value)) throw new Error('Expected a JSON array of transactions.');
  return value.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error(`Transaction at index ${index} must be an object.`);
    }
    return item as ConnectorTransactionInput;
  });
}

export function printJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

