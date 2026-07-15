#!/usr/bin/env node
import { appendAuditEvent, verifyAuditFile } from './audit.js';
import { getString, hasFlag, parseArgs, requireString } from './args.js';
import {
  api,
  findTransferPayee,
  listAccounts,
  listCategories,
  listTransactions,
  resolveAccount,
  withActual
} from './actual.js';
import { loadActualConfig, redactedConfig } from './config.js';
import { hashJson } from './hash.js';
import { asTransactionArray, printJson, readJsonFileOrStdin } from './io.js';
import { normalizeTransactions, sanitizedTransactionSummary } from './normalize.js';
import { asTransferArray, normalizeTransfers, sanitizedTransferSummary } from './transfers.js';
import type { JsonValue } from './types.js';

function usage(): string {
  return [
    'actual-api commands:',
    '  config-check',
    '  accounts [--include-closed]',
    '  categories',
    '  transactions --account <id-or-name> --start YYYY-MM-DD --end YYYY-MM-DD [--payee-contains <text>]',
    '  import-transactions --account <id-or-name> --file <path|-> [--dry-run|--commit] [--source-prefix value] [--reimport-deleted] [--uncleared]',
    '  import-transfers --from-account <id-or-name> --to-account <id-or-name> --file <path|-> [--dry-run|--commit] [--source-prefix value]',
    '  audit-verify --file <audit-jsonl>'
  ].join('\n');
}

