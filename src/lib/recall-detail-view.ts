import processedRecallData from '../../data/processed/recalls.json';
import type { NormalizedRecall, ProcessedRecallFile, RecallImage } from '../data/recall-types';
import type { SiteRecall } from './recall-data';
import {
  getOfficialSourceLabel,
  getOfficialVerificationCopy,
  getRecallActionLabel,
  getRecallDefaultActionFallback,
  getRecallDistributionLabel,
  getRecallQuantityLabel,
  getRecallReasonLabel,
  getRecallSourceLabel,
  getRecallSparseIdentificationCopy,
  getRecallVerificationChecklist,
  getRecallVerificationIntro
} from './recall-sources';
import { getCompanyRecallHistory, getRelatedRecalls } from './related-recalls';

type RawObject = Record<string, unknown>;

export type DetailFact = {
  label: string;
  value: string | string[];
};

export type RecallDetailView = {
  displayTitle: string;
  officialTitle: string;
  productName: string;
  brandName: string;
  sourceBadge: string;
  recallDate: string;
  recallNumber: string;
  categoryLabel: string;
  productImages: RecallImage[];
  imageCaptions: string[];
  primaryImageAlt: string;
  introSentence: string;
  reasonLabel: string;
  reason: string;
  actionLabel: string;
  action: string;
  actionDetail: string;
  actionParagraphs: string[];
  description: string;
  identificationDetails: DetailFact[];
  verificationIntro: string;
  verificationChecklist: string[];
  sparseIdentificationCopy: string;
  detailSafetyCopy: string;
  consumerContact: string;
  soldAt: string[];
  incidents: string[];
  importer: string[];
  manufacturer: string[];
  manufacturedIn: string[];
  units: string;
  quantityLabel: string;
  distributionLabel: string;
  officialSourceLabel: string;
  officialSourceUrl: string;
  officialVerificationCopy: string;
  fdaDetails: DetailFact[];
  companyRecallHistory: SiteRecall[];
  relatedRecalls: SiteRecall[];
};

const processedFile = processedRecallData as ProcessedRecallFile;
const processedRecordById = new Map<string, NormalizedRecall>(
  (Array.isArray(processedFile.records) ? processedFile.records : []).map((record) => [record.id, record])
);

type SourceDetailView = Omit<
  RecallDetailView,
  | 'sourceBadge'
  | 'categoryLabel'
  | 'productImages'
  | 'primaryImageAlt'
  | 'introSentence'
  | 'reasonLabel'
  | 'actionLabel'
  | 'verificationIntro'
  | 'verificationChecklist'
  | 'sparseIdentificationCopy'
  | 'detailSafetyCopy'
  | 'quantityLabel'
  | 'distributionLabel'
  | 'officialSourceLabel'
  | 'officialSourceUrl'
  | 'officialVerificationCopy'
  | 'companyRecallHistory'
  | 'relatedRecalls'
>;

function isObject(value: unknown): value is RawObject {
  return typeof value === 'object' && value !== null;
}

function cleanText(value?: string | null): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

function safeText(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? cleanText(String(value)) : '';
}

function uniqueNonEmpty(values: string[]): string[] {
  return [...new Set(values.map(cleanText).filter(Boolean))];
}

function firstNonEmpty(values: string[], fallback = ''): string {
  return values.map(cleanText).find(Boolean) ?? fallback;
}

function rawFor(recall: SiteRecall): RawObject {
  const record = processedRecordById.get(recall.id);
  return isObject(record?.raw) ? record.raw : {};
}

function rawArray(raw: RawObject, key: string): RawObject[] {
  const value = raw[key];
  return Array.isArray(value) ? value.filter(isObject) : [];
}

function rawText(raw: RawObject, key: string): string {
  return safeText(raw[key]);
}

function splitRawText(raw: RawObject, key: string): string[] {
  const value = raw[key];
  if (Array.isArray(value)) {
    return uniqueNonEmpty(value.flatMap((item) => safeText(item).split(/[|¤\n;]/)).map(cleanText));
  }

  return uniqueNonEmpty(
    rawText(raw, key)
      .split(/[|¤\n;]/)
      .map(cleanText)
  );
}

function valuesFrom(raw: RawObject, key: string, property = 'Name'): string[] {
  return uniqueNonEmpty(rawArray(raw, key).map((item) => safeText(item[property])));
}

