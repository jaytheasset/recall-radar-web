import { limitSlug, slugify } from './slug.ts';

export type NormalizedBrandName = {
  rawName: string;
  displayName: string;
  slug: string;
  normalized: boolean;
};

export function isKnownBrandName(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const name = value.trim().replace(/^[\s(\[]+|[\s)\].]+$/g, '');
  return Boolean(name) && !/^(?:n\/?a|none|unknown|unknown brand|unbranded|no brand|sans marque|(?:brand(?: or company)? |firm |business )?not (?:available|provided|listed)(?: in english)?)$/i.test(name);
}

export function stripMissingEnglishName(value: string): string {
  return value.replace(/\s*\(\s*not available in english\s*\)\s*$/i, '').trim();
}

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
  const name = stripMissingEnglishName(raw);
  const candidate = extractDbaName(name) ?? name;
  const withoutLocation = stripTrailingLocation(candidate);
  const withoutLegalSuffix = stripLegalSuffix(withoutLocation);
  const displayName = withoutLegalSuffix.length >= 2 ? withoutLegalSuffix : name;
  const slug = limitSlug(displayName, 72) || limitSlug(`brand-${[...displayName]
    .filter((character) => /[\p{L}\p{N}]/u.test(character))
    .map((character) => character.codePointAt(0)?.toString(16)).join('-')}`, 72);

  return {
    rawName: raw,
    displayName,
    slug,
    normalized: slugify(displayName) !== slugify(raw)
  };
}
