import { notesHash } from './audit.js';
import { hashJson } from './hash.js';
import { amountToCents, assertDate, sourceImportedId } from './normalize.js';
import type {
  ActualTransferTransaction,
  ConnectorTransferInput,
  JsonValue
} from './types.js';

export type TransferPlan = {
  amountCents: number;
  cleared: boolean;
  date: string;
  importedId: string;
  importedPayee: string;
  sourceTransaction: ActualTransferTransaction;
};

function requireOptionalString(value: unknown, field: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new Error(`${field} must be a string when provided.`);
  return value;
}

function transferImportedId(
  input: ConnectorTransferInput,
  sourcePrefix: string,
  fromAccountId: string,
  toAccountId: string,
): string {
  if (input.importedId || input.id || input.rawSourceId) {
    return sourceImportedId(input, sourcePrefix);
  }
  return `${sourcePrefix}:transfer:sha256:${hashJson({ fromAccountId, toAccountId, input } as JsonValue).slice(0, 32)}`;
}

export function asTransferArray(value: unknown): ConnectorTransferInput[] {
  if (!Array.isArray(value)) throw new Error('Expected a JSON array of transfers.');
  if (value.length === 0) throw new Error('Expected at least one transfer.');
  return value.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error(`Transfer at index ${index} must be an object.`);
    }
    return item as ConnectorTransferInput;
  });
}

export function normalizeTransfers(args: {
  fromAccountId: string;
  toAccountId: string;
  toAccountName: string;
  transferPayeeId: string;
  sourcePrefix: string;
  transfers: ConnectorTransferInput[];
}): TransferPlan[] {
  const usedImportedIds = new Set<string>();
  return args.transfers.map((input, index) => {
    if (typeof input.date !== 'string') throw new Error(`Transfer at index ${index} needs a date.`);
    assertDate(input.date);
    if (input.cleared !== undefined && typeof input.cleared !== 'boolean') {
      throw new Error(`Transfer at index ${index} has an invalid cleared value.`);
    }
    const description = requireOptionalString(input.description, `Transfer at index ${index} description`);
    const notes = requireOptionalString(input.notes, `Transfer at index ${index} notes`);
    requireOptionalString(input.importedId, `Transfer at index ${index} importedId`);
    requireOptionalString(input.id, `Transfer at index ${index} id`);
    requireOptionalString(input.rawSourceId, `Transfer at index ${index} rawSourceId`);

    const amountCents = amountToCents(input);
    if (amountCents <= 0) {
      throw new Error(`Transfer at index ${index} needs a positive amount; direction comes from --from-account and --to-account.`);
    }
    const importedId = transferImportedId(input, args.sourcePrefix, args.fromAccountId, args.toAccountId);
    if (usedImportedIds.has(importedId)) throw new Error(`Duplicate transfer importedId ${importedId}.`);
    usedImportedIds.add(importedId);

    const cleared = input.cleared ?? true;
    const importedPayee = description?.trim() || `Transfer to ${args.toAccountName}`;
    const sourceTransaction: ActualTransferTransaction = {
      date: input.date,
      amount: -amountCents,
      payee: args.transferPayeeId,
      imported_payee: importedPayee,
      imported_id: importedId,
      cleared,
      ...(notes ? { notes } : {})
    };
    return { amountCents, cleared, date: input.date, importedId, importedPayee, sourceTransaction };
  });
}

export function sanitizedTransferSummary(plan: TransferPlan) {
  return {
    date: plan.date,
    amountCents: plan.amountCents,
    importedId: plan.importedId,
    importedPayee: plan.importedPayee,
    notesHash: notesHash(plan.sourceTransaction.notes)
  };
}
