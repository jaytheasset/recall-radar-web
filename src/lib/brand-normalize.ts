import { limitSlug, slugify } from './slug';

export type NormalizedBrandName = {
  rawName: string;
  displayName: string;
  slug: string;
  normalized: boolean;
};

function tidyBrandName(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .replace(/\s+,/g, ',')
    .replace(/,\s*,+/g, ',')
    .replace(/^[,\s]+|[,\s.]+$/g, '')
    .trim();
}

function extractDbaName(value: string): string | null {
  const match = value.match(/\b(?:d\/b\/a|dba|doing business as)\b\.?\s+(.+)$/i);
  return match ? tidyBrandName(match[1]) : null;
}

function stripTrailingLocation(value: string): string {
  return tidyBrandName(
    value
      .replace(/,\s*of\s+[^,]+(?:,\s*[^,]+){0,3}$/i, '')
      .replace(/\s+of\s+[A-Z][A-Za-z .'-]+,\s*[A-Z][A-Za-z .'-]+(?:,\s*[A-Z][A-Za-z .'-]+)?$/i, '')
  );
}

function stripLegalSuffix(value: string): string {
  let current = tidyBrandName(value);
  let previous = '';

  while (current && current !== previous) {
    previous = current;
    current = tidyBrandName(
      current
        .replace(/(?:,\s*|\s+)co\.?\s+ltd\.?$/i, '')
        .replace(/(?:,\s*|\s+)company\s+ltd\.?$/i, '')
        .replace(/(?:,\s*|\s+)(?:incorporated|inc\.?|llc|l\.l\.c\.|ltd\.?|limited|corp\.?|corporation)$/i, '')
    );
  }

  return current;
}

export function normalizeBrandName(rawName: string): NormalizedBrandName {
  const raw = tidyBrandName(rawName);
  const dbaName = extractDbaName(raw);
  const candidate = dbaName ?? raw;
  const withoutLocation = stripTrailingLocation(candidate);
  const withoutLegalSuffix = stripLegalSuffix(withoutLocation);
  const displayName = withoutLegalSuffix.length >= 2 ? withoutLegalSuffix : raw;
  const slug = limitSlug(displayName, 72) || limitSlug(raw, 72) || 'brand';

  return {
    rawName: raw,
    displayName,
    slug,
    normalized: slugify(displayName) !== slugify(raw)
  };
}
