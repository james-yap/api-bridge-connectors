import type { ActualImportTransaction, ConnectorTransactionInput, JsonValue } from './types.js';
import { hashJson } from './hash.js';
import { notesHash } from './audit.js';

type Category = { id: string; name: string; hidden?: boolean };

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function assertDate(value: string): void {
  if (!datePattern.test(value)) throw new Error(`Invalid date ${value}; expected YYYY-MM-DD.`);
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error(`Invalid calendar date ${value}.`);
  }
}

export function amountToCents(input: ConnectorTransactionInput): number {
  if (typeof input.amountCents === 'number') {
    if (!Number.isInteger(input.amountCents)) throw new Error('amountCents must be an integer.');
    return input.amountCents;
  }
  if (typeof input.amount !== 'number' || !Number.isFinite(input.amount)) {
    throw new Error('Each transaction needs amount or amountCents.');
  }
  return Math.round(input.amount * 100);
}

function findCategoryId(categories: Category[], input: ConnectorTransactionInput): string | undefined {
  if (input.categoryId) return input.categoryId;
  if (!input.category) return undefined;
  const exact = categories.filter(category => category.name === input.category);
  const insensitive = categories.filter(
    category => category.name.toLowerCase() === input.category?.toLowerCase(),
  );
  const matches = exact.length > 0 ? exact : insensitive;
  const visible = matches.filter(category => !category.hidden);
  const match = visible[0] ?? matches[0];
  if (!match) throw new Error(`Unknown Actual category ${input.category}.`);
  return match.id;
}

function importedId(input: ConnectorTransactionInput, sourcePrefix: string): string {
  if (input.importedId) return input.importedId;
  if (input.id) return `${sourcePrefix}:${input.id}`;
  if (input.rawSourceId) return `${sourcePrefix}:${input.rawSourceId}`;
  return `${sourcePrefix}:sha256:${hashJson(input as unknown as JsonValue).slice(0, 32)}`;
}

export function normalizeTransactions(args: {
  accountId: string;
  categories: Category[];
  sourcePrefix: string;
  transactions: ConnectorTransactionInput[];
}): ActualImportTransaction[] {
  return args.transactions.map(input => {
    assertDate(input.date);
    const payeeName = input.payeeName ?? input.description;
    if (!payeeName || !payeeName.trim()) throw new Error('Each transaction needs description or payeeName.');
    return {
      account: args.accountId,
      date: input.date,
      amount: amountToCents(input),
      payee_name: payeeName.trim(),
      imported_payee: input.importedPayee ?? input.description ?? payeeName,
      category: findCategoryId(args.categories, input),
      notes: input.notes,
      imported_id: importedId(input, args.sourcePrefix),
      cleared: input.cleared
    };
  });
}

export function sanitizedTransactionSummary(transaction: ConnectorTransactionInput) {
  return {
    date: transaction.date,
    amountCents: amountToCents(transaction),
    importedId: transaction.importedId ?? transaction.id ?? transaction.rawSourceId ?? null,
    payee: transaction.payeeName ?? transaction.description ?? null,
    category: transaction.category ?? transaction.categoryId ?? null,
    notesHash: notesHash(transaction.notes)
  };
}

