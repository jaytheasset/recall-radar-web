export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function brandToSlug(brand: string): string {
  return slugify(brand);
}

export function limitSlug(value: string, maxLength = 96): string {
  const parts = slugify(value).split('-').filter(Boolean);
  let limitedSlug = '';

  for (const part of parts) {
    const nextSlug = limitedSlug ? `${limitedSlug}-${part}` : part;

    if (nextSlug.length > maxLength) {
      break;
    }

    limitedSlug = nextSlug;
  }

  return limitedSlug || parts[0] || '';
}

export type RecallSlugOptions = {
  productNames?: string[];
  brandNames?: string[];
  maxBaseLength?: number;
};

const lowValueSegmentPatterns = [
  /^risk of serious injury or death\b/i,
  /^sold exclusively\b/i,
  /^sold at\b/i,
  /^imported by\b/i,
  /^manufactured by\b/i
];

const lowValuePhrasePatterns = [
  /\b(?:recalled|recalls)\s+due\s+to\b/gi,
  /\b(?:recalled|recalls)\b/gi,
  /\bdue\s+to\b/gi,
  /\brisk\s+of\s+serious\s+injury\s+or\s+death(?:\s+from)?\b/gi,
  /\bserious\s+injury\s+or\s+death(?:\s+from)?\b/gi,
  /\brisk\s+of\b/gi,
  /\bsold\s+exclusively\b/gi,
  /\bsold\s+at\b/gi
];

function cleanRecallTitle(title: string): string {
  const usefulSegments = title
    .split(';')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .filter((segment) => !lowValueSegmentPatterns.some((pattern) => pattern.test(segment)));

  return lowValuePhrasePatterns
    .reduce((text, pattern) => text.replace(pattern, ' '), usefulSegments.join(' ') || title)
    .replace(/\s+/g, ' ')
    .trim();
}

function hasUsefulSlugTokens(value: string): boolean {
  return slugify(value).split('-').filter(Boolean).length >= 3;
}

function recallSlugSource(title: string, options: RecallSlugOptions): string {
  const cleanedTitle = cleanRecallTitle(title);

  if (hasUsefulSlugTokens(cleanedTitle)) {
    return cleanedTitle;
  }

  return [
    options.brandNames?.[0],
    options.productNames?.[0],
    cleanedTitle || title
  ]
    .filter(Boolean)
    .join(' ');
}

export function recallSlug(title: string, id: string, options: RecallSlugOptions = {}): string {
  const idSlug = slugify(id);
  const base = limitSlug(recallSlugSource(title, options), options.maxBaseLength ?? 72) || 'recall';
  return idSlug ? `${base}-${idSlug}` : base;
}

export function titleFromSlug(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
