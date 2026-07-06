import { SEARCH_ALIAS_GROUPS } from '../src/lib/search-aliases.ts';

type AliasIssue = {
  groupId: string;
  field: 'id' | 'terms' | 'aliases';
  value: string;
  issue: string;
};

function hasControlCharacter(value: string): boolean {
  return /[\u0000-\u001F\u007F]/.test(value);
}

function hasBrokenEncodingMarker(value: string): boolean {
  return value.includes('\uFFFD') || value.includes('?') || /[<>]/.test(value);
}

function normalized(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

const issues: AliasIssue[] = [];
const groupIds = new Set<string>();

for (const group of SEARCH_ALIAS_GROUPS) {
  if (!group.id.trim()) {
    issues.push({ groupId: group.id, field: 'id', value: group.id, issue: 'Alias group id is empty.' });
  }

  if (groupIds.has(group.id)) {
    issues.push({ groupId: group.id, field: 'id', value: group.id, issue: 'Duplicate alias group id.' });
  }
  groupIds.add(group.id);

  for (const field of ['terms', 'aliases'] as const) {
    const seen = new Set<string>();

    if (!Array.isArray(group[field]) || group[field].length === 0) {
      issues.push({ groupId: group.id, field, value: '', issue: `${field} must contain at least one value.` });
      continue;
    }

    for (const rawValue of group[field]) {
      const value = String(rawValue);
      const key = normalized(value);

      if (!key) {
        issues.push({ groupId: group.id, field, value, issue: 'Alias value is empty.' });
      }

      if (seen.has(key)) {
        issues.push({ groupId: group.id, field, value, issue: 'Duplicate value in the same alias group field.' });
      }
      seen.add(key);

      if (hasControlCharacter(value)) {
        issues.push({ groupId: group.id, field, value, issue: 'Alias value contains a control character.' });
      }

      if (hasBrokenEncodingMarker(value)) {
        issues.push({ groupId: group.id, field, value, issue: 'Alias value contains broken encoding or markup-like characters.' });
      }
    }
  }
}

const summary = {
  passed: issues.length === 0,
  groups: SEARCH_ALIAS_GROUPS.length,
  termCount: SEARCH_ALIAS_GROUPS.reduce((total, group) => total + group.terms.length, 0),
  aliasCount: SEARCH_ALIAS_GROUPS.reduce((total, group) => total + group.aliases.length, 0),
  issues
};

console.log(JSON.stringify(summary, null, 2));

if (!summary.passed) {
  process.exitCode = 1;
}
