import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NormalizedRecall, ProcessedRecallFile } from '../src/data/recall-types.ts';

type AuditIssue = {
  id: string;
  title: string;
  detail?: string;
};

type AuditSummary = {
  source: 'FR_RAPPELCONSO';
  total: number;
  duplicateIds: AuditIssue[];
  missing: Record<string, number>;
  rawCategoryDistribution: Record<string, number>;
  siteCategoryDistribution: Record<string, number>;
  recordsWithImages: number;
  recordsWithGtinOrBarcodeLikeValues: number;
  recordsWithLotBatchCodeOrDateLikeValues: number;
  recordsWithDistributionDetails: number;
  recordsWithOfficialNoticeUrlShape: number;
  veryLongTitles: AuditIssue[];
  slugCollisions: AuditIssue[];
  suspiciousCategoryMappings: AuditIssue[];
};

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const processedPath = resolve(projectRoot, 'data/processed/rappelconso-recalls.json');
const canonicalProcessedPath = resolve(projectRoot, 'data/processed/recalls.json');
const runtimeEnv = (process as typeof process & { env?: Record<string, string | undefined> }).env ?? {};

type SourceCounts = {
  total: number;
  CPSC: number;
  FDA: number;
  FR_RAPPELCONSO: number;
  CA_RECALLS: number;
  EU_SAFETY_GATE: number;
  UK_FSA: number;
  AU_PRODUCT_SAFETY: number;
  NZ_PRODUCT_SAFETY: number;
};

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function increment(map: Record<string, number>, key: string): void {
  map[key] = (map[key] ?? 0) + 1;
}

function hasAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}

function compactIssue(record: NormalizedRecall, detail?: string): AuditIssue {
  return {
    id: record.id,
    title: record.title,
    ...(detail ? { detail } : {})
  };
}

function classifyFrenchRecall(record: NormalizedRecall): string {
  const rawCategory = normalize(record.category);
  const text = normalize(
    [
      record.title,
      record.category,
      record.description,
      record.hazard,
      record.remedy,
      ...record.productNames,
      ...record.brandNames
    ].join(' ')
  );

  // Keep French mapping conservative. Do not let English fragments inside French words drive categories.
  if (rawCategory.includes('automobiles') || rawCategory.includes('moyens de deplacement')) {
    return 'general-consumer-product';
  }

  if (rawCategory.includes('appareils electriques')) {
    return 'household-appliance';
  }

  if (hasAny(text, ['alimentation', 'allergene', 'lait', 'arachide', 'noisette', 'sesame'])) {
    return 'food-allergy';
  }

  if (hasAny(text, ['bebe', 'bebes', 'enfant', 'enfants', 'jouet', 'jouets', 'puericulture'])) {
    return 'baby-kids';
  }

  if (hasAny(text, ['batterie', 'batteries', 'chargeur', 'chargeurs', 'electronique'])) {
    return 'battery-electronics';
  }

  if (
    hasAny(text, [
      'appareils electriques',
      'cuiseur',
      'vapeur',
      'maison',
      'habitat',
      'electromenager',
      'meuble',
      'chauffage'
    ])
  ) {
    return 'household-appliance';
  }

  return 'general-consumer-product';
}

function hasGtinOrBarcodeLikeValue(record: NormalizedRecall): boolean {
  return /\b\d{8,14}\b/.test([record.title, record.description, ...record.productNames].join(' '));
}

function hasLotBatchCodeOrDateLikeValue(record: NormalizedRecall): boolean {
  return /\b(lot|batch|code|date|durabilit|consommation|limite|ddm|dlc)\b/i.test(
    [record.title, record.description, record.affectedUnits, ...record.productNames].join(' ')
  );
}

function looksLikeOfficialNoticeUrl(value: string): boolean {
  return /^https:\/\/rappel\.conso\.gouv\.fr\/fiche-rappel\/\d+\/(?:interne|rapex)$/i.test(value);
}

function countMissing(records: NormalizedRecall[], test: (record: NormalizedRecall) => boolean): number {
  return records.filter(test).length;
}

