import processedRecallData from '../../data/processed/recalls.json';
import { mockRecalls, type MockRecall, type RecallCategory } from '../data/mock-recalls';
import type { NormalizedRecall, ProcessedRecallFile } from '../data/recall-types';
import { brandToSlug, recallSlug } from './slug';

export type SiteRecallCategory = RecallCategory | 'general-consumer-product';
export type SiteRecallSource = 'CPSC' | 'Mock';

export type SiteRecall = {
  id: string;
  source: SiteRecallSource;
  sourceLabel: string;
  sourceUrl: string;
  title: string;
  brandNames: string[];
  primaryBrand: string;
  primaryBrandSlug: string;
  productNames: string[];
  primaryProductName: string;
  category: SiteRecallCategory;
  categoryLabel: string;
  hazard: string;
  remedy: string;
  recallDate: string;
  affectedUnits: string;
  description: string;
  slug: string;
  detailPath: string;
};

export type BrandRecallGroup = {
  brand: string;
  slug: string;
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
    label: 'Battery Recalls',
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
  return b.recallDate.localeCompare(a.recallDate);
}

function toSiteRecallFromCpsc(record: NormalizedRecall): SiteRecall {
  const category = classifyRecall(record);
  const brandNames = uniqueNonEmpty(record.brandNames);
  const productNames = uniqueNonEmpty(record.productNames);
  const primaryBrand = firstNonEmpty(brandNames, 'CPSC record');
  const primaryProductName = firstNonEmpty(productNames, 'Product not listed');
  const slug = recallSlug(record.title, record.id);

  return {
    id: record.id,
    source: 'CPSC',
    sourceLabel: 'CPSC local data',
    sourceUrl: record.sourceUrl,
    title: record.title,
    brandNames,
    primaryBrand,
    primaryBrandSlug: primaryBrand === 'CPSC record' ? '' : brandToSlug(primaryBrand),
    productNames,
    primaryProductName,
    category,
    categoryLabel: categoryLabels[category],
    hazard: record.hazard,
    remedy: record.remedy,
    recallDate: record.recallDate,
    affectedUnits: record.affectedUnits,
    description: record.description,
    slug,
    detailPath: `/recalls/${slug}`
  };
}

function toSiteRecallFromMock(recall: MockRecall): SiteRecall {
  return {
    id: recall.recallNumber,
    source: 'Mock',
    sourceLabel: 'Mock fallback data',
    sourceUrl: '',
    title: recall.title,
    brandNames: [recall.brand],
    primaryBrand: recall.brand,
    primaryBrandSlug: brandToSlug(recall.brand),
    productNames: [recall.productName],
    primaryProductName: recall.productName,
    category: recall.category,
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

const processedCpscRecalls = Array.isArray(processedFile.records)
  ? processedFile.records.map(toSiteRecallFromCpsc)
  : [];

const fallbackMockRecalls = mockRecalls.map(toSiteRecallFromMock);

export const usingProcessedCpscData = processedCpscRecalls.length > 0;
export const processedCpscRecordCount = processedCpscRecalls.length;
export const dataSourceLabel = usingProcessedCpscData ? 'CPSC local data' : 'Mock fallback data';
export const siteRecalls = (usingProcessedCpscData ? processedCpscRecalls : fallbackMockRecalls).sort(
  sortByDateDescending
);

export function getRecallsByCategory(category: SiteRecallCategory): SiteRecall[] {
  return siteRecalls.filter((recall) => recall.category === category);
}

export function getBrandGroups(recalls = siteRecalls): BrandRecallGroup[] {
  const groups = new Map<string, BrandRecallGroup>();

  for (const recall of recalls) {
    for (const brand of recall.brandNames) {
      const slug = brandToSlug(brand);
      if (!slug) {
        continue;
      }

      const existing = groups.get(slug);
      if (existing) {
        existing.recalls.push(recall);
      } else {
        groups.set(slug, { brand, slug, recalls: [recall] });
      }
    }
  }

  return [...groups.values()].sort((a, b) => a.brand.localeCompare(b.brand));
}

export const brandGroups = getBrandGroups();
