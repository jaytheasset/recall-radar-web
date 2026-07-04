import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NormalizedRecall, ProcessedRecallFile } from '../src/data/recall-types.ts';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const processedRecallsPath = resolve(projectRoot, 'data/processed/recalls.json');

export type RecallClassifierInput = {
  id: string;
  source: string;
  title: string;
  productNames: string[];
  brandNames: string[];
  legacyCategory: string;
  rawSourceCategory: string;
  hazard: string;
  remedy: string;
  description: string;
  sourceUrl: string;
  recallDate: string;
  identifiers: string[];
};

export type ClassifierInputEstimate = {
  inputCharacters: number;
  estimatedInputTokens: number;
};

const fieldLimits = {
  title: 300,
  description: 800,
  hazard: 500,
  remedy: 500,
  rawSourceCategory: 300,
  identifier: 160,
  listItem: 180
} as const;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function safeText(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function trimField(value: unknown, limit: number): string {
  const normalized = safeText(value);
  if (normalized.length <= limit) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, limit - 1)).trimEnd()}...`;
}

function trimList(values: string[], limit: number, itemLimit: number = fieldLimits.listItem): string[] {
  return [...new Set(values.map((value) => trimField(value, itemLimit)).filter(Boolean))].slice(0, limit);
}

function rawTextArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => {
    if (typeof item === 'string') {
      return safeText(item);
    }
    if (isObject(item)) {
      return safeText(item.Name) || safeText(item.name) || safeText(item.Value) || safeText(item.value);
    }
    return '';
  }).filter(Boolean);
}

function identifierCandidates(record: NormalizedRecall): string[] {
  const raw = isObject(record.raw) ? record.raw : {};
  const fields = [
    record.recallNumber,
    record.affectedUnits,
    record.productQuantity,
    record.distributionPattern,
    record.status,
    ...record.productNames,
    ...rawTextArray(raw.Models),
    ...rawTextArray(raw.ModelNumbers),
    ...rawTextArray(raw.UPCs),
    ...rawTextArray(raw.Products),
    ...rawTextArray(raw.Inconjunctions)
  ].filter((value): value is string => typeof value === 'string');

  const identifierPattern =
    /\b(?:UPC|GTIN|EAN|SKU|model|model no\.?|item|item no\.?|lot|batch|serial|recall number|reference|best before|use by|date marking)[:#]?\s*[-A-Za-z0-9/., ]{2,80}/gi;
  const sourceText = [
    record.title,
    record.description,
    record.hazard,
    record.remedy,
    record.affectedUnits,
    record.productQuantity,
    record.distributionPattern
  ].join(' ');
  const matches = sourceText.match(identifierPattern) ?? [];

  return trimList([...fields, ...matches], 12, fieldLimits.identifier);
}

export function buildRecallClassifierInput(record: NormalizedRecall): RecallClassifierInput {
  return {
    id: record.id,
    source: record.source,
    title: trimField(record.title, fieldLimits.title),
    productNames: trimList(record.productNames, 8),
    brandNames: trimList(record.brandNames, 6),
    legacyCategory: trimField(record.category, fieldLimits.rawSourceCategory),
    rawSourceCategory: trimField(record.category, fieldLimits.rawSourceCategory),
    hazard: trimField(record.hazard || record.reason || '', fieldLimits.hazard),
    remedy: trimField(record.remedy, fieldLimits.remedy),
    description: trimField(record.description, fieldLimits.description),
    sourceUrl: record.sourceUrl,
    recallDate: record.recallDate,
    identifiers: identifierCandidates(record)
  };
}

export function estimateTokensFromText(value: string): number {
  return Math.ceil(value.length / 4);
}

export function estimateClassifierInput(input: RecallClassifierInput, promptText = ''): ClassifierInputEstimate {
  const serialized = `${promptText}\n${JSON.stringify(input)}`;
  return {
    inputCharacters: serialized.length,
    estimatedInputTokens: estimateTokensFromText(serialized)
  };
}

export async function readProcessedRecalls(): Promise<NormalizedRecall[]> {
  const file = JSON.parse(await readFile(processedRecallsPath, 'utf8')) as ProcessedRecallFile;
  return Array.isArray(file.records) ? file.records : [];
}

if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replace(/\\/g, '/')}`).href) {
  const records = await readProcessedRecalls();
  const first = records[0] ? buildRecallClassifierInput(records[0]) : null;
  console.log(JSON.stringify({ count: records.length, first }, null, 2));
}
