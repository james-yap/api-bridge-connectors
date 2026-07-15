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
  getPayees: vi.fn(),
  getTransactions: vi.fn(),
  importTransactions: vi.fn(),
  init: vi.fn(),
  shutdown: vi.fn(),
  sync: vi.fn()
}));

vi.mock('@actual-app/api', () => actualApi);

const { findTransferPayee, listTransactions, withActual } = await import('./actual.js');

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

describe('listTransactions', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test('enriches and filters transactions by normalized payee name', async () => {
    actualApi.getTransactions.mockResolvedValueOnce([
      {
        id: 'tx-1',
        account: 'acct-1',
        amount: -450,
        date: '2026-02-27',
        payee: 'payee-1',
        imported_payee: 'Unhelpful raw import text',
      },
      {
        id: 'tx-2',
        account: 'acct-1',
        amount: -900,
        date: '2026-02-28',
        payee: 'payee-2',
      },
    ]);
    actualApi.getPayees.mockResolvedValueOnce([
      { id: 'payee-1', name: 'Htsp Fredericton Nb' },
      { id: 'payee-2', name: 'Other Merchant' },
    ]);

    await expect(
      listTransactions({
        accountId: 'acct-1',
        start: '2026-01-01',
        end: '2026-05-01',
        payeeContains: 'FREDERICTON',
      }),
    ).resolves.toEqual([
      {
        id: 'tx-1',
        account: 'acct-1',
        amount: -450,
        date: '2026-02-27',
        payee: 'payee-1',
        payeeName: 'Htsp Fredericton Nb',
        imported_payee: 'Unhelpful raw import text',
      },
    ]);
  });

  test('enriches split transactions and preserves unknown payees as null', async () => {
    actualApi.getTransactions.mockResolvedValueOnce([
      {
        id: 'tx-parent',
        account: 'acct-1',
        amount: -675,
        date: '2026-03-10',
        payee: 'missing-payee',
        subtransactions: [
          {
            id: 'tx-child',
            account: 'acct-1',
            amount: -675,
            date: '2026-03-10',
            payee: 'payee-1',
          },
        ],
      },
    ]);
    actualApi.getPayees.mockResolvedValueOnce([{ id: 'payee-1', name: 'Htsp Fredericton Nb' }]);

    const [transaction] = await listTransactions({
      accountId: 'acct-1',
      start: '2026-01-01',
      end: '2026-05-01',
      payeeContains: 'fredericton',
    });

    expect(transaction.payeeName).toBeNull();
    expect(transaction.subtransactions?.[0].payeeName).toBe('Htsp Fredericton Nb');
  });
});

describe('findTransferPayee', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test('returns the special payee that targets the requested account', async () => {
    actualApi.getPayees.mockResolvedValueOnce([
      { id: 'ordinary', name: 'Ordinary Payee', transfer_acct: null },
      { id: 'transfer-destination', name: 'Destination', transfer_acct: 'acct-destination' },
    ]);

    await expect(findTransferPayee('acct-destination')).resolves.toMatchObject({
      id: 'transfer-destination',
      transfer_acct: 'acct-destination',
    });
  });
});
