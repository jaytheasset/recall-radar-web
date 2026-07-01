import type { SiteRecall } from './recall-data';

const IDENTIFIER_PATTERNS = [
  /\b(?:model|models|model number|model no\.?|model #)\s*[:#-]?\s*[a-z0-9][a-z0-9./_-]{2,}(?:\s*(?:,|and|\/)\s*[a-z0-9][a-z0-9./_-]{2,}){0,4}/gi,
  /\b(?:upc|upcs|upc code|upc number)\s*[:#-]?\s*[0-9][0-9 -]{5,}\b/gi,
  /\b(?:lot|lots|lot code|lot number|batch|batch code)\s*[:#-]?\s*[a-z0-9][a-z0-9./_-]{2,}\b/gi,
  /\b(?:date code|date-code|best by|use by|sell by|expiration date|exp\.?)\s*[:#-]?\s*[a-z0-9][a-z0-9 ,./-]{3,30}/gi,
  /\brn\s*[0-9]{4,}\b/gi
];

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function truncate(value: string, maxLength: number): string {
  const clean = value.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLength) {
    return clean;
  }

  const limited = clean.slice(0, maxLength);
  const wordBoundary = limited.lastIndexOf(' ');
  return `${limited.slice(0, wordBoundary > 40 ? wordBoundary : maxLength).trim()}...`;
}

function joinLimited(values: string[], maxItems = 3): string {
  const limited = values.slice(0, maxItems).map((value) => truncate(value, 70));
  const remaining = values.length - limited.length;
  return remaining > 0 ? `${limited.join(', ')} and ${remaining} more` : limited.join(', ');
}

export function getRecallIdentifierHints(recall: SiteRecall): string[] {
  const text = [recall.title, recall.description, ...recall.productNames].join(' ');
  const matches = IDENTIFIER_PATTERNS.flatMap((pattern) =>
    [...text.matchAll(pattern)].map((match) => truncate(match[0], 80))
  );

  return unique(matches).slice(0, 4);
}

export function getWhatToCheckItems(recall: SiteRecall): string[] {
  const items: string[] = [];
  const productNames = unique(recall.productNames);
  const brandNames = unique(recall.displayBrandNames.length ? recall.displayBrandNames : recall.brandNames);
  const identifierHints = getRecallIdentifierHints(recall);

  if (productNames.length) {
    items.push(`Compare the product name and label with: ${joinLimited(productNames)}.`);
  }

  if (brandNames.length) {
    items.push(`Compare the brand or company name with: ${joinLimited(brandNames)}.`);
  }

  if (recall.recallNumber) {
    items.push(`Check recall number ${recall.recallNumber} in the official notice.`);
  }

  for (const hint of identifierHints) {
    items.push(`Look for model, UPC, lot, or date-code details like: ${hint}.`);
  }

  if (recall.affectedUnits) {
    items.push(`Review whether your item is included in the affected units: ${truncate(recall.affectedUnits, 90)}.`);
  }

  if (recall.primaryImageUrl) {
    items.push('Check the product photo against your item.');
  }

  items.push('Review the remedy before using or keeping the product.');

  return unique(items).slice(0, 7);
}
