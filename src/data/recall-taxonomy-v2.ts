export const RECALL_TAXONOMY_VERSION = 'recall-taxonomy-v2' as const;

export const PRODUCT_FAMILY_VALUES = [
  'food-grocery',
  'baby-kids',
  'electronics-batteries',
  'home-appliances',
  'furniture-household',
  'vehicles-mobility',
  'sports-outdoor',
  'tools-equipment',
  'clothing-accessories',
  'health-personal-care',
  'chemicals-cleaning',
  'pet-products',
  'industrial-workplace',
  'other',
  'unknown'
] as const;

export type ProductFamily = (typeof PRODUCT_FAMILY_VALUES)[number];

export const PRODUCT_TYPE_VALUES = [
  'packaged-food',
  'beverage',
  'dairy',
  'meat-seafood',
  'snacks-bakery',
  'infant-food',
  'supplement-like-food',
  'food-other',
  'toy',
  'stroller-pram',
  'nursery-gear',
  'child-furniture',
  'child-clothing',
  'school-product',
  'baby-kids-other',
  'battery',
  'charger',
  'power-bank',
  'appliance-electrical',
  'lighting',
  'electronic-accessory',
  'electronics-other',
  'kitchen-appliance',
  'laundry-appliance',
  'heater',
  'air-conditioner-fan',
  'home-fixture',
  'home-appliance-other',
  'furniture',
  'bedding',
  'cookware',
  'tableware',
  'household-product',
  'household-other',
  'passenger-vehicle',
  'golf-cart-utility-vehicle',
  'atv-off-road',
  'bicycle',
  'scooter',
  'mobility-device',
  'trailer',
  'vehicle-accessory',
  'vehicles-other',
  'exercise-equipment',
  'camping-outdoor',
  'pool-water-sports',
  'helmet-protective-gear',
  'sports-other',
  'power-tool',
  'hand-tool',
  'ladder',
  'machinery-equipment',
  'tools-other',
  'clothing',
  'footwear',
  'jewelry-accessory',
  'bag-luggage',
  'clothing-accessory-other',
  'cosmetic',
  'personal-care-product',
  'medical-device-consumer',
  'hygiene-product',
  'health-personal-care-other',
  'cleaning-product',
  'detergent',
  'pesticide',
  'chemical-product',
  'chemicals-cleaning-other',
  'pet-food',
  'pet-toy',
  'pet-equipment',
  'pet-product-other',
  'other',
  'unknown'
] as const;

export type ProductType = (typeof PRODUCT_TYPE_VALUES)[number];

export const HAZARD_TYPE_VALUES = [
  'allergen',
  'contamination-pathogen',
  'contamination-chemical',
  'foreign-matter',
  'choking',
  'suffocation',
  'strangulation',
  'fire',
  'burn',
  'electric-shock',
  'battery-overheat',
  'injury',
  'fall',
  'laceration',
  'entrapment',
  'poisoning',
  'chemical-exposure',
  'crash',
  'drowning',
  'labeling-error',
  'regulatory-noncompliance',
  'quality-defect',
  'unknown'
] as const;

export type HazardType = (typeof HAZARD_TYPE_VALUES)[number];

export const RECALL_DOMAIN_VALUES = [
  'consumer-product',
  'food',
  'vehicle',
  'medical-health',
  'chemical',
  'workplace-industrial',
  'unknown'
] as const;

export type RecallDomain = (typeof RECALL_DOMAIN_VALUES)[number];

export const RECALL_AUDIENCE_VALUES = [
  'general',
  'children',
  'infants',
  'allergy-sensitive-consumers',
  'elderly',
  'pregnant-people',
  'pet-owners',
  'workers',
  'outdoor-users',
  'vehicle-users',
  'unknown'
] as const;

export type RecallAudience = (typeof RECALL_AUDIENCE_VALUES)[number];

export const CLASSIFICATION_METHOD_VALUES = ['llm', 'manual', 'rule', 'source', 'unknown'] as const;

export type ClassificationMethod = (typeof CLASSIFICATION_METHOD_VALUES)[number];

export const CLASSIFICATION_EVIDENCE_FIELD_VALUES = [
  'title',
  'productNames',
  'brandNames',
  'category',
  'hazard',
  'remedy',
  'description',
  'rawSourceCategory',
  'source',
  'sourceUrl',
  'identifiers'
] as const;

export type ClassificationEvidenceField = (typeof CLASSIFICATION_EVIDENCE_FIELD_VALUES)[number];

export type RecallClassificationV2 = {
  taxonomyVersion: typeof RECALL_TAXONOMY_VERSION;
  method: ClassificationMethod;
  model?: string;
  promptVersion?: string;
  productFamily: ProductFamily;
  productType: ProductType;
  hazardType: HazardType;
  hazardTags: string[];
  recallDomain: RecallDomain;
  audience: RecallAudience[];
  confidence: number;
  needsReview: boolean;
  reason: string;
  evidenceFields: ClassificationEvidenceField[];
};

export type LlmRecallClassificationOutput = {
  taxonomyVersion: typeof RECALL_TAXONOMY_VERSION;
  productFamily: ProductFamily;
  productType: ProductType;
  hazardType: HazardType;
  hazardTags: string[];
  recallDomain: RecallDomain;
  audience: RecallAudience[];
  confidence: number;
  needsReview: boolean;
  reason: string;
  evidenceFields: ClassificationEvidenceField[];
};
