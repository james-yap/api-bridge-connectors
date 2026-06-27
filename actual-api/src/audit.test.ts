import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, test } from 'vitest';

import { appendAuditEvent, verifyAuditFile } from './audit.js';

describe('audit', () => {
  test('writes a verifiable hash chain', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'actual-api-audit-'));
    await appendAuditEvent(dir, {
      actor: 'test',
      connector: 'actual-api',
      command: 'import-transactions',
      mode: 'dry-run',
      status: 'started',
      details: { ok: true }
    });
    await appendAuditEvent(dir, {
      actor: 'test',
      connector: 'actual-api',
      command: 'import-transactions',
      mode: 'dry-run',
      status: 'succeeded',
      details: { ok: true }
    });
    const [file] = await fs.readdir(dir);
    const result = await verifyAuditFile(path.join(dir, file));
    expect(result).toEqual({ ok: true, checked: 2 });
  });
});

