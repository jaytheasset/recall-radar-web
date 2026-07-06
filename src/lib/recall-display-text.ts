function uniqueText(values: string[]): string[] {
  return [...new Set(values.map((value) => value.replace(/\s+/g, ' ').trim()).filter(Boolean))];
}

function simplifyContactHeavyAction(value: string): string {
  return value
    .replace(
      /\bContact\s+(.+?)\s+(?:via|by)\s+email\s+[A-Z0-9._%+-]+@[A-Z0-9.-]+(?:\.[A-Z]{2,})+\s+to\s+/gi,
      'Contact $1 to '
    )
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+(?:\.[A-Z]{2,})+\b/gi, '')
    .replace(/\b(?:call|phone|tel)\s*:?\s*[+()0-9][0-9 ()+-]{6,}[0-9]\b/gi, '')
    .replace(/\b(?:via|by)\s+email\b/gi, '')
    .replace(/\b(?:email|visit|web|call|phone|tel)\s*:?\s*/gi, '')
    .replace(/\s+Contact\s+[^.]+\.?\s*$/i, '')
    .replace(/\s+Contact\s+[^.]+\.?\s*Contact\s+/gi, ' Contact ')
    .replace(/\s+([.,;:])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isContactOnlyAction(value: string): boolean {
  const text = value.replace(/\s+/g, ' ').trim();
  return /^Contact\s+[^.]+\.?$/i.test(text) || /^(?:Call|Email|Visit|Web)\b/i.test(text);
}

export function cleanRecallDisplayText(value: string): string {
  return simplifyContactHeavyAction(value);
}

export function buildRecallActionItems(values: string[]): string[] {
  const items = uniqueText(values.map(simplifyContactHeavyAction)).filter(
    (value) => value && !isContactOnlyAction(value) && !/^(?:[a-z]{2}|com|co|net|org)(?:\s+to\b.*)?$/i.test(value)
  );

  return items.filter(
    (item, index) =>
      !items.some((other, otherIndex) => otherIndex !== index && other.length > item.length + 20 && other.includes(item))
  );
}

export function buildRecallContactItems(values: string[]): string[] {
  const text = values.join(' ');
  const emails = [...text.matchAll(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+(?:\.[A-Z]{2,})+\b/gi)].map(
    (match) => `Email: ${match[0]}`
  );
  const phones = [...text.matchAll(/\b(?:call|phone|tel)\s*:?\s*([+()0-9][0-9 ()+-]{6,}[0-9])\b/gi)].map(
    (match) => `Phone: ${match[1].trim()}`
  );
  const links = [...text.matchAll(/\b(?:https?:\/\/[^\s)]+|www\.[^\s)]+)/gi)].map((match) => `Website: ${match[0]}`);

  return uniqueText([...emails, ...phones, ...links]);
}
