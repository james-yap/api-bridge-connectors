export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export type ConnectorTransactionInput = {
  date: string;
  amount?: number;
  amountCents?: number;
  description?: string;
  payeeName?: string;
  importedPayee?: string;
  category?: string;
  categoryId?: string;
  notes?: string;
  importedId?: string;
  id?: string;
  cleared?: boolean;
  forceAdd?: boolean;
  source?: string;
  rawSourceId?: string;
};

export type ActualImportTransaction = {
  account: string;
  date: string;
  amount: number;
  payee_name?: string;
  imported_payee?: string;
  category?: string;
  notes?: string;
  imported_id: string;
  cleared?: boolean;
  forceAddTransaction?: boolean;
};

export type ImportMode = 'dry-run' | 'commit';

export type ImportResult = {
  accountId: string;
  accountName: string;
  mode: ImportMode;
  count: number;
  inputHash: string;
  preview: unknown;
  commit?: unknown;
};
