import taxonomyExamples from '../../data/samples/recall-taxonomy-v2-examples.json' with { type: 'json' };
import type {
  HazardType,
  ProductFamily,
  ProductType,
  RecallClassificationV2,
} from '../data/recall-taxonomy-v2.ts';
import {
  getAudienceLabel,
  getHazardTypeLabel,
  getProductFamilyLabel,
  getProductTypeLabel,
  getRecallDomainLabel,
  getTaxonomyV2CategoryHref,
  PRODUCT_FAMILY_LABELS,
  TAXONOMY_V2_PUBLIC_CATEGORY_ORDER
} from './taxonomy-v2-display.ts';

type TaxonomyExample = {
  id: string;
  input: {
    source: string;
    title: string;
    productNames: string[];
    brandNames: string[];
    rawSourceCategory: string;
    hazard: string;
    remedy: string;
    description: string;
    identifiers: string[];
    sourceUrl: string;
  };
  expectedClassification: RecallClassificationV2;
};

export type TaxonomyV2MenuPreview = {
  productFamily: ProductFamily;
  label: string;
  href: string;
  description: string;
  productTypes: ProductType[];
  hazardFilters: HazardType[];
  sampleCount: number;
};

export type TaxonomyV2PreviewRecord = TaxonomyExample & {
  familyLabel: string;
  productTypeLabel: string;
  hazardTypeLabel: string;
  recallDomainLabel: string;
  audienceLabels: string[];
  futureHref: string;
};

type LabelMap = typeof PRODUCT_FAMILY_LABELS;

const PRODUCT_FAMILY_DESCRIPTIONS: Record<keyof LabelMap, string> = {
  'food-grocery': 'Human food, grocery items, beverages, ingredients, and food-like supplements.',
  'baby-kids': 'Toys, nursery gear, strollers, child furniture, and child-focused products.',
  'electronics-batteries': 'Batteries, chargers, power banks, electronics, and electrical accessories.',
  'home-appliances': 'Kitchen appliances, laundry appliances, heaters, fans, and home fixtures.',
  'furniture-household': 'Furniture, bedding, cookware, tableware, and non-electrical household goods.',
  'vehicles-mobility': 'Golf carts, mobility devices, bicycles, scooters, trailers, and vehicle accessories.',
  'sports-outdoor': 'Exercise equipment, outdoor gear, water products, and protective sports gear.',
  'tools-equipment': 'Power tools, hand tools, ladders, machinery, and equipment.',
  'clothing-accessories': 'Clothing, footwear, jewelry, bags, luggage, and fashion accessories.',
  'health-personal-care': 'Cosmetics, personal care, hygiene products, and consumer medical devices.',
  'chemicals-cleaning': 'Cleaning products, detergents, pesticides, and household chemical products.',
  'pet-products': 'Pet food, pet toys, and pet equipment.',
  'industrial-workplace': 'Workplace-only equipment and industrial products.',
  other: 'Known products that do not fit a listed family.',
  unknown: 'Records that need manual review before a public family is selected.'
};

const PRODUCT_TYPES_BY_FAMILY: Record<ProductFamily, ProductType[]> = {
  'food-grocery': ['packaged-food', 'beverage', 'dairy', 'meat-seafood', 'snacks-bakery', 'infant-food'],
  'baby-kids': ['toy', 'stroller-pram', 'nursery-gear', 'child-furniture', 'child-clothing', 'school-product'],
  'electronics-batteries': ['battery', 'charger', 'power-bank', 'appliance-electrical', 'lighting', 'electronic-accessory'],
  'home-appliances': ['kitchen-appliance', 'laundry-appliance', 'heater', 'air-conditioner-fan', 'home-fixture'],
  'furniture-household': ['furniture', 'bedding', 'cookware', 'tableware', 'household-product'],
  'vehicles-mobility': ['golf-cart-utility-vehicle', 'bicycle', 'scooter', 'mobility-device', 'vehicle-accessory'],
  'sports-outdoor': ['exercise-equipment', 'camping-outdoor', 'pool-water-sports', 'helmet-protective-gear'],
  'tools-equipment': ['power-tool', 'hand-tool', 'ladder', 'machinery-equipment'],
  'clothing-accessories': ['clothing', 'footwear', 'jewelry-accessory', 'bag-luggage'],
  'health-personal-care': ['cosmetic', 'personal-care-product', 'medical-device-consumer', 'hygiene-product'],
  'chemicals-cleaning': ['cleaning-product', 'detergent', 'pesticide', 'chemical-product'],
  'pet-products': ['pet-food', 'pet-toy', 'pet-equipment'],
  'industrial-workplace': ['machinery-equipment', 'tools-other'],
  other: ['other'],
  unknown: ['unknown']
};

