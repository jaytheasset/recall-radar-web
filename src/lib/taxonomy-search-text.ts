export function normalizeTaxonomySearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function taxonomyTermMatchesQuery(query: string, normalizedQuery: string, rawTerm: string): boolean {
  const normalizedTerm = normalizeTaxonomySearchText(rawTerm);
  const rawNeedle = rawTerm.trim().toLowerCase();
  const queryTokens = normalizedQuery.split(' ').filter(Boolean);

  if (!normalizedTerm) {
    return false;
  }

  if (normalizedQuery === normalizedTerm || queryTokens.includes(normalizedTerm)) {
    return true;
  }

  if (normalizedTerm.includes(' ')) {
    return normalizedQuery.includes(normalizedTerm);
  }

  return /[^\x00-\x7F]/.test(rawNeedle) && rawNeedle.length > 1 && query.toLowerCase().includes(rawNeedle);
}

export function removeTaxonomySearchTerms(query: string, terms: string[]): string {
  let remaining = query;

  for (const term of [...new Set(terms.map(normalizeTaxonomySearchText))].sort((a, b) => b.length - a.length)) {
    if (!term) {
      continue;
    }

    if (/[^\x00-\x7F]/.test(term) || term.includes(' ')) {
      remaining = remaining.split(term).join(' ');
      continue;
    }

    remaining = remaining
      .split(' ')
      .filter((token) => token !== term)
      .join(' ');
  }

  return remaining.replace(/\s+/g, ' ').trim();
}
