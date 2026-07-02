import processedRecallData from '../../data/processed/recalls.json';
import { mockRecalls, type MockRecall, type RecallCategory } from '../data/mock-recalls';
import type { NormalizedRecall, ProcessedRecallFile, RecallImage } from '../data/recall-types';
import { normalizeBrandName } from './brand-normalize';
import { getRecallSourceLabel } from './recall-sources';
import { limitSlug, recallSlug } from './slug';

export type SiteRecallCategory = RecallCategory | 'general-consumer-product';
export type SiteRecallSource = NormalizedRecall['source'] | 'Mock';

export type SiteRecall = {
  id: string;
  source: SiteRecallSource;
  sourceLabel: string;
  sourceUrl: string;
  title: string;
  brandNames: string[];
  displayBrandNames: string[];
  primaryBrand: string;
  primaryBrandRawName: string;
  primaryBrandSlug: string;
  productNames: string[];
  primaryProductName: string;
  category: SiteRecallCategory;
  rawCategory: string;
  categoryLabel: string;
  hazard: string;
  remedy: string;
  recallDate: string;
  affectedUnits: string;
  description: string;
  slug: string;
  detailPath: string;
  classification?: string;
  reason?: string;
  distributionPattern?: string;
  productQuantity?: string;
  recallNumber?: string;
  status?: string;
  images: RecallImage[];
  primaryImageUrl?: string;
  primaryImageAlt?: string;
};

export type BrandRecallGroup = {
  brand: string;
  displayName: string;
  slug: string;
  rawNames: string[];
  recalls: SiteRecall[];
};

export const categoryRoutes = [
  {
    href: '/baby-product-recalls',
    label: 'Baby & Kids',
    category: 'baby-kids',
    description: 'Cribs, sleepers, toys, nursery gear, and child-focused notices.'
  },
  {
    href: '/battery-recalls',
    label: 'Batteries & Electronics',
    category: 'battery-electronics',
    description: 'Batteries, chargers, power banks, lithium-ion products, and electronics.'
  },
  {
    href: '/food-allergy-recalls',
    label: 'Food & Allergy',
    category: 'food-allergy',
    description: 'Food notices, undeclared allergens, packaged goods, UPCs, and lot codes.'
  }
] as const;

export const categoryLabels: Record<SiteRecallCategory, string> = {
  'baby-kids': 'Baby and Kids',
  'battery-electronics': 'Battery and Electronics',
  'food-allergy': 'Food and Allergy',
  'household-appliance': 'Household Appliance',
  'general-consumer-product': 'General Consumer Product'
};

const processedFile = processedRecallData as ProcessedRecallFile;

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function textHasAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}

