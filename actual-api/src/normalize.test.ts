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

  test('omits undefined optional import fields', () => {
    const [transaction] = normalizeTransactions({
      accountId: 'acct-1',
      categories: [],
      sourcePrefix: 'test',
      transactions: [{ date: '2026-06-27', amountCents: -330, description: 'Presto Fare' }]
    });

    expect(transaction).not.toHaveProperty('category');
    expect(transaction).not.toHaveProperty('cleared');
    expect(transaction).not.toHaveProperty('notes');
    expect(JSON.stringify(transaction)).not.toContain('undefined');
  });

  test('passes through explicit force-add intent', () => {
    const [transaction] = normalizeTransactions({
      accountId: 'acct-1',
      categories: [],
      sourcePrefix: 'test',
      transactions: [
        {
          date: '2026-06-27',
          amountCents: -660,
          description: 'Presto Fare',
          importedId: 'bank-2',
          forceAdd: true
        }
      ]
    });

    expect(transaction.forceAddTransaction).toBe(true);
  });
});

describe('amountToCents', () => {
  test('prefers amountCents', () => {
    expect(amountToCents({ date: '2026-06-27', amount: 1.99, amountCents: 250 })).toBe(250);
  });
});
