import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));

export type LocalEnvLoadResult = {
  loadedFiles: string[];
  missingFiles: string[];
  setKeys: string[];
  preservedKeys: string[];
};

function env(): Record<string, string | undefined> {
  return (process as unknown as { env?: Record<string, string | undefined> }).env ?? {};
}

function parseEnvFile(text: string): Array<[string, string]> {
  const entries: Array<[string, string]> = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }
    const normalized = line.startsWith('export ') ? line.slice('export '.length).trim() : line;
    const equalsIndex = normalized.indexOf('=');
    if (equalsIndex <= 0) {
      continue;
    }
    const key = normalized.slice(0, equalsIndex).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      continue;
    }
    let value = normalized.slice(equalsIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    entries.push([key, value]);
  }

  return entries;
}

export function getLocalEnvValue(name: string): string {
  return env()[name] ?? '';
}

export function hasLocalEnvValue(name: string): boolean {
  return getLocalEnvValue(name).trim().length > 0;
}

export function maskSecret(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }
  if (trimmed.length <= 8) {
    return `${trimmed.slice(0, 2)}...`;
  }
  return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
}

export async function loadLocalEnv(): Promise<LocalEnvLoadResult> {
  const result: LocalEnvLoadResult = {
    loadedFiles: [],
    missingFiles: [],
    setKeys: [],
    preservedKeys: []
  };
  const targetEnv = env();

  for (const filename of ['.env.local', '.env']) {
    const path = resolve(projectRoot, filename);
    let text = '';
    try {
      text = await readFile(path, 'utf8');
      result.loadedFiles.push(filename);
    } catch {
      result.missingFiles.push(filename);
      continue;
    }

    for (const [key, value] of parseEnvFile(text)) {
      if (typeof targetEnv[key] === 'string' && targetEnv[key] !== '') {
        result.preservedKeys.push(key);
        continue;
      }
      targetEnv[key] = value;
      result.setKeys.push(key);
    }
  }

  result.setKeys = [...new Set(result.setKeys)].sort();
  result.preservedKeys = [...new Set(result.preservedKeys)].sort();
  return result;
}
