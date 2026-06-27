export type ParsedArgs = {
  command: string;
  flags: Map<string, string | boolean>;
};

export function parseArgs(argv: string[]): ParsedArgs {
  const [command, ...rest] = argv;
  if (!command) return { command: 'help', flags: new Map() };
  const flags = new Map<string, string | boolean>();
  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (!token.startsWith('--')) throw new Error(`Unexpected argument ${token}.`);
    const name = token.slice(2);
    const next = rest[i + 1];
    if (!next || next.startsWith('--')) {
      flags.set(name, true);
    } else {
      flags.set(name, next);
      i += 1;
    }
  }
  return { command, flags };
}

export function getString(flags: Map<string, string | boolean>, name: string): string | undefined {
  const value = flags.get(name);
  if (typeof value === 'boolean') return undefined;
  return value;
}

export function requireString(flags: Map<string, string | boolean>, name: string): string {
  const value = getString(flags, name);
  if (!value) throw new Error(`Missing --${name}.`);
  return value;
}

export function hasFlag(flags: Map<string, string | boolean>, name: string): boolean {
  return flags.get(name) === true;
}