async function run(): Promise<void> {
  const { command, flags } = parseArgs(process.argv.slice(2));
  if (command === 'help' || hasFlag(flags, 'help')) {
    process.stdout.write(`${usage()}\n`);
    return;
  }

  if (command === 'audit-verify') {
    printJson(await verifyAuditFile(requireString(flags, 'file')));
    return;
  }

  const config = loadActualConfig();

  if (command === 'config-check') {
    printJson({ ok: true, config: redactedConfig(config) });
    return;
  }

  if (command === 'accounts') {
    await withActual(config, async () => {
      printJson(await listAccounts(hasFlag(flags, 'include-closed')));
    }, false);
    return;
  }

  if (command === 'categories') {
    await withActual(config, async () => {
      printJson(await listCategories());
    }, false);
    return;
  }

  if (command === 'transactions') {
    const account = requireString(flags, 'account');
    const start = requireString(flags, 'start');
    const end = requireString(flags, 'end');
    const payeeContains = flags.has('payee-contains')
      ? requireString(flags, 'payee-contains')
      : undefined;
    await withActual(config, async () => {
      const resolved = await resolveAccount(account);
      printJson(await listTransactions({ accountId: resolved.id, start, end, payeeContains }));
    }, false);
    return;
  }

  if (command === 'import-transactions') {
    const wantsCommit = hasFlag(flags, 'commit');
    const wantsDryRun = hasFlag(flags, 'dry-run') || !wantsCommit;
    if (wantsCommit && hasFlag(flags, 'dry-run')) throw new Error('Use either --dry-run or --commit, not both.');
    const accountRef = requireString(flags, 'account');
    const file = requireString(flags, 'file');
    const sourcePrefix = getString(flags, 'source-prefix') ?? 'actual-api';
    const raw = await readJsonFileOrStdin(file);
    const inputTransactions = asTransactionArray(raw);
    const inputHash = hashJson(raw as JsonValue);
    const mode = wantsCommit ? 'commit' : 'dry-run';
    const summary = inputTransactions.map(sanitizedTransactionSummary);

    await appendAuditEvent(config.auditDir, {
      actor: config.actor,
      connector: 'actual-api',
      command,
      mode,
      status: 'started',
      details: {
        accountRef,
        count: inputTransactions.length,
        inputHash,
        transactionSummary: summary as JsonValue,
        config: redactedConfig(config) as unknown as JsonValue
      }
    });

    try {
      await withActual(config, async () => {
        const account = await resolveAccount(accountRef);
        const categories = await listCategories();
        const transactions = normalizeTransactions({
          accountId: account.id,
          categories,
          sourcePrefix,
          transactions: inputTransactions
        });
        const opts = {
          defaultCleared: !hasFlag(flags, 'uncleared'),
          dryRun: true,
          reimportDeleted: hasFlag(flags, 'reimport-deleted')
        };
        const preview = await api.importTransactions(account.id, transactions, opts);
        const output = {
          accountId: account.id,
          accountName: account.name,
          mode: wantsDryRun ? 'dry-run' : 'commit',
          count: transactions.length,
          inputHash,
          preview
        };
        if (wantsCommit) {
          const commit = await api.importTransactions(account.id, transactions, {
            ...opts,
            dryRun: false
          });
          const committed = { ...output, commit };
          await appendAuditEvent(config.auditDir, {
            actor: config.actor,
            connector: 'actual-api',
            command,
            mode,
            status: 'succeeded',
            details: committed as unknown as JsonValue
          });
          printJson(committed);
          return;
        }
        await appendAuditEvent(config.auditDir, {
          actor: config.actor,
          connector: 'actual-api',
          command,
          mode,
          status: 'succeeded',
          details: output as unknown as JsonValue
        });
        printJson(output);
      }, wantsCommit);
    } catch (error) {
      await appendAuditEvent(config.auditDir, {
        actor: config.actor,
        connector: 'actual-api',
        command,
        mode,
        status: 'failed',
        details: { message: error instanceof Error ? error.message : String(error) }
      });
      throw error;
    }
    return;
  }

  if (command === 'import-transfers') {
    const wantsCommit = hasFlag(flags, 'commit');
    const wantsDryRun = hasFlag(flags, 'dry-run') || !wantsCommit;
    if (wantsCommit && hasFlag(flags, 'dry-run')) throw new Error('Use either --dry-run or --commit, not both.');
    const fromAccountRef = requireString(flags, 'from-account');
    const toAccountRef = requireString(flags, 'to-account');
    const file = requireString(flags, 'file');
    const sourcePrefix = getString(flags, 'source-prefix') ?? 'actual-api';
    const raw = await readJsonFileOrStdin(file);
    const inputTransfers = asTransferArray(raw);
    const inputHash = hashJson(raw as JsonValue);
    const mode = wantsCommit ? 'commit' : 'dry-run';

    await appendAuditEvent(config.auditDir, {
      actor: config.actor,
      connector: 'actual-api',
      command,
      mode,
      status: 'started',
      details: {
        fromAccountRef,
        toAccountRef,
        count: inputTransfers.length,
        inputHash,
        config: redactedConfig(config) as unknown as JsonValue
      }
    });

    try {
      await withActual(config, async () => {
        const fromAccount = await resolveAccount(fromAccountRef);
        const toAccount = await resolveAccount(toAccountRef);
        if (fromAccount.id === toAccount.id) throw new Error('Transfer source and destination accounts must differ.');
        const transferPayee = await findTransferPayee(toAccount.id);
        const transfers = normalizeTransfers({
          fromAccountId: fromAccount.id,
          toAccountId: toAccount.id,
          toAccountName: toAccount.name,
          transferPayeeId: transferPayee.id,
          sourcePrefix,
          transfers: inputTransfers
        });
        const start = transfers.map(item => item.date).sort()[0];
        const end = transfers.map(item => item.date).sort().at(-1)!;
        const [fromTransactions, toTransactions] = [
          await api.getTransactions(fromAccount.id, start, end),
          await api.getTransactions(toAccount.id, start, end)
        ];
        const existingByImportedId = new Map(
          fromTransactions
            .filter(transaction => transaction.imported_id)
            .map(transaction => [transaction.imported_id!, transaction])
        );
        const destinationById = new Map(toTransactions.map(transaction => [transaction.id, transaction]));
        const errors: string[] = [];
        const existing = [] as Array<{ importedId: string; sourceId: string; destinationId: string }>;
        const additions = [] as typeof transfers;

        for (const transfer of transfers) {
          const source = existingByImportedId.get(transfer.importedId);
          if (!source) {
            additions.push(transfer);
            continue;
          }
          const destination = source.transfer_id ? destinationById.get(source.transfer_id) : undefined;
          if (
            source.date !== transfer.date ||
            source.amount !== -transfer.amountCents ||
            source.cleared !== transfer.cleared ||
            !destination ||
            destination.transfer_id !== source.id ||
            destination.date !== transfer.date ||
            destination.amount !== transfer.amountCents
          ) {
            errors.push(`Existing transfer ${transfer.importedId} does not match a complete linked transfer pair.`);
            continue;
          }
          existing.push({ importedId: transfer.importedId, sourceId: source.id, destinationId: destination.id });
        }
        if (errors.length > 0) throw new Error(errors.join('\n'));

        const output = {
          fromAccount: { id: fromAccount.id, name: fromAccount.name },
          toAccount: { id: toAccount.id, name: toAccount.name },
          mode,
          count: transfers.length,
          inputHash,
          preview: {
            errors,
            wouldAdd: additions.map(sanitizedTransferSummary),
            existing
          }
        };
        if (!wantsCommit) {
          await appendAuditEvent(config.auditDir, {
            actor: config.actor,
            connector: 'actual-api',
            command,
            mode,
            status: 'succeeded',
            details: output as unknown as JsonValue
          });
          printJson(output);
          return;
        }

        if (additions.length > 0) {
          await api.addTransactions(
            fromAccount.id,
            additions.map(transfer => transfer.sourceTransaction),
            { runTransfers: true }
          );
          // The API queues mutations locally. Sync before readback so a validation
          // query cannot observe an earlier cleared-state snapshot.
          await api.sync();
        }
        const committedFrom = await api.getTransactions(fromAccount.id, start, end);
        const committedTo = await api.getTransactions(toAccount.id, start, end);
        const committedByImportedId = new Map(
          committedFrom
            .filter(transaction => transaction.imported_id)
            .map(transaction => [transaction.imported_id!, transaction])
        );
        const committedDestinationById = new Map(committedTo.map(transaction => [transaction.id, transaction]));
        const added = [] as Array<{ importedId: string; sourceId: string; destinationId: string }>;
        for (const transfer of additions) {
          const source = committedByImportedId.get(transfer.importedId);
          const destination = source?.transfer_id ? committedDestinationById.get(source.transfer_id) : undefined;
          if (
            !source ||
            !destination ||
            source.date !== transfer.date ||
            source.amount !== -transfer.amountCents ||
            source.cleared !== transfer.cleared ||
            destination.transfer_id !== source.id ||
            destination.date !== transfer.date ||
            destination.amount !== transfer.amountCents
          ) {
            throw new Error(`Actual did not create a complete linked transfer for ${transfer.importedId}.`);
          }
          if (destination.cleared !== transfer.cleared) {
            await api.updateTransaction(destination.id, { cleared: transfer.cleared });
          }
          added.push({ importedId: transfer.importedId, sourceId: source.id, destinationId: destination.id });
        }
        if (additions.length > 0) await api.sync();
        const verifiedTo = additions.length > 0
          ? new Map((await api.getTransactions(toAccount.id, start, end)).map(transaction => [transaction.id, transaction]))
          : committedDestinationById;
        for (const transfer of additions) {
          const source = committedByImportedId.get(transfer.importedId)!;
          const destination = verifiedTo.get(source.transfer_id!);
          if (!destination || destination.cleared !== transfer.cleared) {
            throw new Error(`Actual did not preserve the requested cleared state for ${transfer.importedId}.`);
          }
        }
        const committed = { ...output, commit: { added, existing } };
        await appendAuditEvent(config.auditDir, {
          actor: config.actor,
          connector: 'actual-api',
          command,
          mode,
          status: 'succeeded',
          details: committed as unknown as JsonValue
        });
        printJson(committed);
      }, true);
    } catch (error) {
      await appendAuditEvent(config.auditDir, {
        actor: config.actor,
        connector: 'actual-api',
        command,
        mode,
        status: 'failed',
        details: { message: error instanceof Error ? error.message : String(error) }
      });
      throw error;
    }
    return;
  }

  throw new Error(`Unknown command ${command}.\n${usage()}`);
}

run().catch(error => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = error instanceof Error && error.message.startsWith('Unknown command') ? 2 : 1;
});
