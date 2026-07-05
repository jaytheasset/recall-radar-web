import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NormalizedRecall } from '../src/data/recall-types.ts';
import {
  buildRecallClassifierInput,
  estimateTokensFromText,
  readProcessedRecalls,
  type RecallClassifierInput
} from './build-recall-classifier-input.ts';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const outputDir = 'outputs/llm-classifier/input-preview/rappelconso';
const absoluteOutputDir = resolve(projectRoot, outputDir);
const defaultLimit = 20;

const fallbackStrings = [
  'Reason not listed.',
  'RappelConso product',
  'Review the official notice',
  'See official notice',
  'Not listed',
  'Unknown',
  'N/A'
] as const;

const sampleSearchGroups = [
  ['alimentation'],
  ['allergene'],
  ['automobiles'],
  ['moyens de deplacement'],
  ['bebe'],
  ['enfant'],
  ['jouet'],
  ['appareils electriques'],
  ['batterie'],
  ['gtin'],
  ['lot'],
  ['date de durabilite minimale'],
  ['ddm'],
  ['dlc']
] as const;

type RappelConsoRaw = {
  id?: unknown;
  numero_fiche?: unknown;
  numero_version?: unknown;
  rappel_guid?: unknown;
  date_publication?: unknown;
  nature_juridique_rappel?: unknown;
  categorie_produit?: unknown;
  sous_categorie_produit?: unknown;
  marque_produit?: unknown;
  modeles_ou_references?: unknown;
  identification_produits?: unknown;
  conditionnements?: unknown;
  date_debut_commercialisation?: unknown;
  date_date_fin_commercialisation?: unknown;
  zone_geographique_de_vente?: unknown;
  distributeurs?: unknown;
  motif_rappel?: unknown;
  risques_encourus?: unknown;
  preconisations_sanitaires?: unknown;
  description_complementaire_risque?: unknown;
  conduites_a_tenir_par_le_consommateur?: unknown;
  modalites_de_compensation?: unknown;
  date_de_fin_de_la_procedure_de_rappel?: unknown;
  informations_complementaires?: unknown;
  informations_complementaires_publiques?: unknown;
  liens_vers_les_images?: unknown;
  lien_vers_la_fiche_rappel?: unknown;
  lien_vers_affichette_pdf?: unknown;
  libelle?: unknown;
};

type SourceHints = {
  source: 'FR_RAPPELCONSO';
  market: 'France';
  sourceLanguage: 'fr';
  officialSource: 'RappelConso';
  classificationOwner: 'llm';
};

type RappelConsoClassifierInputPreview = {
  id: string;
  source: 'FR_RAPPELCONSO';
  sourceUrl: string;
  recallDate: string;
  title: string;
  sourceLanguage: 'fr';
  sourceCategory?: string;
  sourceSubcategory?: string;
  sourceRecallNature?: string;
  productNames: string[];
  brandNames: string[];
  modelReferenceText?: string;
  productIdentificationText?: string;
  packagingText?: string;
  riskText?: string;
  reasonText?: string;
  actionText?: string;
  compensationText?: string;
  distributionText?: string;
  commercializationDates?: {
    start?: string;
    end?: string;
  };
  recallNumber?: string;
  identifiers: string[];
  sourceHints: SourceHints;
};

type TokenComparison = {
  id: string;
  title: string;
  sourceCategory: string;
  genericCharacters: number;
  proposedCharacters: number;
  genericEstimatedTokens: number;
  proposedEstimatedTokens: number;
  tokenReductionPercent: number;
};

type NoiseFinding = {
  id: string;
  title: string;
  flags: string[];
  genericCharacters: number;
  proposedCharacters: number;
  genericEstimatedTokens: number;
  proposedEstimatedTokens: number;
  tokenReductionPercent: number;
  repeatedStrings: string[];
  overlyLongFields: string[];
  fallbackGeneratedStrings: string[];
  possibleBoilerplate: string[];
  emptyCriticalFields: string[];
  identifierCount: number;
  proposedStillNoisy: boolean;
};

type PreviewRecord = {
  id: string;
  title: string;
  sourceCategory: string;
  genericInput: RecallClassifierInput;
  proposedInput: RappelConsoClassifierInputPreview;
  tokenComparison: TokenComparison;
  noise: NoiseFinding;
  sampleReasons: string[];
};

