import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NormalizedRecall, ProcessedRecallFile } from '../src/data/recall-types.ts';
import { RECALL_TAXONOMY_VERSION, type RecallClassificationV2 } from '../src/data/recall-taxonomy-v2.ts';
import { isKnownBrandName, normalizeBrandName } from '../src/lib/brand-normalize.ts';
import { recallSlug } from '../src/lib/slug.ts';
import { normalizeCanadaRecallRecords, type CanadaRecallRaw } from './normalize-canada-recalls.ts';
import { readLocalJson, writeLocalJson } from './refresh-local-recall-inputs.ts';
import { validateClassificationOutput } from './validate-recall-classification-output.ts';

type ClassificationRow = {
  recordId: string;
  source: NormalizedRecall['source'];
  success: boolean;
  failed: boolean;
  qualityFlags?: string[];
  classification: RecallClassificationV2;
};

type LocalSnapshot = {
  generatedAt: string;
  candidates: number;
  classified: number;
  remaining: number;
  sourceWarnings: unknown[];
  records: Array<{ recall: NormalizedRecall; result: ClassificationRow }>;
};

const root = fileURLToPath(new URL('..', import.meta.url));
const localDir = join(root, 'outputs', 'llm-classifier', 'local');
const processedDir = join(root, 'data', 'processed');
const recallsPath = join(processedDir, 'recalls.json');
const classificationsPath = join(processedDir, 'recall-classifications-v2.json');

function siteSlug(record: NormalizedRecall, hidePlaceholders: boolean): string {
  const brandNames = hidePlaceholders ? record.brandNames.filter(isKnownBrandName) : record.brandNames;
  return recallSlug(record.title, record.id, {
    productNames: record.productNames,
    brandNames: brandNames.map((brand) => normalizeBrandName(brand).displayName)
  });
}

function correctVerifiedCpscHazard(record: NormalizedRecall): NormalizedRecall {
  const officialUrl = 'https://www.cpsc.gov/Recalls/2027/BAMAMON-Recalls-LED-Projecting-Finger-Light-Toys-Due-to-Risk-of-Serious-Injury-or-Death-from-Battery-Ingestion-Violate-Mandatory-Standard-for-Toys';
  if (record.id !== 'cpsc-27042' || record.sourceUrl !== officialUrl || !/^none reported\.?$/i.test(record.hazard)) {
    return record;
  }
  return { ...record, hazard: 'Children can access and swallow the finger lights’ button cell batteries, which can cause severe internal burns or death.' };
}

const [snapshot, previous, canada] = await Promise.all([
  readLocalJson<LocalSnapshot>(join(localDir, 'current.json')),
  readLocalJson<ProcessedRecallFile>(recallsPath),
  readLocalJson<{ records: NormalizedRecall[] }>(join(localDir, 'release-canada-official-details.json'))
]);
if (!snapshot || !previous || !Number.isFinite(Date.parse(snapshot.generatedAt)) ||
    snapshot.generatedAt < previous.generatedAt || snapshot.sourceWarnings.length || snapshot.remaining ||
    snapshot.records.length !== snapshot.classified || snapshot.records.length !== snapshot.candidates) {
  throw new Error('A complete local enrichment snapshot at least as recent as the site snapshot is required.');
}

const previousById = new Map(previous.records.map((row) => [row.id, row]));
const canadaDetails = canada ? normalizeCanadaRecallRecords(canada.records.map((row) => row.raw as CanadaRecallRaw)) : [];
const canadaById = new Map(canadaDetails.map((row) => [row.id, row]));
const sourceCounts: NonNullable<ProcessedRecallFile['countsBySource']> = {};
const qualityFlagCounts: Record<string, number> = {};
const ids = new Set<string>();
const routes = new Set<string>();
const models = new Set<string>();
const prompts = new Set<string>();
const records: NormalizedRecall[] = [];
const classifications: ClassificationRow[] = [];
let canadianDetailsUsed = 0;

for (const { recall, result } of snapshot.records) {
  const prior = previousById.get(recall.id);
  if (!recall.id || !recall.title.trim() || ids.has(recall.id) || result.recordId !== recall.id ||
      result.source !== recall.source || (prior && prior.source !== recall.source) ||
      !result.success || result.failed || !validateClassificationOutput(result.classification).ok) {
    throw new Error(`Invalid recall or classification for ${recall.id}.`);
  }
  if (!/^https?:$/.test(new URL(recall.sourceUrl).protocol)) {
    throw new Error(`Invalid official URL for ${recall.id}.`);
  }
  ids.add(recall.id);
  const detail = canadaById.get(recall.id);
  const useCanadaDetail = detail?.source === 'CA_RECALLS' && detail.sourceUrl === recall.sourceUrl &&
    detail.recallDate === recall.recallDate;
  if (useCanadaDetail) canadianDetailsUsed += 1;
  const enriched = correctVerifiedCpscHazard(useCanadaDetail ? detail : recall);
  const priorSlug = prior && (prior.siteSlug ?? siteSlug(prior, false));
  const correctedTitle = enriched.id === 'cpsc-26577' && /Shield Line Recalls MedPride/i.test(enriched.title);
  const slug = correctedTitle || !priorSlug ? siteSlug(enriched, true) : priorSlug;
  const aliases = [...new Set([...(prior?.previousSiteSlugs ?? []), ...(priorSlug ? [priorSlug] : [])])]
    .filter((alias) => alias !== slug);
  for (const route of [slug, ...aliases]) {
    if (!route || routes.has(route)) throw new Error(`Duplicate or empty recall path for ${recall.id}: ${route}.`);
    routes.add(route);
  }
  records.push({ ...enriched, siteSlug: slug, previousSiteSlugs: aliases.length ? aliases : undefined });
  classifications.push(result);
  sourceCounts[recall.source] = (sourceCounts[recall.source] ?? 0) + 1;
  if (result.classification.model) models.add(result.classification.model);
  if (result.classification.promptVersion) prompts.add(result.classification.promptVersion);
  for (const flag of result.qualityFlags ?? []) {
    qualityFlagCounts[flag] = (qualityFlagCounts[flag] ?? 0) + 1;
  }
}

for (const id of previousById.keys()) {
  if (!ids.has(id)) throw new Error(`Refusing to drop an existing recall: ${id}.`);
}
const processed: ProcessedRecallFile = {
  generatedAt: snapshot.generatedAt,
  source: 'MULTI',
  count: records.length,
  countsBySource: sourceCounts,
  records
};
const providers = new Set([...models].map((model) => model.startsWith('gpt-') ? 'codex' : model.startsWith('gemini-') ? 'gemini' : 'unknown'));
await writeLocalJson(recallsPath, processed);
await writeLocalJson(classificationsPath, {
  generatedAt: snapshot.generatedAt,
  provider: providers.size > 1 ? 'mixed' : [...providers][0] ?? 'unknown',
  model: [...models].sort().join(' + '),
  promptVersion: [...prompts].sort().join(' + '),
  taxonomyVersion: RECALL_TAXONOMY_VERSION,
  totalRecords: records.length,
  success: classifications.length,
  failed: 0,
  sourceCounts,
  qualityFlagCounts,
  records: classifications
});
console.log(JSON.stringify({ generatedAt: snapshot.generatedAt, total: records.length, sourceCounts, canadianDetailsUsed }));
