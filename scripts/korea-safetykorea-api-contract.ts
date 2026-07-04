export const SAFETYKOREA_BASE_URL = 'http://www.safetykorea.kr';
export const SAFETYKOREA_AUTH_HEADER_NAME = 'AuthKey';
export const SAFETYKOREA_DOMESTIC_RECALL_LIST_PATH = '/openapi/api/recall/recallList.json';
export const SAFETYKOREA_DOMESTIC_RECALL_DETAIL_PATH = '/openapi/api/recall/recallDetail.json';

export type SafetyKoreaConditionKey =
  | 'all'
  | 'barcodeNum'
  | 'recallProductName'
  | 'recallBrandName'
  | 'recallModelName'
  | 'certNum'
  | 'publishDate';

export type SafetyKoreaRecallFileDraft = {
  fileDiv?: unknown;
  imageUrl?: unknown;
};

export type SafetyKoreaDomesticRecallRaw = {
  recallUid?: unknown;
  recallProductName?: unknown;
  recallBrandName?: unknown;
  recallModelName?: unknown;
  recallModelCnt?: unknown;
  recallTypeName?: unknown;
  recallMeans?: unknown;
  barcodeNum?: unknown;
  categoryName?: unknown;
  certNum?: unknown;
  productItemName?: unknown;
  recallCmpnyDivName?: unknown;
  recallInqryTel?: unknown;
  recallCmpnyName?: unknown;
  recallFrgnCmpnyName?: unknown;
  makerCntryName?: unknown;
  makerName?: unknown;
  makingCntryName?: unknown;
  publishDate?: unknown;
  publishRecallVol?: unknown;
  recallActionAmt?: unknown;
  recallStaDate?: unknown;
  recallEndDate?: unknown;
  harmDscr?: unknown;
  accidentCaseDscr?: unknown;
  publishActionDscr?: unknown;
  recallFiles?: unknown;
};

export type SafetyKoreaDraftImage = {
  url: string;
  caption?: string;
  alt?: string;
};

export type SafetyKoreaDraftRecall = {
  id: string;
  source: 'KR_SAFETYKOREA';
  sourceUrl: string;
  title: string;
  brandNames: string[];
  productNames: string[];
  category: string;
  hazard: string;
  remedy: string;
  recallDate: string;
  affectedUnits: string;
  description: string;
  proposedSlug: string;
  recallNumber: string;
  recallUid: string;
  identifiers: string[];
  images: SafetyKoreaDraftImage[];
  categoryMappingNotes: string[];
  raw: SafetyKoreaDomesticRecallRaw;
};

const runtimeEnv = (process as typeof process & { env?: Record<string, string | undefined> }).env ?? {};
const officialImageHosts = new Set(['www.safetykorea.kr', 'safetykorea.kr', 'office.safetykorea.kr']);

export function getSafetyKoreaAuthKey(env: Record<string, string | undefined> = runtimeEnv): string | undefined {
  const value = env.SAFETYKOREA_API_KEY?.trim();
  return value || undefined;
}

export function buildDomesticRecallListUrl(params?: {
  conditionKey?: SafetyKoreaConditionKey;
  conditionValue?: string;
}): URL {
  const url = new URL(SAFETYKOREA_DOMESTIC_RECALL_LIST_PATH, SAFETYKOREA_BASE_URL);
  url.searchParams.set('conditionKey', params?.conditionKey ?? 'all');
  url.searchParams.set('conditionValue', params?.conditionValue ?? '');
  return url;
}

export function buildDomesticRecallDetailUrl(recallUid: string): URL {
  const url = new URL(SAFETYKOREA_DOMESTIC_RECALL_DETAIL_PATH, SAFETYKOREA_BASE_URL);
  url.searchParams.set('recallUid', recallUid);
  return url;
}

export function buildSafetyKoreaHeaders(authKey = getSafetyKoreaAuthKey()): Record<string, string> {
  return {
    accept: 'application/json',
    ...(authKey ? { [SAFETYKOREA_AUTH_HEADER_NAME]: authKey } : {})
  };
}

