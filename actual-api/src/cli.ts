#!/usr/bin/env node
import { appendAuditEvent, verifyAuditFile } from './audit.js';
import { getString, hasFlag, parseArgs, requireString } from './args.js';
import {
  api,
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
import type { JsonValue } from './types.js';

function usage(): string {
  return [
    'actual-api commands:',
    '  config-check',
    '  accounts [--include-closed]',
    '  categories',
    '  transactions --account <id-or-name> --start YYYY-MM-DD --end YYYY-MM-DD [--payee-contains <text>]',
    '  import-transactions --account <id-or-name> --file <path|-> [--dry-run|--commit] [--source-prefix value] [--reimport-deleted] [--uncleared]',
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

  throw new Error(`Unknown command ${command}.\n${usage()}`);
}

run().catch(error => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = error instanceof Error && error.message.startsWith('Unknown command') ? 2 : 1;
});
