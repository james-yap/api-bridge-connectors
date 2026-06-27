import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { sha256 } from './hash.js';

export type ActualConfig = {
  serverUrl: string;
  syncId: string;
  password?: string;
  sessionToken?: string;
  encryptionPassword?: string;
  dataDir: string;
  auditDir: string;
  actor: string;
  verbose: boolean;
};

function stateRoot(): string {
  if (process.env.API_BRIDGE_STATE_DIR) return process.env.API_BRIDGE_STATE_DIR;
  if (process.env.XDG_STATE_HOME) {
    return path.join(process.env.XDG_STATE_HOME, 'api-bridge-connectors');
  }
  if (process.platform === 'win32' && process.env.APPDATA) {
    return path.join(process.env.APPDATA, 'api-bridge-connectors');
  }
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'api-bridge-connectors');
  }
  return path.join(os.homedir(), '.local', 'state', 'api-bridge-connectors');
}

function loadEnvFiles(): void {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(moduleDir, '..', '..');
  const candidates = [
    process.env.API_BRIDGE_ENV_FILE,
    path.join(process.cwd(), '.env'),
    path.join(process.cwd(), '..', '.env'),
    path.join(repoRoot, '.env'),
    path.join(repoRoot, 'actual-api', '.env')
  ].filter((candidate): candidate is string => Boolean(candidate));

  const seen = new Set<string>();
  for (const candidate of candidates) {
    const resolved = path.resolve(candidate);
    if (seen.has(resolved) || !fs.existsSync(resolved)) continue;
    seen.add(resolved);
    process.loadEnvFile(resolved);
  }
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable ${name}.`);
  return value;
}

export function loadActualConfig(): ActualConfig {
  loadEnvFiles();
  const serverUrl = requireEnv('ACTUAL_SERVER_URL');
  const syncId = requireEnv('ACTUAL_SYNC_ID');
  const password = process.env.ACTUAL_PASSWORD || undefined;
  const sessionToken = process.env.ACTUAL_SESSION_TOKEN || undefined;
  if (!password && !sessionToken) {
    throw new Error('Set ACTUAL_SESSION_TOKEN or ACTUAL_PASSWORD through a secret manager.');
  }

  new URL(serverUrl);
  const root = stateRoot();
  const syncHash = sha256(syncId).slice(0, 16);
  return {
    serverUrl,
    syncId,
    password,
    sessionToken,
    encryptionPassword: process.env.ACTUAL_ENCRYPTION_PASSWORD || undefined,
    dataDir: process.env.ACTUAL_DATA_DIR || path.join(root, 'actual-api', 'data', syncHash),
    auditDir: process.env.API_BRIDGE_AUDIT_DIR || path.join(root, 'audit'),
    actor: process.env.API_BRIDGE_ACTOR || os.userInfo().username || 'unknown',
    verbose: process.env.API_BRIDGE_VERBOSE === '1'
  };
}

export function redactedConfig(config: ActualConfig) {
  return {
    serverUrlHash: sha256(config.serverUrl),
    syncIdHash: sha256(config.syncId),
    hasSessionToken: Boolean(config.sessionToken),
    hasPassword: Boolean(config.password),
    hasEncryptionPassword: Boolean(config.encryptionPassword),
    dataDir: config.dataDir,
    auditDir: config.auditDir,
    actor: config.actor
  };
}