export function normalizeSafetyKoreaDate(value: unknown): string {
  const text = sanitizeSafetyKoreaText(value);
  if (!text) {
    return '';
  }

  const compact = text.replace(/[^\d]/g, '');
  if (compact.length >= 8) {
    const iso = `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`;
    const parsed = new Date(`${iso}T00:00:00Z`);
    return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
  }

  const parsed = new Date(text.includes('T') ? text : `${text}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
}

export function splitSafetyKoreaImageUrls(value: unknown): string[] {
  if (Array.isArray(value)) {
    return uniqueNonEmpty(value.flatMap(splitSafetyKoreaImageUrls));
  }

  const text = sanitizeSafetyKoreaText(value);
  if (!text) {
    return [];
  }

  return uniqueNonEmpty(text.split(/[,;|\n\r]+/).map((part) => part.trim()));
}

export function sanitizeSafetyKoreaText(value: unknown): string {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return '';
  }

  return String(value)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#039;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function mapSafetyKoreaDomesticRecallDraft(raw: SafetyKoreaDomesticRecallRaw): SafetyKoreaDraftRecall {
  const recallUid = firstNonEmpty([raw.recallUid]);
  const productName = firstNonEmpty([raw.recallProductName, raw.productItemName, raw.recallModelName], 'SafetyKorea recall');
  const brandName = firstNonEmpty([raw.recallBrandName]);
  const modelName = firstNonEmpty([raw.recallModelName]);
  const companyName = firstNonEmpty([raw.recallCmpnyName, raw.recallFrgnCmpnyName, raw.makerName]);
  const title = uniqueNonEmpty([brandName, productName, modelName]).join(' - ') || productName;
  const categoryMapping = mapSafetyKoreaDraftCategory(raw);
  const hazard = uniqueNonEmpty([raw.harmDscr, raw.accidentCaseDscr].map(sanitizeSafetyKoreaText)).join(' ');
  const remedy = uniqueNonEmpty([raw.publishActionDscr, raw.recallMeans, raw.recallTypeName].map(sanitizeSafetyKoreaText)).join(' ');
  const recallDate = normalizeSafetyKoreaDate(raw.publishDate) || normalizeSafetyKoreaDate(raw.recallStaDate);
  const identifiers = identifiersFor(raw);

  return {
    id: `kr-safetykorea-${slugToken(recallUid || productName)}`,
    source: 'KR_SAFETYKOREA',
    sourceUrl: buildDomesticRecallDetailUrl(recallUid || productName).toString(),
    title,
    brandNames: uniqueNonEmpty([brandName, companyName, sanitizeSafetyKoreaText(raw.makerName)]),
    productNames: uniqueNonEmpty([productName, modelName, sanitizeSafetyKoreaText(raw.productItemName)]),
    category: categoryMapping.category,
    hazard,
    remedy,
    recallDate,
    affectedUnits: firstNonEmpty([raw.recallActionAmt, raw.publishRecallVol]),
    description: descriptionFor(raw, identifiers),
    proposedSlug: proposedSlugFor(productName, recallUid),
    recallNumber: recallUid,
    recallUid,
    identifiers,
    images: imagesFor(raw, productName),
    categoryMappingNotes: categoryMapping.notes,
    raw
  };
}

export function mapSafetyKoreaDraftCategory(raw: SafetyKoreaDomesticRecallRaw): {
  category: 'baby-kids' | 'battery-electronics' | 'household-appliance' | 'general-consumer-product';
  notes: string[];
} {
  const text = [
    raw.categoryName,
    raw.productItemName,
    raw.recallProductName,
    raw.recallModelName,
    raw.harmDscr,
    raw.publishActionDscr
  ]
    .map(sanitizeSafetyKoreaText)
    .join(' ');

  if (/(어린이|유아|아동|완구|유모차|카시트|학용품|어린이용품|유아용품)/.test(text)) {
    return { category: 'baby-kids', notes: [] };
  }

  if (/(전기|전자|배터리|충전기|리튬|생활가전|전기기기|전기용품|어댑터)/.test(text)) {
    return { category: 'battery-electronics', notes: [] };
  }

  if (/(생활용품|가구|주방|가정용품|생활화학|화학제품|세제|방향제|위생용품)/.test(text)) {
    return { category: 'household-appliance', notes: [] };
  }

  if (/(식품|음식|농산물|가공식품)/.test(text)) {
    return {
      category: 'general-consumer-product',
      notes: ['Food-like terms found; keep SafetyKorea food handling conservative because Korea MFDS is a separate future source.']
    };
  }

  return { category: 'general-consumer-product', notes: ['Unknown SafetyKorea category mapped conservatively.'] };
}

export function isOfficialSafetyKoreaImageUrl(value: string): boolean {
  try {
    const url = new URL(value, SAFETYKOREA_BASE_URL);
    return officialImageHosts.has(url.hostname) && /^https?:$/.test(url.protocol) && !isSuspiciousImageUrl(url);
  } catch {
    return false;
  }
}

function descriptionFor(raw: SafetyKoreaDomesticRecallRaw, identifiers: string[]): string {
  return uniqueNonEmpty([
    `제품명: ${sanitizeSafetyKoreaText(raw.recallProductName)}`,
    `브랜드: ${sanitizeSafetyKoreaText(raw.recallBrandName)}`,
    `모델명: ${sanitizeSafetyKoreaText(raw.recallModelName)}`,
    `사업자: ${sanitizeSafetyKoreaText(raw.recallCmpnyName)}`,
    `제조사: ${sanitizeSafetyKoreaText(raw.makerName)}`,
    `제조국: ${sanitizeSafetyKoreaText(raw.makingCntryName || raw.makerCntryName)}`,
    `위해내용: ${sanitizeSafetyKoreaText(raw.harmDscr)}`,
    `사고사례: ${sanitizeSafetyKoreaText(raw.accidentCaseDscr)}`,
    `조치내용: ${sanitizeSafetyKoreaText(raw.publishActionDscr)}`,
    identifiers.length ? `식별정보: ${identifiers.join(', ')}` : ''
  ]).join(' ');
}

function identifiersFor(raw: SafetyKoreaDomesticRecallRaw): string[] {
  return uniqueNonEmpty([
    prefixedValue('recallUid', raw.recallUid),
    prefixedValue('barcodeNum', raw.barcodeNum),
    prefixedValue('certNum', raw.certNum),
    prefixedValue('modelName', raw.recallModelName),
    prefixedValue('publishDate', normalizeSafetyKoreaDate(raw.publishDate)),
    prefixedValue('recallStartDate', normalizeSafetyKoreaDate(raw.recallStaDate)),
    prefixedValue('recallEndDate', normalizeSafetyKoreaDate(raw.recallEndDate))
  ]);
}

function prefixedValue(label: string, value: unknown): string {
  const text = sanitizeSafetyKoreaText(value);
  return text ? `${label}: ${text}` : '';
}

function imagesFor(raw: SafetyKoreaDomesticRecallRaw, fallbackAlt: string): SafetyKoreaDraftImage[] {
  const files = normalizeRecallFiles(raw.recallFiles);
  const seen = new Set<string>();

  return files.flatMap((file) => {
    const caption = meaningfulCaption(sanitizeSafetyKoreaText(file.fileDiv));
    return splitSafetyKoreaImageUrls(file.imageUrl).flatMap((imageUrl) => {
      const absoluteUrl = absoluteSafetyKoreaUrl(imageUrl);
      if (!absoluteUrl || !isOfficialSafetyKoreaImageUrl(absoluteUrl) || seen.has(absoluteUrl)) {
        return [];
      }

      seen.add(absoluteUrl);
      return [
        {
          url: absoluteUrl,
          ...(caption ? { caption } : {}),
          alt: caption || fallbackAlt
        }
      ];
    });
  });
}

function normalizeRecallFiles(value: unknown): SafetyKoreaRecallFileDraft[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is SafetyKoreaRecallFileDraft => Boolean(item) && typeof item === 'object');
  }

  return value && typeof value === 'object' ? [value as SafetyKoreaRecallFileDraft] : [];
}

function absoluteSafetyKoreaUrl(value: string): string {
  try {
    return new URL(value, SAFETYKOREA_BASE_URL).toString();
  } catch {
    return '';
  }
}

function isSuspiciousImageUrl(url: URL): boolean {
  return /(?:logo|icon|banner|header|footer|sns|facebook|twitter|tracking|placeholder)/i.test(url.pathname);
}

function meaningfulCaption(value: string): string | undefined {
  if (!value) {
    return undefined;
  }

  if (/^[^\\/]+\.(?:png|jpe?g|gif|webp|bmp)(?:\?.*)?$/i.test(value)) {
    return undefined;
  }

  if (/^(?:image|photo|file|첨부파일|이미지|제품사진)$/i.test(value)) {
    return undefined;
  }

  return value;
}

function proposedSlugFor(productName: string, recallUid: string): string {
  const productToken = slugToken(productName);
  const uidToken = slugToken(recallUid);
  return uniqueNonEmpty([productToken, 'kr-safetykorea', uidToken]).join('-') || 'kr-safetykorea-notice';
}

function slugToken(value: unknown): string {
  const text = sanitizeSafetyKoreaText(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return text || 'notice';
}

function firstNonEmpty(values: unknown[], fallback = ''): string {
  for (const value of values) {
    const text = sanitizeSafetyKoreaText(value);
    if (text) {
      return text;
    }
  }

  return fallback;
}

function uniqueNonEmpty(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