const HAZARD_FILTERS_BY_FAMILY: Record<ProductFamily, HazardType[]> = {
  'food-grocery': ['allergen', 'contamination-pathogen', 'contamination-chemical', 'foreign-matter', 'labeling-error'],
  'baby-kids': ['choking', 'suffocation', 'strangulation', 'chemical-exposure', 'injury'],
  'electronics-batteries': ['fire', 'battery-overheat', 'electric-shock', 'burn'],
  'home-appliances': ['fire', 'burn', 'electric-shock', 'injury'],
  'furniture-household': ['entrapment', 'fall', 'injury', 'laceration'],
  'vehicles-mobility': ['crash', 'injury', 'fall'],
  'sports-outdoor': ['injury', 'fall', 'drowning', 'laceration'],
  'tools-equipment': ['injury', 'laceration', 'electric-shock', 'fire'],
  'clothing-accessories': ['chemical-exposure', 'choking', 'strangulation', 'injury'],
  'health-personal-care': ['chemical-exposure', 'contamination-chemical', 'quality-defect', 'labeling-error'],
  'chemicals-cleaning': ['chemical-exposure', 'poisoning', 'labeling-error'],
  'pet-products': ['contamination-pathogen', 'contamination-chemical', 'foreign-matter', 'quality-defect'],
  'industrial-workplace': ['injury', 'laceration', 'electric-shock', 'chemical-exposure'],
  other: ['quality-defect', 'regulatory-noncompliance', 'unknown'],
  unknown: ['unknown']
};

export const taxonomyV2PreviewRecords: TaxonomyV2PreviewRecord[] = (taxonomyExamples as TaxonomyExample[]).map(
  (example) => {
    const classification = example.expectedClassification;

    return {
      ...example,
      familyLabel: getProductFamilyLabel(classification.productFamily),
      productTypeLabel: getProductTypeLabel(classification.productType),
      hazardTypeLabel: getHazardTypeLabel(classification.hazardType),
      recallDomainLabel: getRecallDomainLabel(classification.recallDomain),
      audienceLabels: classification.audience.map(getAudienceLabel),
      futureHref: getTaxonomyV2CategoryHref(classification.productFamily)
    };
  }
);

export const taxonomyV2MenuPreview: TaxonomyV2MenuPreview[] = TAXONOMY_V2_PUBLIC_CATEGORY_ORDER.map(
  (productFamily) => ({
    productFamily,
    label: getProductFamilyLabel(productFamily),
    href: getTaxonomyV2CategoryHref(productFamily),
    description: PRODUCT_FAMILY_DESCRIPTIONS[productFamily],
    productTypes: PRODUCT_TYPES_BY_FAMILY[productFamily],
    hazardFilters: HAZARD_FILTERS_BY_FAMILY[productFamily],
    sampleCount: taxonomyV2PreviewRecords.filter(
      (record) => record.expectedClassification.productFamily === productFamily
    ).length
  })
);

export const selectedHazardFilterPreview = taxonomyV2MenuPreview.filter((item) =>
  ['food-grocery', 'baby-kids', 'electronics-batteries', 'vehicles-mobility', 'chemicals-cleaning'].includes(
    item.productFamily
  )
);

export const taxonomyV2LegacyReplacementMap = [
  {
    current: '/baby-product-recalls',
    future: ['/recalls/baby-kids'],
    note: 'Baby and kids remains a family, with toys, nursery gear, child furniture, and child clothing separated by product type.'
  },
  {
    current: '/battery-recalls',
    future: ['/recalls/electronics-batteries'],
    note: 'Battery and electronics becomes a product family with Fire, Battery overheating, Burn, and Electric shock hazard filters.'
  },
  {
    current: '/food-allergy-recalls',
    future: ['/recalls/food-grocery'],
    note: 'Food and allergy becomes Food & Grocery with separate Allergen, Pathogen contamination, Chemical contamination, Foreign matter, and Labeling issue filters.'
  },
  {
    current: '/household-product-recalls',
    future: [
      '/recalls/home-appliances',
      '/recalls/furniture-household',
      '/recalls/chemicals-cleaning',
      '/recalls/tools-equipment'
    ],
    note: 'Household products split by product family so appliances, furniture, chemicals, and tools can be browsed separately.'
  },
  {
    current: 'Vehicle-like consumer products inside mixed categories',
    future: ['/recalls/vehicles-mobility'],
    note: 'Golf carts, utility vehicles, scooters, bicycles, and mobility devices move to Vehicles & Mobility.'
  }
];
