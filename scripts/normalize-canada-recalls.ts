import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NormalizedRecall, ProcessedRecallFile } from '../src/data/recall-types.ts';
import { slugify } from '../src/lib/slug.ts';
import { canadaImagesFromRawRecord } from './canada-detail-images.ts';
import { canadaProcessedPath, canonicalProcessedPath, mergeProcessedRecalls } from './merge-recalls.ts';
import { writeJsonAtomic } from './normalize-cpsc.ts';

export type CanadaRecallRaw = {
  NID?: unknown;
  Title?: unknown;
  URL?: unknown;
  Organization?: unknown;
  Product?: unknown;
  Issue?: unknown;
  'What you should do'?: unknown;
  Category?: unknown;
  'Recall class'?: unknown;
  'Last updated'?: unknown;
  Archived?: unknown;
  Images?: unknown;
};

type RawCanadaFile = {
  fetchedAt?: unknown;
  endpoint?: unknown;
  count?: unknown;
  records?: unknown;
};

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
export const defaultRawCanadaRecallsPath = resolve(projectRoot, 'data/raw/canada-recalls.json');
export const defaultCanadaProcessedPath = canadaProcessedPath;

function asString(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number'
    ? String(value)
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&quot;/gi, '"')
        .replace(/&#039;/gi, "'")
        .replace(/<[^>]+>/g, ' ')
        .replace(/([a-z)])([A-Z])/g, '$1 $2')
        .replace(/([.!?])([A-Z])/g, '$1 $2')
        .replace(/\s+/g, ' ')
        .trim()
    : '';
}

function firstNonEmpty(values: unknown[], fallback = ''): string {
  for (const value of values) {
    const text = asString(value);
    if (text) {
      return text;
    }
  }

  return fallback;
}

