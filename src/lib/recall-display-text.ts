function uniqueText(values: string[]): string[] {
  return [...new Set(values.map((value) => value.replace(/\s+/g, ' ').trim()).filter(Boolean))];
}

const contactDetailPattern =
  /\b(?:call|phone|tel|email|visit|web|website|online|live chat)\b\s*:?\s*|\bhttps?:\/\/[^\s)]+|\bwww\.[^\s)]+|\b[A-Z0-9._%+-]+@[A-Z0-9.-]+(?:\.[A-Z]{2,})+\b|[+()0-9][0-9 ()+-]{6,}[0-9]/i;

const contactActionPattern =
  /\b(?:to arrange|to receive|to return|to obtain|to request|to schedule|to register|for a full refund|for a refund|for a replacement|for repair|for further instructions|if you|if unable)\b/i;

const photoNoun = /\b(?:photo(?:graph)?s?|pictures?|images?)\b/.source;
const submissionVerb = /\b(?:send(?:ing)?|submit(?:ting)?|upload(?:ing)?|e-?mail(?:ing)?|provid(?:e|ing)|attach(?:ing)?)\b/.source;
const photoSubmissionPattern = new RegExp(
  `${submissionVerb}.*${photoNoun}|${photoNoun}.*${submissionVerb}\\s+(?:it|them|the proof)\\b`,
  'i'
);
const photoDestinationPattern = /,?\s+(?:(?:or|and)\s+online\s+)?(?:(?:by|via)\s+e-?mail\s+)?(?:to|at|via|through|using)\s*:?\s*(?:https?:\/\/[^\s)]+|www\.[^\s)]+|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b)/gi;
const emailPhotoVerbPattern = new RegExp(`\\be-?mail(?=\\s+(?:it\\b|them\\b|(?:a |the |your )?${photoNoun}))`, 'gi');

function stripContactDetails(value: string): string {
  return value
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+(?:\.[A-Z]{2,})+\b/gi, '')
    .replace(/\bhttps?:\/\/[^\s)]+|\bwww\.[^\s)]+/gi, '')
    .replace(/\b(?:call|phone|tel)\s*:?\s*[+()0-9][0-9 ()+-]{6,}[0-9]\b/gi, '')
    .replace(/\b(?:email|visit|web|website|online|live chat|call|phone|tel)\b\s*:?\s*/gi, '')
    .replace(/\b(?:via|by)\s+email\b/gi, '')
    .replace(/\s+([.,;:])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function simplifyContactSegments(value: string): string {
  return value
    .split(/\s+(?=Contact\s+)/i)
    .map((segment) => {
      const text = segment.trim();

      if (!/^Contact\s+/i.test(text)) {
        return stripContactDetails(text);
      }

      if (contactDetailPattern.test(text) && !contactActionPattern.test(text)) {
        return '';
      }

      return stripContactDetails(text);
    })
    .filter(Boolean)
    .join(' ');
}

function simplifyContactHeavyAction(value: string): string {
  return simplifyContactSegments(
    value
      .replace(/\s+Details to help identify the product\b.*$/i, '')
    .replace(
      /\bContact\s+(.+?)\s+(?:via|by)\s+email\s+[A-Z0-9._%+-]+@[A-Z0-9.-]+(?:\.[A-Z]{2,})+\s+to\s+/gi,
      'Contact $1 to '
    )
  )
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

export function formatRecallAction(value: string): { text: string; hasPhotoSubmission: boolean } {
  let hasPhotoSubmission = false;
  const action = value.split(/(?<=[.!?])\s+/).map((sentence) => {
    if (!photoSubmissionPattern.test(sentence)) return sentence;

    const instruction = sentence.replace(photoDestinationPattern, (destination) => {
      hasPhotoSubmission = true;
      return destination.match(/[.,;:!?]+$/)?.[0] ?? '';
    });
    return instruction === sentence
      ? sentence
      : instruction.replace(emailPhotoVerbPattern, (verb) => (verb[0] === 'E' ? 'Send' : 'send'));
  }).join(' ');

  return { text: simplifyContactHeavyAction(action), hasPhotoSubmission };
}

export function getPhotoSubmissionNoticeUrl(source: string, sourceUrl: string, hasPhotoSubmission: boolean): string {
  if (source !== 'CPSC' || !hasPhotoSubmission) return '';

  const url = URL.parse(sourceUrl);
  if (url?.protocol === 'https:' && ['cpsc.gov', 'www.cpsc.gov'].includes(url.hostname) && /^\/Recalls\//i.test(url.pathname)) {
    return url.href;
  }

  return '';
}

export function buildRecallActionItems(values: string[]): string[] {
  const items = uniqueText(values.map((value) => formatRecallAction(value).text)).filter(
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
  const links = [...text.matchAll(/\b(?:https?:\/\/[^\s)]+|www\.[^\s)]+)/gi)].map(
    (match) => `Website: ${match[0].replace(/[.,;:!?]+$/, '')}`
  );

  return uniqueText([...emails, ...phones, ...links]);
}
