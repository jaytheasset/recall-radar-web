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

async function readProcessedRappelConsoRecords(): Promise<NormalizedRecall[]> {
  const text = await readFile(processedPath, 'utf8');
  const payload = JSON.parse(text) as ProcessedRecallFile;
  return Array.isArray(payload.records)
    ? payload.records.filter((record) => record.source === 'FR_RAPPELCONSO')
    : [];
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

async function runAudit(): Promise<void> {
  const records = await readProcessedRappelConsoRecords();
  if (records.length === 0) {
    throw new Error(`No FR_RAPPELCONSO records found in ${processedPath}`);
  }

  console.log(JSON.stringify(audit(records), null, 2));
}

runAudit().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