function expectedNumber(name: string, fallback: number): number {
  const parsed = Number.parseInt(runtimeEnv[name] ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function readProcessedRappelConsoRecords(): Promise<NormalizedRecall[]> {
  const text = await readFile(processedPath, 'utf8');
  const payload = JSON.parse(text) as ProcessedRecallFile;
  return Array.isArray(payload.records)
    ? payload.records.filter((record) => record.source === 'FR_RAPPELCONSO')
    : [];
}

async function readCanonicalCounts(): Promise<SourceCounts> {
  const text = await readFile(canonicalProcessedPath, 'utf8');
  const payload = JSON.parse(text) as ProcessedRecallFile;
  const records = Array.isArray(payload.records) ? payload.records : [];

  return {
    total: records.length,
    CPSC: records.filter((record) => record.source === 'CPSC').length,
    FDA: records.filter((record) => record.source === 'FDA').length,
    FR_RAPPELCONSO: records.filter((record) => record.source === 'FR_RAPPELCONSO').length,
    CA_RECALLS: records.filter((record) => record.source === 'CA_RECALLS').length,
    EU_SAFETY_GATE: records.filter((record) => record.source === 'EU_SAFETY_GATE').length,
    UK_FSA: records.filter((record) => record.source === 'UK_FSA').length,
    AU_PRODUCT_SAFETY: records.filter((record) => record.source === 'AU_PRODUCT_SAFETY').length,
    NZ_PRODUCT_SAFETY: records.filter((record) => record.source === 'NZ_PRODUCT_SAFETY').length
  };
}

function audit(records: NormalizedRecall[]): AuditSummary {
  const idCounts = new Map<string, number>();
  const slugCounts = new Map<string, number>();
  const rawCategoryDistribution: Record<string, number> = {};
  const siteCategoryDistribution: Record<string, number> = {};

  for (const record of records) {
    idCounts.set(record.id, (idCounts.get(record.id) ?? 0) + 1);
    slugCounts.set(record.slug, (slugCounts.get(record.slug) ?? 0) + 1);
    increment(rawCategoryDistribution, record.category || '(missing)');
    increment(siteCategoryDistribution, classifyFrenchRecall(record));
  }

  const duplicateIds = records
    .filter((record) => (idCounts.get(record.id) ?? 0) > 1)
    .map((record) => compactIssue(record));
  const slugCollisions = records
    .filter((record) => (slugCounts.get(record.slug) ?? 0) > 1)
    .map((record) => compactIssue(record, record.slug));
  const suspiciousCategoryMappings = records
    .map((record) => ({ record, siteCategory: classifyFrenchRecall(record) }))
    .filter(({ record, siteCategory }) => {
      const rawCategory = normalize(record.category);
      const fullText = normalize(
        [
          record.title,
          record.description,
          record.hazard,
          record.reason ?? '',
          ...record.productNames,
          ...record.brandNames
        ].join(' ')
      );
      if (siteCategory === 'baby-kids') {
        return !hasAny(rawCategory, ['bebe', 'bebes', 'enfant', 'enfants']) && !hasAny(fullText, ['kids', 'enfant', 'enfants', 'jouet']);
      }

      if (siteCategory === 'battery-electronics') {
        return !hasAny(rawCategory, ['electrique', 'electronique']) && !hasAny(fullText, ['batterie', 'chargeur', 'electronique']);
      }

      if (siteCategory === 'food-allergy') {
        return !hasAny(rawCategory, ['alimentation']) && !hasAny(fullText, ['allergene', 'lait', 'arachide', 'noisette', 'sesame']);
      }

      return false;
    })
    .map(({ record, siteCategory }) => compactIssue(record, `${record.category} -> ${siteCategory}`));

  return {
    source: 'FR_RAPPELCONSO',
    total: records.length,
    duplicateIds,
    missing: {
      sourceUrl: countMissing(records, (record) => !record.sourceUrl),
      title: countMissing(records, (record) => !record.title),
      recallDate: countMissing(records, (record) => !record.recallDate),
      productNames: countMissing(records, (record) => record.productNames.length === 0),
      brandNames: countMissing(records, (record) => record.brandNames.length === 0),
      hazardOrReason: countMissing(records, (record) => !record.hazard && !record.reason),
      remedyOrAction: countMissing(records, (record) => !record.remedy),
      rawPayload: countMissing(records, (record) => !record.raw)
    },
    rawCategoryDistribution,
    siteCategoryDistribution,
    recordsWithImages: records.filter((record) => (record.images?.length ?? 0) > 0).length,
    recordsWithGtinOrBarcodeLikeValues: records.filter(hasGtinOrBarcodeLikeValue).length,
    recordsWithLotBatchCodeOrDateLikeValues: records.filter(hasLotBatchCodeOrDateLikeValue).length,
    recordsWithDistributionDetails: records.filter((record) => Boolean(record.distributionPattern)).length,
    recordsWithOfficialNoticeUrlShape: records.filter((record) => looksLikeOfficialNoticeUrl(record.sourceUrl)).length,
    veryLongTitles: records.filter((record) => record.title.length > 120).map((record) => compactIssue(record, `${record.title.length} chars`)),
    slugCollisions,
    suspiciousCategoryMappings
  };
}

function buildBlockers(summary: AuditSummary, canonicalCounts: SourceCounts): string[] {
  const expectedCounts: SourceCounts = {
    total: expectedNumber('EXPECTED_TOTAL_RECALL_COUNT', 1001),
    CPSC: expectedNumber('EXPECTED_CPSC_COUNT', 301),
    FDA: expectedNumber('EXPECTED_FDA_COUNT', 100),
    FR_RAPPELCONSO: expectedNumber('EXPECTED_RAPPELCONSO_COUNT', 100),
    CA_RECALLS: expectedNumber('EXPECTED_CANADA_RECALLS_COUNT', 100),
    EU_SAFETY_GATE: expectedNumber('EXPECTED_EU_SAFETY_GATE_COUNT', 100),
    UK_FSA: expectedNumber('EXPECTED_UK_FSA_COUNT', 100),
    AU_PRODUCT_SAFETY: expectedNumber('EXPECTED_AU_PRODUCT_SAFETY_COUNT', 100),
    NZ_PRODUCT_SAFETY: expectedNumber('EXPECTED_NZ_PRODUCT_SAFETY_COUNT', 100)
  };
  const blockers = [
    summary.total === 0 ? 'FR_RAPPELCONSO count is 0.' : '',
    summary.total !== expectedCounts.FR_RAPPELCONSO
      ? `FR_RAPPELCONSO count ${summary.total} does not match expected ${expectedCounts.FR_RAPPELCONSO}.`
      : '',
    canonicalCounts.total !== expectedCounts.total
      ? `Total processed count ${canonicalCounts.total} does not match expected ${expectedCounts.total}.`
      : '',
    canonicalCounts.CPSC !== expectedCounts.CPSC
      ? `CPSC count ${canonicalCounts.CPSC} does not match expected ${expectedCounts.CPSC}.`
      : '',
    canonicalCounts.FDA !== expectedCounts.FDA
      ? `FDA count ${canonicalCounts.FDA} does not match expected ${expectedCounts.FDA}.`
      : '',
    canonicalCounts.FR_RAPPELCONSO !== expectedCounts.FR_RAPPELCONSO
      ? `Canonical FR_RAPPELCONSO count ${canonicalCounts.FR_RAPPELCONSO} does not match expected ${expectedCounts.FR_RAPPELCONSO}.`
      : '',
    canonicalCounts.CA_RECALLS !== expectedCounts.CA_RECALLS
      ? `Canonical CA_RECALLS count ${canonicalCounts.CA_RECALLS} does not match expected ${expectedCounts.CA_RECALLS}.`
      : '',
    canonicalCounts.EU_SAFETY_GATE !== expectedCounts.EU_SAFETY_GATE
      ? `EU_SAFETY_GATE count ${canonicalCounts.EU_SAFETY_GATE} does not match expected ${expectedCounts.EU_SAFETY_GATE}.`
      : '',
    canonicalCounts.UK_FSA !== expectedCounts.UK_FSA
      ? `UK_FSA count ${canonicalCounts.UK_FSA} does not match expected ${expectedCounts.UK_FSA}.`
      : '',
    canonicalCounts.AU_PRODUCT_SAFETY !== expectedCounts.AU_PRODUCT_SAFETY
      ? `AU_PRODUCT_SAFETY count ${canonicalCounts.AU_PRODUCT_SAFETY} does not match expected ${expectedCounts.AU_PRODUCT_SAFETY}.`
      : '',
    canonicalCounts.NZ_PRODUCT_SAFETY !== expectedCounts.NZ_PRODUCT_SAFETY
      ? `NZ_PRODUCT_SAFETY count ${canonicalCounts.NZ_PRODUCT_SAFETY} does not match expected ${expectedCounts.NZ_PRODUCT_SAFETY}.`
      : '',
    summary.duplicateIds.length > 0 ? `Duplicate ids found: ${summary.duplicateIds.length}.` : '',
    summary.slugCollisions.length > 0 ? `Slug collisions found: ${summary.slugCollisions.length}.` : '',
    summary.suspiciousCategoryMappings.length > 0
      ? `Suspicious category mappings found: ${summary.suspiciousCategoryMappings.length}.`
      : '',
    summary.missing.sourceUrl > 0 ? `Missing source URLs found: ${summary.missing.sourceUrl}.` : '',
    summary.missing.title > 0 ? `Missing titles found: ${summary.missing.title}.` : '',
    summary.missing.recallDate > 0 ? `Missing recall dates found: ${summary.missing.recallDate}.` : '',
    summary.recordsWithOfficialNoticeUrlShape !== summary.total
      ? `Official RappelConso URL shape mismatch count: ${
          summary.total - summary.recordsWithOfficialNoticeUrlShape
        }.`
      : ''
  ].filter(Boolean);

  return blockers;
}

async function runAudit(): Promise<void> {
  const records = await readProcessedRappelConsoRecords();
  if (records.length === 0) {
    throw new Error(`No FR_RAPPELCONSO records found in ${processedPath}`);
  }

  const summary = audit(records);
  const canonicalCounts = await readCanonicalCounts();
  const blockers = buildBlockers(summary, canonicalCounts);
  const passed = blockers.length === 0;

  console.log(
    JSON.stringify(
      {
        passed,
        blockers,
        operationalSummary: {
          source: summary.source,
          totalProcessedCount: canonicalCounts.total,
          countsBySource: {
            CPSC: canonicalCounts.CPSC,
            FDA: canonicalCounts.FDA,
            FR_RAPPELCONSO: canonicalCounts.FR_RAPPELCONSO,
            CA_RECALLS: canonicalCounts.CA_RECALLS,
            EU_SAFETY_GATE: canonicalCounts.EU_SAFETY_GATE,
            UK_FSA: canonicalCounts.UK_FSA,
            AU_PRODUCT_SAFETY: canonicalCounts.AU_PRODUCT_SAFETY,
            NZ_PRODUCT_SAFETY: canonicalCounts.NZ_PRODUCT_SAFETY
          },
          duplicateIds: summary.duplicateIds.length,
          slugCollisions: summary.slugCollisions.length,
          suspiciousCategoryMappings: summary.suspiciousCategoryMappings.length,
          recordsWithImages: summary.recordsWithImages,
          recordsWithGtinOrBarcodeLikeValues: summary.recordsWithGtinOrBarcodeLikeValues,
          recordsWithLotBatchCodeOrDateLikeValues: summary.recordsWithLotBatchCodeOrDateLikeValues,
          recordsWithDistributionDetails: summary.recordsWithDistributionDetails,
          recordsWithOfficialNoticeUrlShape: summary.recordsWithOfficialNoticeUrlShape
        },
        detail: summary
      },
      null,
      2
    )
  );

  if (!passed) {
    process.exitCode = 1;
  }
}

runAudit().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