type PreviewPayload = {
  generatedAt: string;
  source: 'FR_RAPPELCONSO';
  totalRappelConsoRecords: number;
  sampleCount: number;
  requestedLimit: number;
  foodCaseIncluded: boolean;
  vehicleCaseIncluded: boolean;
  babyKidsCaseIncluded: boolean;
  electronicsCaseIncluded: boolean;
  identifierCaseIncluded: boolean;
  outputDir: string;
  notes: string[];
  records: PreviewRecord[];
};

function envLimit(): number {
  const rawValue = (process as unknown as { env?: Record<string, string | undefined> }).env?.RAPPELCONSO_CLASSIFIER_INPUT_PREVIEW_LIMIT;
  const parsed = Number.parseInt(rawValue ?? '', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return defaultLimit;
  }

  return Math.max(1, Math.min(parsed, 100));
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function stripHtml(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#039;/gi, "'")
    .replace(/&#39;/gi, "'");
}

function normalizeForCompare(value: string): string {
  return normalizeWhitespace(stripHtml(value))
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function isFallbackString(value: string): boolean {
  const normalized = normalizeForCompare(value);
  return fallbackStrings.some((fallback) => normalizeForCompare(fallback) === normalized);
}

function trimAtWordBoundary(value: string, limit: number): string {
  const text = normalizeWhitespace(stripHtml(value));
  if (!text || isFallbackString(text)) {
    return '';
  }
  if (text.length <= limit) {
    return text;
  }

  const slice = text.slice(0, limit + 1);
  const lastSpace = slice.lastIndexOf(' ');
  const trimmed = slice.slice(0, lastSpace > limit * 0.65 ? lastSpace : limit).trim();
  return `${trimmed}...`;
}

function cleanText(value: unknown, limit: number): string {
  return typeof value === 'string' || typeof value === 'number' ? trimAtWordBoundary(String(value), limit) : '';
}

function splitMultiValue(value: unknown): string[] {
  if (Array.isArray(value)) {
    return uniqueCleanList(value.flatMap((item) => splitMultiValue(item)), 60, 220);
  }

  const text = cleanText(value, 1200);
  if (!text) {
    return [];
  }

  return uniqueCleanList(text.split(/[|\n;]/), 60, 220);
}

function uniqueCleanList(values: unknown[], limit: number, itemLimit = 180): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const value of values) {
    const text = cleanText(value, itemLimit);
    const key = normalizeForCompare(text);
    if (!text || !key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    output.push(text);
    if (output.length >= limit) {
      break;
    }
  }

  return output;
}

function rawPayload(record: NormalizedRecall): RappelConsoRaw {
  return isObject(record.raw) ? (record.raw as RappelConsoRaw) : {};
}

function joinFields(values: unknown[], limit: number): string {
  return trimAtWordBoundary(
    uniqueCleanList(values.flatMap((value) => splitMultiValue(value)), 20, 320).join('; '),
    limit
  );
}

function isLikelyIdentifier(value: string): boolean {
  const normalized = normalizeForCompare(value);
  return (
    /\b\d{8,14}\b/.test(value) ||
    /\b(?:gtin|ean|upc|udi|lot|batch|code|reference|ref|modele|model|ddm|dlc|date de durabilite minimale|date limite de consommation)\b/.test(normalized) ||
    /\b20\d{2}-\d{2}-\d{2}\b/.test(value)
  );
}

function identifierCandidates(record: NormalizedRecall): string[] {
  const raw = rawPayload(record);
  const sourceValues = uniqueCleanList(
    [
      raw.numero_fiche,
      raw.rappel_guid,
      raw.id,
      ...splitMultiValue(raw.identification_produits),
      raw.conditionnements,
      record.recallNumber,
      record.affectedUnits,
      record.productQuantity
    ],
    40,
    220
  );
  const sourceText = [
    record.title,
    raw.identification_produits,
    raw.modeles_ou_references,
    raw.conditionnements
  ].flatMap((value) => splitMultiValue(value)).join(' ');
  const matches = [
    ...(sourceText.match(/\b\d{8,14}\b/g) ?? []),
    ...(sourceText.match(/\b(?:lot|lots?|batch|code|réf\.?|ref\.?|référence|reference|ddm|dlc)[:#\s-]*[-A-Za-z0-9À-ÿ/.,]{2,40}/gi) ?? []),
    ...(sourceText.match(/\b20\d{2}-\d{2}-\d{2}\b/g) ?? [])
  ];

  return uniqueCleanList([...sourceValues, ...matches].filter((value) => isLikelyIdentifier(String(value))), 20, 180);
}

function productNames(record: NormalizedRecall): string[] {
  const raw = rawPayload(record);
  const rawProducts = [raw.libelle];
  if (!cleanText(raw.libelle, 220)) {
    rawProducts.push(...record.productNames.filter((name) => !isLikelyIdentifier(name)));
  }

  return uniqueCleanList(rawProducts, 8, 220);
}

function brandNames(record: NormalizedRecall): string[] {
  const raw = rawPayload(record);
  return uniqueCleanList([raw.marque_produit, ...record.brandNames], 6, 160);
}

function buildRappelConsoClassifierInputPreview(record: NormalizedRecall): RappelConsoClassifierInputPreview {
  const raw = rawPayload(record);
  const identifiers = identifierCandidates(record);
  const start = cleanText(raw.date_debut_commercialisation, 60);
  const end = cleanText(raw.date_date_fin_commercialisation, 60);
  const commercializationDates = start || end ? { ...(start ? { start } : {}), ...(end ? { end } : {}) } : undefined;
  const sourceCategory = cleanText(raw.categorie_produit, 180) || cleanText(record.category, 180);
  const sourceSubcategory = cleanText(raw.sous_categorie_produit, 180);

  return {
    id: record.id,
    source: 'FR_RAPPELCONSO',
    sourceUrl: record.sourceUrl,
    recallDate: record.recallDate,
    title: cleanText(record.title, 260),
    sourceLanguage: 'fr',
    ...(sourceCategory ? { sourceCategory } : {}),
    ...(sourceSubcategory ? { sourceSubcategory } : {}),
    ...(cleanText(raw.nature_juridique_rappel, 180) ? { sourceRecallNature: cleanText(raw.nature_juridique_rappel, 180) } : {}),
    productNames: productNames(record),
    brandNames: brandNames(record),
    ...(cleanText(raw.modeles_ou_references, 320) ? { modelReferenceText: cleanText(raw.modeles_ou_references, 320) } : {}),
    ...(joinFields([raw.identification_produits], 420) ? { productIdentificationText: joinFields([raw.identification_produits], 420) } : {}),
    ...(cleanText(raw.conditionnements, 260) ? { packagingText: cleanText(raw.conditionnements, 260) } : {}),
    ...(joinFields([raw.risques_encourus, raw.description_complementaire_risque], 650) ? { riskText: joinFields([raw.risques_encourus, raw.description_complementaire_risque], 650) } : {}),
    ...(cleanText(raw.motif_rappel, 650) ? { reasonText: cleanText(raw.motif_rappel, 650) } : {}),
    ...(joinFields([raw.conduites_a_tenir_par_le_consommateur, raw.preconisations_sanitaires], 600) ? { actionText: joinFields([raw.conduites_a_tenir_par_le_consommateur, raw.preconisations_sanitaires], 600) } : {}),
    ...(cleanText(raw.modalites_de_compensation, 220) ? { compensationText: cleanText(raw.modalites_de_compensation, 220) } : {}),
    ...(joinFields([raw.zone_geographique_de_vente, raw.distributeurs], 500) ? { distributionText: joinFields([raw.zone_geographique_de_vente, raw.distributeurs], 500) } : {}),
    ...(commercializationDates ? { commercializationDates } : {}),
    ...(cleanText(raw.numero_fiche ?? raw.rappel_guid ?? raw.id ?? record.recallNumber, 120) ? { recallNumber: cleanText(raw.numero_fiche ?? raw.rappel_guid ?? raw.id ?? record.recallNumber, 120) } : {}),
    identifiers,
    sourceHints: {
      source: 'FR_RAPPELCONSO',
      market: 'France',
      sourceLanguage: 'fr',
      officialSource: 'RappelConso',
      classificationOwner: 'llm'
    }
  };
}

function inputText(value: unknown): string {
  return normalizeForCompare(JSON.stringify(value));
}

function sampleText(record: NormalizedRecall): string {
  return inputText({
    title: record.title,
    category: record.category,
    productNames: record.productNames,
    brandNames: record.brandNames,
    description: record.description,
    hazard: record.hazard,
    remedy: record.remedy,
    raw: rawPayload(record)
  });
}

function hasTerm(record: NormalizedRecall, terms: string[]): boolean {
  const text = sampleText(record);
  return terms.some((term) => text.includes(normalizeForCompare(term)));
}

function hasImage(record: NormalizedRecall): boolean {
  return Boolean(record.primaryImageUrl || (record.images?.length ?? 0) > 0);
}

function selectRappelConsoPreviewSample(records: NormalizedRecall[], limit: number): {
  records: NormalizedRecall[];
  reasonsById: Map<string, string[]>;
  notes: string[];
} {
  const selected: NormalizedRecall[] = [];
  const reasonsById = new Map<string, string[]>();
  const notes: string[] = [];
  const pushRecord = (record: NormalizedRecall | undefined, reason: string): void => {
    if (!record) {
      notes.push(`No RappelConso sample found for ${reason}.`);
      return;
    }
    if (!selected.some((item) => item.id === record.id)) {
      selected.push(record);
    }
    reasonsById.set(record.id, [...(reasonsById.get(record.id) ?? []), reason]);
  };

  const firstMatching = (reason: string, predicate: (record: NormalizedRecall) => boolean): void => {
    pushRecord(records.find(predicate), reason);
  };

  firstMatching('food/allergen or food safety evidence', (record) => hasTerm(record, ['alimentation', 'allergene', 'allergènes', 'lait', 'arachide', 'sesame', 'mycotoxines']));
  firstMatching('vehicle/mobility-like source category evidence', (record) => hasTerm(record, ['automobiles', 'moyens de déplacement', 'moyens de deplacement', 'véhicule', 'vehicule']));
  firstMatching('baby/kids or toy source evidence', (record) => hasTerm(record, ['bébés-enfants', 'bebes enfants', 'jouet', 'enfant', 'puericulture']));
  firstMatching('electronics or battery source evidence', (record) => hasTerm(record, ['appareils électriques', 'appareils electriques', 'batterie', 'chargeur']));
  firstMatching('GTIN/barcode-like identifier evidence', (record) => identifierCandidates(record).some((identifier) => /\b\d{8,14}\b/.test(identifier)));
  firstMatching('lot/batch/date-mark identifier evidence', (record) => identifierCandidates(record).some((identifier) => /\b(lot|batch|ddm|dlc|date de durabilite minimale|date limite de consommation|20\d{2}-\d{2}-\d{2})\b/i.test(normalizeForCompare(identifier))));
  firstMatching('image-backed source record', (record) => hasImage(record));
  firstMatching('image-less source record', (record) => !hasImage(record));
  firstMatching('long risk/action text case', (record) => [record.hazard, record.remedy, record.description, cleanText(rawPayload(record).motif_rappel, 1200)].join(' ').length > 900);
  firstMatching('sparse identifier case', (record) => identifierCandidates(record).length <= 1);
  firstMatching('ambiguous source category case', (record) => hasTerm(record, ['autres', 'sports loisirs', 'hygiène beauté', 'hygiene beaute']));

  for (const group of sampleSearchGroups) {
    if (selected.length >= limit) {
      break;
    }
    firstMatching(`keyword sample: ${group.join(', ')}`, (record) => hasTerm(record, [...group]));
  }

  for (const record of records) {
    if (selected.length >= limit) {
      break;
    }
    pushRecord(record, 'date-order fill sample');
  }

  return {
    records: selected.slice(0, limit),
    reasonsById,
    notes
  };
}

function tokenComparison(
  record: NormalizedRecall,
  genericInput: RecallClassifierInput,
  proposedInput: RappelConsoClassifierInputPreview
): TokenComparison {
  const genericCharacters = JSON.stringify(genericInput).length;
  const proposedCharacters = JSON.stringify(proposedInput).length;
  const genericEstimatedTokens = estimateTokensFromText(JSON.stringify(genericInput));
  const proposedEstimatedTokens = estimateTokensFromText(JSON.stringify(proposedInput));
  const tokenReductionPercent = genericEstimatedTokens > 0
    ? Number((((genericEstimatedTokens - proposedEstimatedTokens) / genericEstimatedTokens) * 100).toFixed(1))
    : 0;

  return {
    id: record.id,
    title: record.title,
    sourceCategory: proposedInput.sourceCategory || record.category,
    genericCharacters,
    proposedCharacters,
    genericEstimatedTokens,
    proposedEstimatedTokens,
    tokenReductionPercent
  };
}

function collectStrings(value: unknown): string[] {
  if (typeof value === 'string') {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectStrings(item));
  }
  if (isObject(value)) {
    return Object.values(value).flatMap((item) => collectStrings(item));
  }
  return [];
}

function repeatedStrings(value: unknown): string[] {
  const counts = new Map<string, { value: string; count: number }>();
  for (const text of collectStrings(value)) {
    const normalized = normalizeForCompare(text);
    if (
      normalized.length < 12 ||
      normalized === 'fr rappelconso' ||
      normalized === 'rappelconso' ||
      normalized === 'france'
    ) {
      continue;
    }
    const current = counts.get(normalized) ?? { value: text, count: 0 };
    current.count += 1;
    counts.set(normalized, current);
  }

  return [...counts.values()]
    .filter((entry) => entry.count > 1)
    .slice(0, 8)
    .map((entry) => entry.value);
}

function overlyLongFields(value: unknown): string[] {
  const output: string[] = [];
  const visit = (item: unknown, path: string): void => {
    if (typeof item === 'string' && item.length > 900) {
      output.push(path);
      return;
    }
    if (Array.isArray(item)) {
      item.forEach((child, index) => visit(child, `${path}[${index}]`));
      return;
    }
    if (isObject(item)) {
      for (const [key, child] of Object.entries(item)) {
        visit(child, path ? `${path}.${key}` : key);
      }
    }
  };

  visit(value, '');
  return output.slice(0, 12);
}

function fallbackGeneratedStrings(value: unknown): string[] {
  return collectStrings(value).filter((text) => isFallbackString(text)).slice(0, 12);
}

function possibleBoilerplate(value: unknown): string[] {
  const terms = ['numero_contact', 'affichettepdf', 'rappel.conso.gouv.fr/image'];
  return collectStrings(value)
    .filter((text) => !/^https?:\/\//i.test(text.trim()))
    .filter((text) => terms.some((term) => normalizeForCompare(text).includes(normalizeForCompare(term))))
    .slice(0, 12);
}

function hasHtmlLeakage(value: unknown): boolean {
  return collectStrings(value).some((text) => /<\/?[a-z][\s\S]*?>/i.test(text) || /&(?:nbsp|amp|quot|#39|#039);/i.test(text));
}

function criticalFieldFindings(input: RappelConsoClassifierInputPreview): string[] {
  const findings: string[] = [];
  if (!input.title && input.productNames.length === 0 && !input.modelReferenceText) {
    findings.push('missing product evidence');
  }
  if (!input.riskText && !input.reasonText) {
    findings.push('missing risk evidence');
  }
  if (!input.actionText && !input.compensationText) {
    findings.push('missing action evidence');
  }
  if (input.sourceUrl && !input.title && !input.riskText && !input.reasonText) {
    findings.push('sourceUrl-only record');
  }
  return findings;
}

function detectNoise(
  record: NormalizedRecall,
  genericInput: RecallClassifierInput,
  proposedInput: RappelConsoClassifierInputPreview,
  comparison: TokenComparison
): NoiseFinding {
  const repeated = repeatedStrings(proposedInput);
  const overlyLong = overlyLongFields(proposedInput);
  const fallbackGenerated = fallbackGeneratedStrings(proposedInput);
  const boilerplate = possibleBoilerplate(proposedInput);
  const emptyCritical = criticalFieldFindings(proposedInput);
  const flags: string[] = [];

  if (hasHtmlLeakage(proposedInput) || hasHtmlLeakage(genericInput)) {
    flags.push('raw HTML leakage');
  }
  if (repeated.length) {
    flags.push('repeated strings');
  }
  if (overlyLong.length) {
    flags.push('overly long fields');
  }
  if (fallbackGenerated.length) {
    flags.push('fallback/generated strings');
  }
  if (boilerplate.length) {
    flags.push('possible boilerplate');
  }
  if (emptyCritical.includes('missing product evidence')) {
    flags.push('missing product evidence');
  }
  if (emptyCritical.includes('missing risk evidence')) {
    flags.push('missing risk evidence');
  }
  if (emptyCritical.includes('missing action evidence')) {
    flags.push('missing action evidence');
  }
  if (proposedInput.identifiers.length >= 20) {
    flags.push('identifier over-extraction');
  }
  if (emptyCritical.includes('sourceUrl-only record')) {
    flags.push('sourceUrl-only record');
  }

  return {
    id: record.id,
    title: record.title,
    flags,
    genericCharacters: comparison.genericCharacters,
    proposedCharacters: comparison.proposedCharacters,
    genericEstimatedTokens: comparison.genericEstimatedTokens,
    proposedEstimatedTokens: comparison.proposedEstimatedTokens,
    tokenReductionPercent: comparison.tokenReductionPercent,
    repeatedStrings: repeated,
    overlyLongFields: overlyLong,
    fallbackGeneratedStrings: fallbackGenerated,
    possibleBoilerplate: boilerplate,
    emptyCriticalFields: emptyCritical,
    identifierCount: proposedInput.identifiers.length,
    proposedStillNoisy: flags.some((flag) => ['raw HTML leakage', 'overly long fields', 'fallback/generated strings', 'possible boilerplate', 'identifier over-extraction'].includes(flag))
  };
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return Number((values.reduce((total, value) => total + value, 0) / values.length).toFixed(1));
}

function representativeRecords(records: PreviewRecord[]): PreviewRecord[] {
  const selected: PreviewRecord[] = [];
  const push = (record: PreviewRecord | undefined): void => {
    if (record && !selected.some((item) => item.id === record.id)) {
      selected.push(record);
    }
  };

  push(records.find((record) => /alimentation|allergene|mycotoxines/i.test(inputText(record.proposedInput))));
  push(records.find((record) => /automobiles|deplacement|vehicule/i.test(inputText(record.proposedInput))));
  push(records.find((record) => /bebe|enfant|jouet/i.test(inputText(record.proposedInput))));
  push(records.find((record) => /appareils electriques|batterie|chargeur/i.test(inputText(record.proposedInput))));
  push(records.find((record) => record.proposedInput.identifiers.length > 0));

  for (const record of records) {
    if (selected.length >= 5) {
      break;
    }
    push(record);
  }

  return selected.slice(0, 5);
}

function markdownReport(payload: PreviewPayload): string {
  const comparisons = payload.records.map((record) => record.tokenComparison);
  const genericAvg = average(comparisons.map((item) => item.genericEstimatedTokens));
  const proposedAvg = average(comparisons.map((item) => item.proposedEstimatedTokens));
  const reductionAvg = average(comparisons.map((item) => item.tokenReductionPercent));
  const missingProduct = payload.records.filter((record) => record.noise.flags.includes('missing product evidence'));
  const missingRisk = payload.records.filter((record) => record.noise.flags.includes('missing risk evidence'));
  const missingAction = payload.records.filter((record) => record.noise.flags.includes('missing action evidence'));
  const noisyDescription = payload.records.filter((record) => record.noise.proposedStillNoisy);
  const overExtracted = payload.records.filter((record) => record.noise.flags.includes('identifier over-extraction'));
  const reps = representativeRecords(payload.records);

  const repSections = reps.map((record, index) => [
    `### ${index + 1}. ${record.title}`,
    '',
    `- ID: ${record.id}`,
    `- Source category: ${record.proposedInput.sourceCategory || 'Missing'}`,
    `- Source subcategory: ${record.proposedInput.sourceSubcategory || 'Missing'}`,
    `- Product evidence: ${[record.proposedInput.title, record.proposedInput.modelReferenceText, ...record.proposedInput.productNames].filter(Boolean).join(' | ') || 'Missing'}`,
    `- Brand evidence: ${record.proposedInput.brandNames.length ? record.proposedInput.brandNames.join(' | ') : 'Missing'}`,
    `- Risk evidence: ${record.proposedInput.riskText || record.proposedInput.reasonText || 'Missing'}`,
    `- Action evidence: ${record.proposedInput.actionText || record.proposedInput.compensationText || 'Missing'}`,
    `- Identifiers: ${record.proposedInput.identifiers.length ? record.proposedInput.identifiers.join(' | ') : 'None'}`,
    `- Generic token estimate: ${record.tokenComparison.genericEstimatedTokens}`,
    `- Proposed token estimate: ${record.tokenComparison.proposedEstimatedTokens}`,
    `- Notes: ${record.sampleReasons.join('; ') || 'Selected for general sample review'}${record.noise.flags.length ? `; noise flags: ${record.noise.flags.join(', ')}` : ''}`,
    ''
  ].join('\n'));

  return [
    '# RappelConso Classifier Input Preview',
    '',
    '## Summary',
    '',
    `Generated: ${payload.generatedAt}`,
    `Total RappelConso records: ${payload.totalRappelConsoRecords}`,
    `Sample count: ${payload.sampleCount}`,
    `Food case: ${payload.foodCaseIncluded ? 'included' : 'not found'}`,
    `Vehicle/mobility case: ${payload.vehicleCaseIncluded ? 'included' : 'not found'}`,
    `Baby/kids case: ${payload.babyKidsCaseIncluded ? 'included' : 'not found'}`,
    `Electronics case: ${payload.electronicsCaseIncluded ? 'included' : 'not found'}`,
    `Identifier case: ${payload.identifierCaseIncluded ? 'included' : 'not found'}`,
    `Average generic tokens: ${genericAvg}`,
    `Average proposed tokens: ${proposedAvg}`,
    `Average reduction: ${reductionAvg}%`,
    '',
    '## Records With Missing Product Evidence',
    '',
    missingProduct.length ? missingProduct.map((record) => `- ${record.id}: ${record.title}`).join('\n') : '- None in sample',
    '',
    '## Records With Missing Risk Evidence',
    '',
    missingRisk.length ? missingRisk.map((record) => `- ${record.id}: ${record.title}`).join('\n') : '- None in sample',
    '',
    '## Records With Missing Action Evidence',
    '',
    missingAction.length ? missingAction.map((record) => `- ${record.id}: ${record.title}`).join('\n') : '- None in sample',
    '',
    '## Records With Noisy Proposed Input',
    '',
    noisyDescription.length ? noisyDescription.map((record) => `- ${record.id}: ${record.noise.flags.join(', ')}`).join('\n') : '- None in sample',
    '',
    '## Records With Likely Over-Extracted Identifiers',
    '',
    overExtracted.length ? overExtracted.map((record) => `- ${record.id}: ${record.proposedInput.identifiers.length} identifiers`).join('\n') : '- None in sample',
    '',
    '## Recommended RappelConso Input Field Map',
    '',
    '- `title`: Recall Radar title derived from official brand and product wording, capped at 260 characters.',
    '- `sourceLanguage`: fixed `fr` because source evidence is in French.',
    '- `sourceCategory`: official `categorie_produit`, evidence only.',
    '- `sourceSubcategory`: official `sous_categorie_produit`, evidence only.',
    '- `sourceRecallNature`: official `nature_juridique_rappel`, evidence only.',
    '- `productNames`: official `libelle`, model, and reference text without barcode-only values.',
    '- `brandNames`: official `marque_produit` plus normalized source brand names.',
    '- `modelReferenceText`: official `modeles_ou_references`.',
    '- `productIdentificationText`: official `identification_produits` such as GTIN, lots, dates, and reference values.',
    '- `packagingText`: official `conditionnements`.',
    '- `riskText`: official `risques_encourus` and `description_complementaire_risque`.',
    '- `reasonText`: official `motif_rappel`.',
    '- `actionText`: official consumer instructions and health recommendations.',
    '- `compensationText`: official compensation terms.',
    '- `distributionText`: official sales geography and distributor evidence.',
    '- `commercializationDates`: official sales start/end dates when present.',
    '- `recallNumber`: official `numero_fiche`, GUID, or source id.',
    '- `identifiers`: source-derived GTIN, lot, date-marking, reference, model, and recall id evidence.',
    '- `sourceHints`: France/RappelConso/source-language provenance only. Product family, product type, hazard type, audience, and final taxonomy are owned by the LLM.',
    '',
    '## Decision Checklist Before Gemini Classification',
    '',
    '- Confirm official French category and subcategory are evidence only, not public taxonomy assignments.',
    '- Confirm food, vehicle-like, baby/kids, and electronics examples are represented when present.',
    '- Confirm GTIN, lot, date-marking, model, and recall id values are passed as identifiers without over-extracting distributor prose.',
    '- Confirm generated preview output excludes raw payloads, image URLs, PDF URLs, raw HTML, contact boilerplate, and fallback strings.',
    '- Confirm proposed input does not include productFamily, productType, hazardType, audience, or other final taxonomy fields.',
    '',
    '## Representative Records',
    '',
    ...repSections
  ].join('\n');
}

async function writeOutputs(payload: PreviewPayload): Promise<void> {
  await mkdir(absoluteOutputDir, { recursive: true });

  const tokenComparisonPayload = {
    generatedAt: payload.generatedAt,
    source: payload.source,
    sampleCount: payload.sampleCount,
    averageGenericTokens: average(payload.records.map((record) => record.tokenComparison.genericEstimatedTokens)),
    averageProposedTokens: average(payload.records.map((record) => record.tokenComparison.proposedEstimatedTokens)),
    averageReductionPercent: average(payload.records.map((record) => record.tokenComparison.tokenReductionPercent)),
    records: payload.records.map((record) => record.tokenComparison)
  };
  const noisePayload = {
    generatedAt: payload.generatedAt,
    source: payload.source,
    sampleCount: payload.sampleCount,
    noisyRecords: payload.records.filter((record) => record.noise.flags.length > 0).length,
    records: payload.records.map((record) => record.noise)
  };

  await writeFile(resolve(absoluteOutputDir, 'rappelconso-input-preview.json'), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  await writeFile(resolve(absoluteOutputDir, 'rappelconso-input-preview.md'), `${markdownReport(payload)}\n`, 'utf8');
  await writeFile(resolve(absoluteOutputDir, 'rappelconso-noise-report.json'), `${JSON.stringify(noisePayload, null, 2)}\n`, 'utf8');
  await writeFile(resolve(absoluteOutputDir, 'rappelconso-token-comparison.json'), `${JSON.stringify(tokenComparisonPayload, null, 2)}\n`, 'utf8');
}

async function runPreview(): Promise<void> {
  const records = await readProcessedRecalls();
  const rappelConsoRecords = records.filter((record) => record.source === 'FR_RAPPELCONSO');
  const requestedLimit = envLimit();
  const sample = selectRappelConsoPreviewSample(rappelConsoRecords, Math.min(requestedLimit, rappelConsoRecords.length));
  const previewRecords = sample.records.map((record) => {
    const genericInput = buildRecallClassifierInput(record);
    const proposedInput = buildRappelConsoClassifierInputPreview(record);
    const comparison = tokenComparison(record, genericInput, proposedInput);
    const noise = detectNoise(record, genericInput, proposedInput, comparison);

    return {
      id: record.id,
      title: record.title,
      sourceCategory: proposedInput.sourceCategory || record.category,
      genericInput,
      proposedInput,
      tokenComparison: comparison,
      noise,
      sampleReasons: sample.reasonsById.get(record.id) ?? []
    };
  });

  const payload: PreviewPayload = {
    generatedAt: new Date().toISOString(),
    source: 'FR_RAPPELCONSO',
    totalRappelConsoRecords: rappelConsoRecords.length,
    sampleCount: previewRecords.length,
    requestedLimit,
    foodCaseIncluded: previewRecords.some((record) => /alimentation|allergene|mycotoxines/i.test(inputText(record.proposedInput))),
    vehicleCaseIncluded: previewRecords.some((record) => /automobiles|deplacement|vehicule/i.test(inputText(record.proposedInput))),
    babyKidsCaseIncluded: previewRecords.some((record) => /bebe|enfant|jouet/i.test(inputText(record.proposedInput))),
    electronicsCaseIncluded: previewRecords.some((record) => /appareils electriques|batterie|chargeur/i.test(inputText(record.proposedInput))),
    identifierCaseIncluded: previewRecords.some((record) => record.proposedInput.identifiers.length > 0),
    outputDir,
    notes: sample.notes,
    records: previewRecords
  };

  await writeOutputs(payload);

  const genericAvg = average(previewRecords.map((record) => record.tokenComparison.genericEstimatedTokens));
  const proposedAvg = average(previewRecords.map((record) => record.tokenComparison.proposedEstimatedTokens));
  const reductionAvg = average(previewRecords.map((record) => record.tokenComparison.tokenReductionPercent));
  const noiseCount = previewRecords.filter((record) => record.noise.flags.length > 0).length;

  console.log(JSON.stringify({
    totalRappelConsoRecords: payload.totalRappelConsoRecords,
    sampleCount: payload.sampleCount,
    foodCaseIncluded: payload.foodCaseIncluded,
    vehicleCaseIncluded: payload.vehicleCaseIncluded,
    babyKidsCaseIncluded: payload.babyKidsCaseIncluded,
    electronicsCaseIncluded: payload.electronicsCaseIncluded,
    identifierCaseIncluded: payload.identifierCaseIncluded,
    averageGenericTokens: genericAvg,
    averageProposedTokens: proposedAvg,
    averageReductionPercent: reductionAvg,
    noisyRecords: noiseCount,
    outputFiles: {
      previewJson: `${outputDir}/rappelconso-input-preview.json`,
      markdownReport: `${outputDir}/rappelconso-input-preview.md`,
      noiseReport: `${outputDir}/rappelconso-noise-report.json`,
      tokenComparison: `${outputDir}/rappelconso-token-comparison.json`
    }
  }, null, 2));
}

runPreview().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
