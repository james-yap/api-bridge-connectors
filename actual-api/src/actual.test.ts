import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import type { ActualConfig } from './config.js';
import { sha256 } from './hash.js';

const actualApi = vi.hoisted(() => ({
  downloadBudget: vi.fn(),
  getAccounts: vi.fn(),
  getCategories: vi.fn(),
  importTransactions: vi.fn(),
  init: vi.fn(),
  shutdown: vi.fn(),
  sync: vi.fn()
}));

vi.mock('@actual-app/api', () => actualApi);

const { withActual } = await import('./actual.js');

function configFor(dataDir: string): ActualConfig {
  return {
    actor: 'test',
    auditDir: path.join(dataDir, '..', 'audit'),
    dataDir,
    serverUrl: 'http://localhost:5006',
    syncId: 'sync-id',
    password: 'password',
    verbose: false
  };
}

async function lockExists(dataDir: string): Promise<boolean> {
  const lockPath = path.join(dataDir, '..', 'locks', `${sha256('sync-id').slice(0, 16)}.lock`);
  try {
    await fs.access(lockPath);
    return true;
  } catch {
    return false;
  }
}

describe('withActual', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test('releases the connector lock when init fails', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'actual-api-'));
    const dataDir = path.join(dir, 'data');
    actualApi.init.mockRejectedValueOnce(new Error('init failed'));

    await expect(withActual(configFor(dataDir), async () => undefined, false)).rejects.toThrow('init failed');

    await expect(lockExists(dataDir)).resolves.toBe(false);
    expect(actualApi.shutdown).not.toHaveBeenCalled();
  });
});
