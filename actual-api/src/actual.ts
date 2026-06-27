import fs from 'node:fs/promises';
import path from 'node:path';
import * as api from '@actual-app/api';

import type { ActualConfig } from './config.js';
import { sha256 } from './hash.js';

type Account = { id: string; name: string; closed?: number | boolean };
type Category = { id: string; name: string; hidden?: boolean };

async function acquireLock(config: ActualConfig): Promise<() => Promise<void>> {
  const lockDir = path.join(config.dataDir, '..', 'locks');
  await fs.mkdir(lockDir, { recursive: true, mode: 0o700 });
  const lockPath = path.join(lockDir, `${sha256(config.syncId).slice(0, 16)}.lock`);
  let handle;
  try {
    handle = await fs.open(lockPath, 'wx', 0o600);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      throw new Error(`Actual connector lock already exists at ${lockPath}. Another agent may be running.`);
    }
    throw error;
  }
  await handle.writeFile(JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
  await handle.close();
  return async () => {
    await fs.rm(lockPath, { force: true });
  };
}

export async function withActual<T>(config: ActualConfig, fn: () => Promise<T>, mutates: boolean): Promise<T> {
  const release = await acquireLock(config);
  await fs.mkdir(config.dataDir, { recursive: true, mode: 0o700 });
  const initConfig = {
    serverURL: config.serverUrl,
    dataDir: config.dataDir,
    verbose: config.verbose,
    ...(config.sessionToken ? { sessionToken: config.sessionToken } : { password: config.password })
  } as Parameters<typeof api.init>[0] & { sessionToken?: string };

  let initialized = false;
  try {
    await api.init(initConfig);
    initialized = true;
    await api.downloadBudget(config.syncId, { password: config.encryptionPassword });
    const result = await fn();
    if (mutates) await api.sync();
    return result;
  } finally {
    try {
      if (initialized) await api.shutdown();
    } finally {
      await release();
    }
  }
}

export async function resolveAccount(accountRef: string): Promise<Account> {
  const accounts = (await api.getAccounts()) as Account[];
  const match =
    accounts.find(account => account.id === accountRef) ??
    accounts.find(account => account.name === accountRef) ??
    accounts.find(account => account.name.toLowerCase() === accountRef.toLowerCase());
  if (!match) throw new Error(`Unknown Actual account ${accountRef}.`);
  return match;
}

export async function listAccounts(includeClosed: boolean): Promise<Account[]> {
  const accounts = (await api.getAccounts()) as Account[];
  return includeClosed ? accounts : accounts.filter(account => !account.closed);
}

export async function listCategories(): Promise<Category[]> {
  return (await api.getCategories({})) as Category[];
}

export { api };