function uniqueNonEmpty(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function normalizeDate(value: unknown): string {
  const text = asString(value);
  if (!text) {
    return '';
  }

  const date = new Date(text.includes('T') ? text : `${text}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? text.slice(0, 10) : date.toISOString().slice(0, 10);
}

function truncateText(value: string, maxLength = 260): string {
  if (value.length <= maxLength) {
    return value;
  }

  const truncated = value.slice(0, maxLength);
  const wordBoundary = truncated.lastIndexOf(' ');
  return `${truncated.slice(0, wordBoundary > 80 ? wordBoundary : maxLength).trim()}...`;
}

function extractBrands(raw: CanadaRecallRaw): string[] {
  const title = asString(raw.Title);
  const product = asString(raw.Product);
  const brandsFromTitle = [...title.matchAll(/([^,;:]+?)\s+brand\b/gi)].map((match) =>
    match[1]
      .replace(/^(certain|various|selected)\s+/i, '')
      .replace(/\s+and\s*$/i, '')
      .trim()
  );
  const vehicleBrand = firstNonEmpty([title.match(/Transport Canada Recall\s*-\s*\d+\s*-\s*([A-Z0-9 -]+)/i)?.[1]]);
  const recalledByBrand = firstNonEmpty([product.match(/recalled by\s+([A-Z0-9 &.'-]+)/i)?.[1]]);

  return uniqueNonEmpty([...brandsFromTitle, vehicleBrand, recalledByBrand]);
}

function extractIdentifierText(raw: CanadaRecallRaw): string[] {
  const text = [raw.Title, raw.Product, raw.Issue, raw['What you should do'], raw.Category].map(asString).join(' ');
  const patterns = [
    /\b(?:UPC|barcode)\s*[:#-]?\s*[0-9][0-9 -]{5,}\b/gi,
    /\b\d{8,14}\b/g,
    /\b(?:lot|batch|code)\s*[:#-]?\s*[A-Z0-9][A-Z0-9./_-]{2,}\b/gi,
    /\b(?:best before|best-by|use by|expiry|expiration date)\s*[:#-]?\s*[A-Z0-9][A-Z0-9 ,./_-]{2,30}\b/gi,
    /\b(?:model|item|product)\s*(?:number|no\.?|#)\s*[:#-]?\s*[A-Z0-9][A-Z0-9./_-]{2,}\b/gi,
    /\b(?:DIN|NPN)\s*[:#-]?\s*[0-9]{5,}\b/gi
  ];

  return uniqueNonEmpty(patterns.flatMap((pattern) => [...text.matchAll(pattern)].map((match) => match[0])));
}

function statusFor(raw: CanadaRecallRaw): string {
  const archived = asString(raw.Archived);
  if (archived === '1') {
    return 'Archived';
  }

  if (archived === '0') {
    return 'Active';
  }

  return '';
}

function descriptionFor(raw: CanadaRecallRaw, identifiers: string[]): string {
  return uniqueNonEmpty([
    `Published by: ${asString(raw.Organization)}`,
    `Category: ${asString(raw.Category)}`,
    `Product: ${asString(raw.Product)}`,
    `Issue: ${asString(raw.Issue)}`,
    identifiers.length ? `Identifiers: ${identifiers.join(', ')}` : '',
    asString(raw['What you should do'])
  ]).join(' ');
}

export function extractCanadaRecallRecords(payload: unknown): CanadaRecallRaw[] {
  if (Array.isArray(payload)) {
    return payload as CanadaRecallRaw[];
  }

  if (payload && typeof payload === 'object') {
    const maybeFile = payload as RawCanadaFile;
    if (Array.isArray(maybeFile.records)) {
      return maybeFile.records as CanadaRecallRaw[];
    }
  }

  return [];
}

export function compareCanadaRecallDateDescending(a: CanadaRecallRaw, b: CanadaRecallRaw): number {
  const dateDifference = normalizeDate(b['Last updated']).localeCompare(normalizeDate(a['Last updated']));
  if (dateDifference !== 0) {
    return dateDifference;
  }

  return asString(b.NID).localeCompare(asString(a.NID));
}

export function normalizeCanadaRecallRecords(records: CanadaRecallRaw[]): NormalizedRecall[] {
  return records
    .slice()
    .sort(compareCanadaRecallDateDescending)
    .map((raw) => {
      const sourceId = firstNonEmpty([raw.NID], slugify(firstNonEmpty([raw.Title], 'canada-recall')));
      const id = `ca-recalls-${sourceId}`;
      const title = truncateText(firstNonEmpty([raw.Title, raw.Product], 'Canada recall notice'), 160);
      const productName = firstNonEmpty([raw.Product, raw.Title], title);
      const brands = extractBrands(raw);
      const identifiers = extractIdentifierText(raw);
      const issue = firstNonEmpty([raw.Issue], 'Reason not listed.');
      const action = asString(raw['What you should do']);
      const category = firstNonEmpty([raw.Category, raw.Organization], 'Recall and safety alert');
      const recallDate = normalizeDate(raw['Last updated']);
      const sourceUrl = asString(raw.URL);
      const images = canadaImagesFromRawRecord(raw, `${title} recall product image`);
      const primaryImage = images[0];

      return {
        id,
        source: 'CA_RECALLS',
        sourceUrl,
        title,
        brandNames: brands,
        productNames: uniqueNonEmpty([productName, ...identifiers]),
        category,
        hazard: issue,
        remedy: action,
        recallDate,
        affectedUnits: '',
        description: descriptionFor(raw, identifiers),
        slug: slugify(`${title}-${id}`),
        classification: asString(raw['Recall class']),
        reason: issue,
        distributionPattern: '',
        productQuantity: '',
        recallNumber: sourceId,
        status: statusFor(raw),
        ...(images.length
          ? {
              images,
              primaryImageUrl: primaryImage.url,
              primaryImageThumbnailUrl: primaryImage.thumbnailUrl,
              primaryImageAlt: primaryImage.alt ?? primaryImage.caption
            }
          : {}),
        raw
      } satisfies NormalizedRecall;
    })
    .filter((record) => record.id && record.title && record.sourceUrl && record.recallDate);
}

export async function writeNormalizedCanadaRecalls(
  records: CanadaRecallRaw[],
  processedPath = defaultCanadaProcessedPath
): Promise<ProcessedRecallFile> {
  const normalizedRecords = normalizeCanadaRecallRecords(records);

  if (normalizedRecords.length === 0) {
    throw new Error('Canada Recalls normalization produced zero records; existing processed data was not overwritten.');
  }

  const output: ProcessedRecallFile = {
    generatedAt: new Date().toISOString(),
    source: 'CA_RECALLS',
    count: normalizedRecords.length,
    records: normalizedRecords
  };

  await writeJsonAtomic(processedPath, output);
  return output;
}

async function runNormalize(): Promise<void> {
  const rawText = await readFile(defaultRawCanadaRecallsPath, 'utf8');
  const rawPayload = JSON.parse(rawText) as unknown;
  const records = extractCanadaRecallRecords(rawPayload);

  if (records.length === 0) {
    throw new Error('No Canada raw records found; processed data was not overwritten.');
  }

  const output = await writeNormalizedCanadaRecalls(records);
  const mergedOutput = await mergeProcessedRecalls();
  const sample = output.records[0];

  console.log(
    JSON.stringify(
      {
        rawRecordsRead: records.length,
        normalizedRecordsSaved: output.count,
        processedPath: defaultCanadaProcessedPath,
        canonicalPath: canonicalProcessedPath,
        mergedRecordsSaved: mergedOutput.count,
        countsBySource: mergedOutput.countsBySource,
        sample: sample
          ? {
              id: sample.id,
              source: sample.source,
              sourceUrl: sample.sourceUrl,
              title: sample.title,
              brandNames: sample.brandNames,
              productNames: sample.productNames,
              category: sample.category,
              hazard: sample.hazard,
              remedy: sample.remedy,
              recallDate: sample.recallDate,
              description: sample.description,
              slug: sample.slug,
              classification: sample.classification,
              recallNumber: sample.recallNumber,
              status: sample.status,
              primaryImageUrl: sample.primaryImageUrl,
              primaryImageThumbnailUrl: sample.primaryImageThumbnailUrl,
              primaryImageAlt: sample.primaryImageAlt,
              images: sample.images?.length ?? 0
            }
          : null
      },
      null,
      2
    )
  );
}

if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replace(/\\/g, '/')}`).href) {
  runNormalize().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