function classifyRecall(record: NormalizedRecall): SiteRecallCategory {
  if (record.source === 'FDA') {
    return 'food-allergy';
  }

  // UK FSA Food Alerts are food/allergy/action notices, not a general consumer-product source.
  if (record.source === 'UK_FSA') {
    return 'food-allergy';
  }

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

  if (record.source === 'FR_RAPPELCONSO') {
    const rawCategory = normalize(record.category);

    // RappelConso vehicle notices often mention electric systems, fuel, or collision risk.
    // Until Recall Radar has a vehicle category, keep them out of food, baby, and electronics groups.
    if (rawCategory.includes('automobiles') || rawCategory.includes('moyens de deplacement')) {
      return 'general-consumer-product';
    }

    if (rawCategory.includes('appareils electriques')) {
      return 'household-appliance';
    }

    if (textHasAny(text, ['alimentation', 'allergene', 'lait', 'arachide', 'noisette', 'sesame'])) {
      return 'food-allergy';
    }

    if (textHasAny(text, ['bebe', 'bebes', 'enfant', 'enfants', 'jouet', 'jouets', 'puericulture'])) {
      return 'baby-kids';
    }

    if (
      textHasAny(text, [
        'batterie',
        'batteries',
        'chargeur',
        'chargeurs',
        'electronique'
      ])
    ) {
      return 'battery-electronics';
    }

    if (
      textHasAny(text, [
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

  if (record.source === 'CA_RECALLS') {
    const rawCategory = normalize(record.category);
    const raw = isObject(record.raw) ? record.raw : {};
    const organization = normalize(safeText(raw.Organization));

    if (
      organization === 'cfia' ||
      textHasAny(text, [
        'food',
        'allergen',
        'allergy',
        'undeclared',
        'salmonella',
        'listeria',
        'milk',
        'egg',
        'wheat',
        'sesame',
        'pistachio'
      ])
    ) {
      return 'food-allergy';
    }

    if (textHasAny(text, ['baby', 'child', 'children', 'infant', 'toy', 'nursery', 'kids'])) {
      return 'baby-kids';
    }

    if (textHasAny(text, ['battery', 'batteries', 'charger', 'charging', 'electronics', 'power bank', 'lithium'])) {
      return 'battery-electronics';
    }

    if (
      rawCategory.includes('household') ||
      rawCategory.includes('furniture') ||
      textHasAny(text, [
        'appliance',
        'household',
        'kitchenware',
        'tableware',
        'air conditioner',
        'heat pump',
        'furniture',
        'furnishings'
      ])
    ) {
      return 'household-appliance';
    }

    return 'general-consumer-product';
  }

  if (record.source === 'EU_SAFETY_GATE') {
    const rawCategory = normalize(record.category);
    const productText = normalize(
      [record.title, record.category, ...record.productNames, ...record.brandNames].join(' ')
    );

    // Safety Gate covers dangerous non-food products. Keep this mapping conservative
    // so vehicles, cosmetics, chemicals, PPE, and similar alerts do not enter narrow categories.
    if (
      rawCategory.includes('toys') ||
      rawCategory.includes('childcare') ||
      textHasAny(productText, ['toy', 'toys', 'childcare article', 'baby', 'infant'])
    ) {
      return 'baby-kids';
    }

    if (
      textHasAny(rawCategory, [
        'motor vehicles',
        'machinery',
        'cosmetics',
        'chemical products',
        'jewellery',
        'jewelry',
        'protective equipment',
        'hobby sports equipment',
        'laser pointers',
        'lighters',
        'clothing',
        'construction products'
      ])
    ) {
      return 'general-consumer-product';
    }

    if (
      rawCategory.includes('electrical appliances') ||
      textHasAny(productText, [
        'battery',
        'batteries',
        'charger',
        'charging',
        'lithium',
        'power bank',
        'power supply',
        'adapter',
        'usb',
        'electronics'
      ])
    ) {
      return 'battery-electronics';
    }

    if (
      rawCategory.includes('furniture') ||
      rawCategory.includes('lighting chains') ||
      textHasAny(productText, [
        'appliance',
        'household',
        'kitchen',
        'furniture',
        'lamp',
        'lighting',
        'heater',
        'cooker',
        'iron',
        'hair dryer'
      ])
    ) {
      return 'household-appliance';
    }

    return 'general-consumer-product';
  }

  if (
    textHasAny(text, [
      'baby',
      'babies',
      'infant',
      'child',
      'children',
      'crib',
      'stroller',
      'high chair',
      'toy',
      'kids',
      'nursery'
    ])
  ) {
    return 'baby-kids';
  }

  if (
    textHasAny(text, [
      'battery',
      'batteries',
      'lithium',
      'charger',
      'charging',
      'power bank',
      'electronics',
      'adapter',
      'usb',
      'e bike',
      'e scooter'
    ])
  ) {
    return 'battery-electronics';
  }

  if (
    textHasAny(text, [
      'food',
      'allergy',
      'allergen',
      'undeclared',
      'milk',
      'peanut',
      'egg',
      'wheat',
      'soy',
      'tree nut',
      'sesame'
    ])
  ) {
    return 'food-allergy';
  }

  if (
    textHasAny(text, [
      'appliance',
      'air fryer',
      'oven',
      'microwave',
      'range',
      'cooktop',
      'washer',
      'dryer',
      'refrigerator',
      'dehumidifier',
      'heater',
      'fan'
    ])
  ) {
    return 'household-appliance';
  }

  return 'general-consumer-product';
}

function firstNonEmpty(values: string[], fallback: string): string {
  return values.map((value) => value.trim()).find(Boolean) ?? fallback;
}

function uniqueNonEmpty(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function sortByDateDescending(a: SiteRecall, b: SiteRecall): number {
  const dateDifference = b.recallDate.localeCompare(a.recallDate);
  return dateDifference === 0 ? a.id.localeCompare(b.id) : dateDifference;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function safeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isOfficialRecallImageUrl(url: string): boolean {
  return (
    /^https:\/\/www\.cpsc\.gov\//i.test(url) ||
    /^https:\/\/rappel\.conso\.gouv\.fr\/image\//i.test(url) ||
    /^https:\/\/ec\.europa\.eu\/safety-gate-alerts\/public\/api\/notification\/image\//i.test(url)
  );
}

function normalizeImage(value: unknown, fallbackAlt: string): RecallImage | null {
  if (!isObject(value)) {
    return null;
  }

  const url = safeText(value.url) || safeText(value.URL);
  if (!url || !isOfficialRecallImageUrl(url)) {
    return null;
  }

  const caption = safeText(value.caption) || safeText(value.Caption);
  const alt = safeText(value.alt) || safeText(value.AltText) || caption || fallbackAlt;

  return {
    url,
    ...(caption ? { caption } : {}),
    ...(alt ? { alt } : {})
  };
}

function uniqueImages(images: RecallImage[]): RecallImage[] {
  const seen = new Set<string>();
  return images.filter((image) => {
    if (seen.has(image.url)) {
      return false;
    }
    seen.add(image.url);
    return true;
  });
}

function extractRecallImages(record: NormalizedRecall): RecallImage[] {
  const directImages = Array.isArray(record.images) ? record.images : [];
  const rawImages = isObject(record.raw) && Array.isArray(record.raw.Images) ? record.raw.Images : [];
  const fallbackAlt = `${record.title} recall product image`;
  const images = [...directImages, ...rawImages]
    .map((image) => normalizeImage(image, fallbackAlt))
    .filter((image): image is RecallImage => Boolean(image));

  return record.source === 'CPSC' || record.source === 'FR_RAPPELCONSO' || record.source === 'EU_SAFETY_GATE'
    ? uniqueImages(images)
    : [];
}

function toSiteRecallFromProcessed(record: NormalizedRecall): SiteRecall {
  const category = classifyRecall(record);
  const brandNames = uniqueNonEmpty(record.brandNames);
  const normalizedBrands = brandNames.map(normalizeBrandName);
  const displayBrandNames = uniqueNonEmpty(normalizedBrands.map((brand) => brand.displayName));
  const productNames = uniqueNonEmpty(record.productNames);
  const primaryBrandInfo = normalizedBrands[0];
  const primaryBrand = primaryBrandInfo?.displayName ?? `${getRecallSourceLabel(record.source)} record`;
  const primaryProductName = firstNonEmpty(productNames, 'Product not listed');
  const slug = recallSlug(record.title, record.id, {
    productNames,
    brandNames: displayBrandNames
  });
  const images = extractRecallImages(record);
  const primaryImage = images[0];

  return {
    id: record.id,
    source: record.source,
    sourceLabel: getRecallSourceLabel(record.source),
    sourceUrl: record.sourceUrl,
    title: record.title,
    brandNames,
    displayBrandNames,
    primaryBrand,
    primaryBrandRawName: primaryBrandInfo?.rawName ?? '',
    primaryBrandSlug: primaryBrandInfo?.slug ?? '',
    productNames,
    primaryProductName,
    category,
    rawCategory: record.category,
    categoryLabel: categoryLabels[category],
    hazard: record.hazard,
    remedy: record.remedy,
    recallDate: record.recallDate,
    affectedUnits: record.affectedUnits,
    description: record.description,
    slug,
    detailPath: `/recalls/${slug}`,
    classification: record.classification,
    reason: record.reason,
    distributionPattern: record.distributionPattern,
    productQuantity: record.productQuantity,
    recallNumber: record.recallNumber,
    status: record.status,
    images,
    primaryImageUrl: primaryImage?.url,
    primaryImageAlt: primaryImage?.alt ?? primaryImage?.caption
  };
}

function toSiteRecallFromMock(recall: MockRecall): SiteRecall {
  const brand = normalizeBrandName(recall.brand);

  return {
    id: recall.recallNumber,
    source: 'Mock',
    sourceLabel: getRecallSourceLabel('Mock'),
    sourceUrl: '',
    title: recall.title,
    brandNames: [recall.brand],
    displayBrandNames: [brand.displayName],
    primaryBrand: brand.displayName,
    primaryBrandRawName: recall.brand,
    primaryBrandSlug: brand.slug,
    productNames: [recall.productName],
    primaryProductName: recall.productName,
    category: recall.category,
    rawCategory: recall.category,
    categoryLabel: recall.categoryLabel,
    hazard: recall.hazard,
    remedy: recall.remedy,
    recallDate: recall.noticeDate,
    affectedUnits: '',
    description: recall.summary,
    slug: recall.slug,
    detailPath: `/recalls/${recall.slug}`,
    images: []
  };
}

const processedLocalRecalls = Array.isArray(processedFile.records)
  ? processedFile.records.map(toSiteRecallFromProcessed)
  : [];

const fallbackMockRecalls = mockRecalls.map(toSiteRecallFromMock);

export const usingProcessedLocalData = processedLocalRecalls.length > 0;
export const processedLocalRecordCount = processedLocalRecalls.length;
export const processedCpscRecordCount = processedLocalRecalls.filter((recall) => recall.source === 'CPSC').length;
export const processedFdaRecordCount = processedLocalRecalls.filter((recall) => recall.source === 'FDA').length;
export const processedFranceRappelConsoRecordCount = processedLocalRecalls.filter(
  (recall) => recall.source === 'FR_RAPPELCONSO'
).length;
export const processedCanadaRecordCount = processedLocalRecalls.filter((recall) => recall.source === 'CA_RECALLS').length;
export const processedEuSafetyGateRecordCount = processedLocalRecalls.filter(
  (recall) => recall.source === 'EU_SAFETY_GATE'
).length;
export const processedUkFsaRecordCount = processedLocalRecalls.filter((recall) => recall.source === 'UK_FSA').length;
export const usingProcessedCpscData = processedCpscRecordCount > 0;
export const usingProcessedFdaData = processedFdaRecordCount > 0;
export const usingProcessedFranceRappelConsoData = processedFranceRappelConsoRecordCount > 0;
export const usingProcessedCanadaData = processedCanadaRecordCount > 0;
export const usingProcessedEuSafetyGateData = processedEuSafetyGateRecordCount > 0;
export const usingProcessedUkFsaData = processedUkFsaRecordCount > 0;
export const processedActiveSourceCount = [
  usingProcessedCpscData,
  usingProcessedFdaData,
  usingProcessedFranceRappelConsoData,
  usingProcessedCanadaData,
  usingProcessedEuSafetyGateData,
  usingProcessedUkFsaData
].filter(Boolean).length;
export const dataSourceLabel = usingProcessedLocalData
  ? `${processedActiveSourceCount} official source feed${processedActiveSourceCount === 1 ? '' : 's'}`
  : getRecallSourceLabel('Mock');
export const siteRecalls = (usingProcessedLocalData ? processedLocalRecalls : fallbackMockRecalls).sort(
  sortByDateDescending
);

export function getRecallsByCategory(category: SiteRecallCategory): SiteRecall[] {
  return siteRecalls.filter((recall) => recall.category === category);
}

export function getBrandGroups(recalls = siteRecalls): BrandRecallGroup[] {
  const groups = new Map<string, BrandRecallGroup>();

  function brandHash(value: string): string {
    let hash = 0;
    for (const character of value) {
      hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
    }
    return hash.toString(36).slice(0, 6);
  }

  function displayNamesMatch(a: string, b: string): boolean {
    return a.localeCompare(b, undefined, { sensitivity: 'accent' }) === 0;
  }

  function uniqueBrandSlug(baseSlug: string, rawName: string, displayName: string): string {
    const existing = groups.get(baseSlug);
    if (!existing || displayNamesMatch(existing.displayName, displayName)) {
      return baseSlug;
    }

    const suffix = brandHash(rawName);
    const collisionSlug = `${limitSlug(baseSlug, 64)}-${suffix}`;
    const collision = groups.get(collisionSlug);

    return !collision || displayNamesMatch(collision.displayName, displayName)
      ? collisionSlug
      : `${limitSlug(baseSlug, 58)}-${suffix}-${groups.size + 1}`;
  }

  for (const recall of recalls) {
    for (const brand of recall.brandNames) {
      const normalizedBrand = normalizeBrandName(brand);
      const slug = uniqueBrandSlug(
        normalizedBrand.slug,
        normalizedBrand.rawName,
        normalizedBrand.displayName
      );
      if (!slug) {
        continue;
      }

      const existing = groups.get(slug);
      if (existing) {
        if (!existing.recalls.includes(recall)) {
          existing.recalls.push(recall);
        }
        if (!existing.rawNames.includes(normalizedBrand.rawName)) {
          existing.rawNames.push(normalizedBrand.rawName);
        }
      } else {
        groups.set(slug, {
          brand: normalizedBrand.displayName,
          displayName: normalizedBrand.displayName,
          slug,
          rawNames: [normalizedBrand.rawName],
          recalls: [recall]
        });
      }
    }
  }

  return [...groups.values()].sort((a, b) => a.brand.localeCompare(b.brand));
}

export const brandGroups = getBrandGroups();
