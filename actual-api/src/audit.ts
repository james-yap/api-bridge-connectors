import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import { hashJson, sha256, stableJson } from './hash.js';
import type { JsonValue } from './types.js';

export type AuditEvent = {
  schemaVersion: 1;
  eventId: string;
  timestamp: string;
  actor: string;
  connector: 'actual-api';
  command: string;
  mode: string;
  status: 'started' | 'succeeded' | 'failed';
  details: JsonValue;
  previousEventHash: string | null;
  eventHash?: string;
};

function auditPath(auditDir: string, connector: string, now = new Date()): string {
  const month = now.toISOString().slice(0, 7);
  return path.join(auditDir, `${connector}-${month}.jsonl`);
}

async function lastEventHash(file: string): Promise<string | null> {
  try {
    const text = await fs.readFile(file, 'utf8');
    const last = text
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .at(-1);
    if (!last) return null;
    const parsed = JSON.parse(last) as { eventHash?: string };
    return typeof parsed.eventHash === 'string' ? parsed.eventHash : null;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

export async function appendAuditEvent(
  auditDir: string,
  event: Omit<AuditEvent, 'schemaVersion' | 'eventId' | 'timestamp' | 'previousEventHash' | 'eventHash'>,
): Promise<AuditEvent> {
  await fs.mkdir(auditDir, { recursive: true, mode: 0o700 });
  const file = auditPath(auditDir, event.connector);
  const previousEventHash = await lastEventHash(file);
  const full: AuditEvent = {
    schemaVersion: 1,
    eventId: randomUUID(),
    timestamp: new Date().toISOString(),
    previousEventHash,
    ...event
  };
  full.eventHash = hashJson(full as unknown as JsonValue);
  await fs.appendFile(file, `${stableJson(full as unknown as JsonValue)}\n`, { mode: 0o600 });
  return full;
}

export function notesHash(notes: string | undefined): string | null {
  return notes ? sha256(notes) : null;
}

export async function verifyAuditFile(file: string): Promise<{ ok: boolean; checked: number; error?: string }> {
  const text = await fs.readFile(file, 'utf8');
  let previous: string | null = null;
  let checked = 0;
  for (const line of text.split('\n').filter(Boolean)) {
    const event = JSON.parse(line) as AuditEvent;
    if (event.previousEventHash !== previous) {
      return { ok: false, checked, error: `broken previous hash at event ${event.eventId}` };
    }
    const { eventHash, ...withoutHash } = event;
    const computed = hashJson(withoutHash as unknown as JsonValue);
    if (eventHash !== computed) {
      return { ok: false, checked, error: `bad event hash at event ${event.eventId}` };
    }
    previous = eventHash ?? null;
    checked += 1;
  }
  return { ok: true, checked };
}

