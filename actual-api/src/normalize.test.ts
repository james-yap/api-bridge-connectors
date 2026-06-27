import { describe, expect, test } from 'vitest';

import { amountToCents, normalizeTransactions } from './normalize.js';

describe('normalizeTransactions', () => {
  const categories = [{ id: 'cat-1', name: 'Dining' }];

  test('converts decimal amounts and category names', () => {
    const [transaction] = normalizeTransactions({
      accountId: 'acct-1',
      categories,
      sourcePrefix: 'test',
      transactions: [
        {
          date: '2026-06-27',
          amount: -12.34,
          description: 'Burger Shop',
          category: 'Dining',
          importedId: 'bank-1'
        }
      ]
    });
    expect(transaction).toMatchObject({
      account: 'acct-1',
      amount: -1234,
      category: 'cat-1',
      payee_name: 'Burger Shop',
      imported_id: 'bank-1'
    });
  });

  test('rejects invalid dates', () => {
    expect(() =>
      normalizeTransactions({
        accountId: 'acct-1',
        categories,
        sourcePrefix: 'test',
        transactions: [{ date: '2026-02-30', amount: 1, description: 'x' }]
      }),
    ).toThrow('Invalid calendar date');
  });
});

describe('amountToCents', () => {
  test('prefers amountCents', () => {
    expect(amountToCents({ date: '2026-06-27', amount: 1.99, amountCents: 250 })).toBe(250);
  });
});

