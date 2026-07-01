import processedRecallData from '../../data/processed/recalls.json';
import { mockRecalls, type MockRecall, type RecallCategory } from '../data/mock-recalls';
import type { NormalizedRecall, ProcessedRecallFile } from '../data/recall-types';
import { normalizeBrandName } from './brand-normalize';
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
    label: 'Baby Product Recalls',
    category: 'baby-kids',
    description: 'Browse baby, infant, nursery, and kids recalls from local data.'
  },
  {
    href: '/battery-recalls',
    label: 'Battery & Electronics Recalls',
    category: 'battery-electronics',
    description: 'Browse battery, charger, lithium-ion, and electronics recalls from local data.'
  },
  {
    href: '/food-allergy-recalls',
    label: 'Food Allergy Recalls',
    category: 'food-allergy',
    description: 'Browse food, allergy, and undeclared allergen recalls from local data.'
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

function sourceLabelFor(source: SiteRecallSource): string {
  if (source === 'FDA') {
    return 'Local FDA/openFDA data';
  }

  if (source === 'CPSC') {
    return 'Local CPSC data';
  }

  return 'Mock fallback data';
}

function toSiteRecallFromProcessed(record: NormalizedRecall): SiteRecall {
  const category = classifyRecall(record);
  const brandNames = uniqueNonEmpty(record.brandNames);
  const normalizedBrands = brandNames.map(normalizeBrandName);
  const displayBrandNames = uniqueNonEmpty(normalizedBrands.map((brand) => brand.displayName));
  const productNames = uniqueNonEmpty(record.productNames);
  const primaryBrandInfo = normalizedBrands[0];
  const primaryBrand = primaryBrandInfo?.displayName ?? `${record.source} record`;
  const primaryProductName = firstNonEmpty(productNames, 'Product not listed');
  const slug = recallSlug(record.title, record.id, {
    productNames,
    brandNames: displayBrandNames
  });

  return {
    id: record.id,
    source: record.source,
    sourceLabel: sourceLabelFor(record.source),
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
    status: record.status
  };
}

function toSiteRecallFromMock(recall: MockRecall): SiteRecall {
  const brand = normalizeBrandName(recall.brand);

  return {
    id: recall.recallNumber,
    source: 'Mock',
    sourceLabel: sourceLabelFor('Mock'),
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
    detailPath: `/recalls/${recall.slug}`
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
export const usingProcessedCpscData = processedCpscRecordCount > 0;
export const usingProcessedFdaData = processedFdaRecordCount > 0;
export const dataSourceLabel = usingProcessedLocalData
  ? [
      usingProcessedCpscData ? 'Local CPSC data' : '',
      usingProcessedFdaData ? 'Local FDA/openFDA data' : ''
    ]
      .filter(Boolean)
      .join(' + ')
  : 'Mock fallback data';
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
