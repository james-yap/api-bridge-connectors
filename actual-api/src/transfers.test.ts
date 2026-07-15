import { describe, expect, test } from 'vitest';

import { asTransferArray, normalizeTransfers } from './transfers.js';

describe('normalizeTransfers', () => {
  test('creates a cleared source outflow with a stable explicit ID', () => {
    const [plan] = normalizeTransfers({
      fromAccountId: 'wealthsimple',
      toAccountId: 'scotiabank',
      toAccountName: 'Scotiabank Chequing',
      transferPayeeId: 'payee-scotiabank',
      sourcePrefix: 'statement',
      transfers: [{
        date: '2026-07-08',
        amount: 500,
        description: 'Free Interac E-Transfer',
        importedId: 'scotiabank:statement:2026-07-08:50000',
      }],
    });

    expect(plan).toMatchObject({
      amountCents: 50000,
      cleared: true,
      importedId: 'scotiabank:statement:2026-07-08:50000',
      sourceTransaction: {
        amount: -50000,
        payee: 'payee-scotiabank',
        cleared: true,
      },
    });
  });

  test('rejects negative amounts because account flags establish direction', () => {
    expect(() => normalizeTransfers({
      fromAccountId: 'wealthsimple',
      toAccountId: 'scotiabank',
      toAccountName: 'Scotiabank Chequing',
      transferPayeeId: 'payee-scotiabank',
      sourcePrefix: 'statement',
      transfers: [{ date: '2026-07-08', amount: -500 }],
    })).toThrow('positive amount');
  });

  test('rejects duplicate source IDs before a write is possible', () => {
    expect(() => normalizeTransfers({
      fromAccountId: 'wealthsimple',
      toAccountId: 'scotiabank',
      toAccountName: 'Scotiabank Chequing',
      transferPayeeId: 'payee-scotiabank',
      sourcePrefix: 'statement',
      transfers: [
        { date: '2026-07-08', amount: 500, importedId: 'bank-1' },
        { date: '2026-06-30', amount: 1008.75, importedId: 'bank-1' },
      ],
    })).toThrow('Duplicate transfer importedId');
  });
});

describe('asTransferArray', () => {
  test('requires a non-empty JSON array of objects', () => {
    expect(() => asTransferArray([])).toThrow('at least one transfer');
    expect(() => asTransferArray([null])).toThrow('must be an object');
  });
});