function addFact(facts: DetailFact[], label: string, value: string | string[]): void {
  const cleaned = Array.isArray(value) ? uniqueNonEmpty(value) : cleanText(value);
  if (Array.isArray(cleaned) ? cleaned.length > 0 : Boolean(cleaned)) {
    facts.push({ label, value: cleaned });
  }
}

function formatDate(value: string): string {
  const text = cleanText(value);
  if (!text) {
    return '';
  }

  const date =
    /^\d{8}$/.test(text)
      ? new Date(`${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}T00:00:00Z`)
      : new Date(text.includes('T') ? text : `${text}T00:00:00Z`);

  if (Number.isNaN(date.getTime())) {
    return text;
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(date);
}

function compactTitle(value: string): string {
  return cleanText(value)
    .replace(/\s*,?\s*UPC\b.*$/i, '')
    .replace(/\s+Distribution:\b.*$/i, '')
    .replace(/\s+recalled by\b.*$/i, '')
    .replace(/\s+recalls?\b.*$/i, '')
    .replace(/\s+recalled\b.*$/i, '')
    .replace(/\s+due to\b.*$/i, '')
    .replace(/\s+risk of\b.*$/i, '')
    .replace(/\s+because of\b.*$/i, '')
    .trim();
}

function limitWithoutEllipsis(value: string, maxLength = 92): string {
  const text = cleanText(value);
  if (text.length <= maxLength) {
    return text;
  }

  const clipped = text.slice(0, maxLength);
  const lastSpace = clipped.lastIndexOf(' ');

  return clipped.slice(0, lastSpace > Math.floor(maxLength * 0.55) ? lastSpace : maxLength).trim();
}

function displayTitleFor(productName: string, officialTitle: string): string {
  const titleBase = limitWithoutEllipsis(compactTitle(productName) || compactTitle(officialTitle) || 'Product');
  return `${titleBase} Recall`;
}

export function recallSourceBadge(recall: SiteRecall): string {
  return getRecallSourceLabel(recall.source);
}

function cpscRecallNumber(value: string): string {
  const clean = cleanText(value);
  if (/^\d{5}$/.test(clean)) {
    return `${clean.slice(0, 2)}-${clean.slice(2)}`;
  }

  return clean;
}

function productUnits(raw: RawObject, recall: SiteRecall): string {
  return firstNonEmpty(
    [
      ...rawArray(raw, 'Products').map((item) => safeText(item.NumberOfUnits)),
      recall.affectedUnits,
      recall.productQuantity ?? ''
    ]
  );
}

function imageCaptions(raw: RawObject, recall: SiteRecall): string[] {
  return uniqueNonEmpty([
    ...rawArray(raw, 'Images').map((item) => safeText(item.Caption) || safeText(item.caption)),
    ...recall.images.map((image) => image.caption ?? '')
  ]);
}

function productUpcs(raw: RawObject): string[] {
  return uniqueNonEmpty(rawArray(raw, 'ProductUPCs').flatMap((item) => Object.values(item).map(safeText)));
}

function productModels(raw: RawObject): string[] {
  return uniqueNonEmpty(rawArray(raw, 'Products').map((item) => safeText(item.Model)));
}

function identifierDetails(text: string): string[] {
  const patterns = [
    /\bUPC\s*[0-9][0-9 -]{5,}\b/gi,
    /\bLOT\s*[A-Z0-9./_-]{2,}\b/gi,
    /\bKHK[0-9A-Z./_-]+\b/gi,
    /\bRN\s*[0-9]{4,}\b/gi,
    /\bFCC ID\s*["']?[A-Z0-9-]+["']?/gi,
    /\b(?:model|model number|model no\.?)\s*[:#-]?\s*[A-Z0-9][A-Z0-9./_-]{2,}\b/gi,
    /\b(?:date of manufacture|date code|best by|use by|sell by|expiration date|expiry date)\s*["']?[A-Z0-9][A-Z0-9 ,./_-]{2,30}["']?/gi,
    /"[^"]{2,80}"/g
  ];

  return uniqueNonEmpty(patterns.flatMap((pattern) => [...text.matchAll(pattern)].map((match) => match[0])));
}

function paragraphs(value: string): string[] {
  const text = cleanText(value);
  if (!text) {
    return [];
  }

  const sentences = text.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g)?.map(cleanText).filter(Boolean) ?? [text];
  return sentences.length > 2 ? sentences : [text];
}

function normalizeIncidents(values: string[]): string[] {
  return uniqueNonEmpty(values).map((value) => (/^none reported\.?$/i.test(value) ? 'None reported.' : value));
}

function buildCpscView(recall: SiteRecall, raw: RawObject): SourceDetailView {
  const officialTitle = rawText(raw, 'Title') || recall.title;
  const productName = firstNonEmpty([...rawArray(raw, 'Products').map((item) => safeText(item.Name)), ...recall.productNames, recall.primaryProductName], 'Product');
  const brandName = firstNonEmpty(
    [...valuesFrom(raw, 'Importers'), ...valuesFrom(raw, 'Manufacturers'), ...valuesFrom(raw, 'Distributors'), ...recall.displayBrandNames],
    recall.primaryBrand
  );
  const description = rawText(raw, 'Description') || recall.description;
  const reason = firstNonEmpty([...valuesFrom(raw, 'Hazards'), recall.hazard], 'Reason not listed.');
  const remedyDetail = firstNonEmpty(
    [...valuesFrom(raw, 'Remedies'), recall.remedy],
    getRecallDefaultActionFallback(recall.source)
  );
  const captions = imageCaptions(raw, recall);
  const identificationDetails: DetailFact[] = [];
  const ids = uniqueNonEmpty([
    ...productModels(raw),
    ...productUpcs(raw),
    ...identifierDetails([description, productName, ...captions].join(' '))
  ]);

  addFact(identificationDetails, 'Product', productName);
  addFact(identificationDetails, 'Brand or company', brandName);
  addFact(identificationDetails, 'Description', description);
  addFact(identificationDetails, 'Label, model, UPC, lot, RN, or date details', ids);
  addFact(identificationDetails, 'Image captions', captions);

  return {
    displayTitle: displayTitleFor(productName, officialTitle),
    officialTitle,
    productName,
    brandName,
    recallDate: formatDate(rawText(raw, 'RecallDate') || recall.recallDate),
    recallNumber: cpscRecallNumber(rawText(raw, 'RecallNumber') || recall.recallNumber || ''),
    imageCaptions: captions,
    reason,
    action: remedyDetail,
    actionDetail: remedyDetail,
    actionParagraphs: paragraphs(remedyDetail),
    description,
    identificationDetails,
    consumerContact: rawText(raw, 'ConsumerContact'),
    soldAt: valuesFrom(raw, 'Retailers'),
    incidents: normalizeIncidents(valuesFrom(raw, 'Injuries')),
    importer: valuesFrom(raw, 'Importers'),
    manufacturer: valuesFrom(raw, 'Manufacturers'),
    manufacturedIn: valuesFrom(raw, 'ManufacturerCountries', 'Country'),
    units: productUnits(raw, recall) || recall.affectedUnits,
    fdaDetails: []
  };
}

function buildFdaView(recall: SiteRecall, raw: RawObject): SourceDetailView {
  const productName = firstNonEmpty([rawText(raw, 'product_description'), ...recall.productNames, recall.primaryProductName], 'Product');
  const brandName = firstNonEmpty([rawText(raw, 'recalling_firm'), ...recall.displayBrandNames, recall.primaryBrand], 'Firm not listed');
  const reason = firstNonEmpty([rawText(raw, 'reason_for_recall'), recall.reason ?? '', recall.hazard], 'Reason not listed.');
  const status = rawText(raw, 'status') || recall.status || '';
  const action =
    cleanText(recall.remedy) ||
    (status
      ? `FDA enforcement status: ${status}. Verify current instructions with the FDA/openFDA record and recalling firm.`
      : getRecallDefaultActionFallback(recall.source));
  const officialTitle = recall.title;
  const details: DetailFact[] = [];
  const codeDetails = uniqueNonEmpty([rawText(raw, 'code_info'), rawText(raw, 'more_code_info'), ...identifierDetails(productName)]);

  addFact(details, 'Product description', productName);
  addFact(details, 'Recalling firm', brandName);
  addFact(details, 'Lot, UPC, or code information', codeDetails);
  addFact(details, 'Classification', rawText(raw, 'classification') || recall.classification || '');
  addFact(details, 'Status', status);
  addFact(details, 'Quantity', rawText(raw, 'product_quantity') || recall.productQuantity || recall.affectedUnits);
  addFact(details, 'Distribution', rawText(raw, 'distribution_pattern') || recall.distributionPattern || '');
  addFact(details, 'Recall number', rawText(raw, 'recall_number') || recall.recallNumber || '');

  return {
    displayTitle: displayTitleFor(productName, officialTitle),
    officialTitle,
    productName,
    brandName,
    recallDate: formatDate(rawText(raw, 'recall_initiation_date') || recall.recallDate),
    recallNumber: rawText(raw, 'recall_number') || recall.recallNumber || '',
    imageCaptions: [],
    reason,
    action,
    actionDetail: action,
    actionParagraphs: paragraphs(action),
    description: productName,
    identificationDetails: details,
    consumerContact: '',
    soldAt: uniqueNonEmpty([rawText(raw, 'distribution_pattern') || recall.distributionPattern || '']),
    incidents: [],
    importer: [],
    manufacturer: [],
    manufacturedIn: [],
    units: rawText(raw, 'product_quantity') || recall.productQuantity || recall.affectedUnits,
    fdaDetails: details
  };
}

function buildRappelConsoView(recall: SiteRecall, raw: RawObject): SourceDetailView {
  const productName = firstNonEmpty([rawText(raw, 'libelle'), rawText(raw, 'modeles_ou_references'), ...recall.productNames, recall.primaryProductName], 'Product');
  const brandName = firstNonEmpty([rawText(raw, 'marque_produit'), ...recall.displayBrandNames, recall.primaryBrand], 'Brand not listed');
  const identifiers = uniqueNonEmpty([
    ...splitRawText(raw, 'identification_produits'),
    ...identifierDetails([productName, rawText(raw, 'modeles_ou_references'), recall.description].join(' '))
  ]);
  const reason = firstNonEmpty([rawText(raw, 'motif_rappel'), rawText(raw, 'risques_encourus'), recall.reason ?? '', recall.hazard], 'Reason not listed.');
  const action = firstNonEmpty(
    [
      splitRawText(raw, 'conduites_a_tenir_par_le_consommateur').join('; '),
      rawText(raw, 'modalites_de_compensation'),
      rawText(raw, 'preconisations_sanitaires'),
      recall.remedy
    ],
    getRecallDefaultActionFallback(recall.source)
  );
  const distribution = uniqueNonEmpty([rawText(raw, 'zone_geographique_de_vente'), rawText(raw, 'distributeurs'), recall.distributionPattern ?? '']);
  const captions = imageCaptions(raw, recall);
  const description = firstNonEmpty(
    [
      rawText(raw, 'modeles_ou_references'),
      rawText(raw, 'informations_complementaires'),
      rawText(raw, 'description_complementaire_risque'),
      recall.description
    ],
    productName
  );
  const details: DetailFact[] = [];

  addFact(details, 'Product', productName);
  addFact(details, 'Brand or company', brandName);
  addFact(details, 'GTIN, barcode, lot, batch, or date details', identifiers);
  addFact(details, 'Package or model details', rawText(raw, 'conditionnements') || rawText(raw, 'modeles_ou_references'));
  addFact(details, 'Distribution or sales area', distribution);
  addFact(details, 'Image captions', captions);

  return {
    displayTitle: displayTitleFor(productName, recall.title),
    officialTitle: recall.title,
    productName,
    brandName,
    recallDate: formatDate(rawText(raw, 'date_publication') || recall.recallDate),
    recallNumber: rawText(raw, 'numero_fiche') || rawText(raw, 'rappel_guid') || recall.recallNumber || '',
    imageCaptions: captions,
    reason,
    action,
    actionDetail: action,
    actionParagraphs: paragraphs(action),
    description,
    identificationDetails: details,
    consumerContact: rawText(raw, 'numero_contact'),
    soldAt: distribution,
    incidents: [],
    importer: splitRawText(raw, 'distributeurs'),
    manufacturer: [],
    manufacturedIn: [],
    units: rawText(raw, 'conditionnements') || recall.affectedUnits,
    fdaDetails: []
  };
}

function buildCanadaView(recall: SiteRecall, raw: RawObject): SourceDetailView {
  const productName = firstNonEmpty([rawText(raw, 'Product'), ...recall.productNames, recall.primaryProductName], 'Product');
  const brandName = firstNonEmpty([...recall.displayBrandNames, ...recall.brandNames], '');
  const officialTitle = rawText(raw, 'Title') || recall.title;
  const organization = rawText(raw, 'Organization');
  const reason = firstNonEmpty([rawText(raw, 'Issue'), recall.reason ?? '', recall.hazard], 'Reason not listed.');
  const action = firstNonEmpty(
    [rawText(raw, 'What you should do'), recall.remedy],
    getRecallDefaultActionFallback(recall.source)
  );
  const identifiers = uniqueNonEmpty(
    identifierDetails([officialTitle, productName, recall.description, rawText(raw, 'What you should do')].join(' '))
  );
  const details: DetailFact[] = [];

  addFact(details, 'Product', productName);
  addFact(details, 'Brand or company', brandName);
  addFact(details, 'UPC, barcode, model, item, lot, batch, date, DIN, or NPN details', identifiers);
  addFact(details, 'Category', rawText(raw, 'Category') || recall.rawCategory);
  addFact(details, 'Published by', organization);
  addFact(details, 'Recall or alert id', rawText(raw, 'NID') || recall.recallNumber || '');
  addFact(details, 'Classification or status', uniqueNonEmpty([rawText(raw, 'Recall class'), recall.status ?? '']));

  return {
    displayTitle: displayTitleFor(productName, officialTitle),
    officialTitle,
    productName,
    brandName,
    recallDate: formatDate(rawText(raw, 'Last updated') || recall.recallDate),
    recallNumber: rawText(raw, 'NID') || recall.recallNumber || '',
    imageCaptions: [],
    reason,
    action,
    actionDetail: action,
    actionParagraphs: paragraphs(action),
    description: recall.description || productName,
    identificationDetails: details,
    consumerContact: '',
    soldAt: uniqueNonEmpty([recall.distributionPattern ?? '']),
    incidents: [],
    importer: [],
    manufacturer: [],
    manufacturedIn: [],
    units: recall.affectedUnits || recall.productQuantity || '',
    fdaDetails: details
  };
}

export function buildRecallDetailView(recall: SiteRecall, allRecalls: SiteRecall[]): RecallDetailView {
  const raw = rawFor(recall);
  const companyRecallHistory = getCompanyRecallHistory(recall, allRecalls, 4);
  const companyHistoryIds = new Set(companyRecallHistory.map((historyRecall) => historyRecall.id));
  const relatedRecalls = getRelatedRecalls(recall, allRecalls, 4, companyHistoryIds);
  const sourceSpecificView =
    recall.source === 'FDA'
      ? buildFdaView(recall, raw)
      : recall.source === 'FR_RAPPELCONSO'
        ? buildRappelConsoView(recall, raw)
        : recall.source === 'CA_RECALLS'
          ? buildCanadaView(recall, raw)
          : buildCpscView(recall, raw);
  const productIntro = sourceSpecificView.productName
    ? `This recall involves ${sourceSpecificView.productName}`
    : 'This recall involves a recalled product';
  const brandIntro = sourceSpecificView.brandName ? ` from ${sourceSpecificView.brandName}` : '';

  return {
    ...sourceSpecificView,
    sourceBadge: getRecallSourceLabel(recall.source),
    categoryLabel: recall.categoryLabel,
    productImages: recall.images,
    primaryImageAlt: recall.primaryImageAlt || `${sourceSpecificView.productName} recall product image`,
    introSentence: `${productIntro}${brandIntro}. Review the photos and details below before using, keeping, selling, or giving it away.`,
    reasonLabel: getRecallReasonLabel(recall.source),
    actionLabel: getRecallActionLabel(recall.source),
    verificationIntro: getRecallVerificationIntro(recall.source),
    verificationChecklist: getRecallVerificationChecklist(recall.source),
    sparseIdentificationCopy: getRecallSparseIdentificationCopy(recall.source),
    detailSafetyCopy:
      'Search matches and indexed notices are not safety confirmations. Verify affected models, lots, dates, distribution, and remedies with the official notice.',
    quantityLabel: getRecallQuantityLabel(recall.source),
    distributionLabel: getRecallDistributionLabel(recall.source),
    officialSourceLabel: getOfficialSourceLabel(recall.source),
    officialSourceUrl: recall.sourceUrl,
    officialVerificationCopy: getOfficialVerificationCopy(recall.source),
    fdaDetails: sourceSpecificView.fdaDetails,
    companyRecallHistory,
    relatedRecalls
  };
}
