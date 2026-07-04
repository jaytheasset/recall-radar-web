import {
  HAZARD_TYPE_VALUES,
  PRODUCT_FAMILY_VALUES,
  PRODUCT_TYPE_VALUES,
  RECALL_AUDIENCE_VALUES,
  RECALL_DOMAIN_VALUES,
  type HazardType,
  type ProductFamily,
  type ProductType,
  type RecallAudience,
  type RecallDomain
} from '../data/recall-taxonomy-v2.ts';

export const PRODUCT_FAMILY_LABELS: Record<ProductFamily, string> = {
  'food-grocery': 'Food & Grocery',
  'baby-kids': 'Baby & Kids',
  'electronics-batteries': 'Electronics & Batteries',
  'home-appliances': 'Home Appliances',
  'furniture-household': 'Furniture & Household',
  'vehicles-mobility': 'Vehicles & Mobility',
  'sports-outdoor': 'Sports & Outdoor',
  'tools-equipment': 'Tools & Equipment',
  'clothing-accessories': 'Clothing & Accessories',
  'health-personal-care': 'Health & Personal Care',
  'chemicals-cleaning': 'Chemicals & Cleaning',
  'pet-products': 'Pet Products',
  'industrial-workplace': 'Industrial & Workplace',
  other: 'Other',
  unknown: 'Needs Review'
};

export const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  'packaged-food': 'Packaged food',
  beverage: 'Beverage',
  dairy: 'Dairy',
  'meat-seafood': 'Meat & seafood',
  'snacks-bakery': 'Snacks & bakery',
  'infant-food': 'Infant food',
  'supplement-like-food': 'Supplement-like food',
  'food-other': 'Other food',
  toy: 'Toy',
  'stroller-pram': 'Stroller / pram',
  'nursery-gear': 'Nursery gear',
  'child-furniture': 'Child furniture',
  'child-clothing': 'Child clothing',
  'school-product': 'School product',
  'baby-kids-other': 'Other baby or kids product',
  battery: 'Battery',
  charger: 'Charger',
  'power-bank': 'Power bank',
  'appliance-electrical': 'Electrical appliance',
  lighting: 'Lighting',
  'electronic-accessory': 'Electronic accessory',
  'electronics-other': 'Other electronics',
  'kitchen-appliance': 'Kitchen appliance',
  'laundry-appliance': 'Laundry appliance',
  heater: 'Heater',
  'air-conditioner-fan': 'Air conditioner / fan',
  'home-fixture': 'Home fixture',
  'home-appliance-other': 'Other home appliance',
  furniture: 'Furniture',
  bedding: 'Bedding',
  cookware: 'Cookware',
  tableware: 'Tableware',
  'household-product': 'Household product',
  'household-other': 'Other household product',
  'passenger-vehicle': 'Passenger vehicle',
  'golf-cart-utility-vehicle': 'Golf cart / utility vehicle',
  'atv-off-road': 'ATV / off-road vehicle',
  bicycle: 'Bicycle',
  scooter: 'Scooter',
  'mobility-device': 'Mobility device',
  trailer: 'Trailer',
  'vehicle-accessory': 'Vehicle accessory',
  'vehicles-other': 'Other vehicle or mobility product',
  'exercise-equipment': 'Exercise equipment',
  'camping-outdoor': 'Camping / outdoor product',
  'pool-water-sports': 'Pool / water sports product',
  'helmet-protective-gear': 'Helmet / protective gear',
  'sports-other': 'Other sports or outdoor product',
  'power-tool': 'Power tool',
  'hand-tool': 'Hand tool',
  ladder: 'Ladder',
  'machinery-equipment': 'Machinery / equipment',
  'tools-other': 'Other tool or equipment',
  clothing: 'Clothing',
  footwear: 'Footwear',
  'jewelry-accessory': 'Jewelry / accessory',
  'bag-luggage': 'Bag / luggage',
  'clothing-accessory-other': 'Other clothing or accessory',
  cosmetic: 'Cosmetic',
  'personal-care-product': 'Personal care product',
  'medical-device-consumer': 'Consumer medical device',
  'hygiene-product': 'Hygiene product',
  'health-personal-care-other': 'Other health or personal care product',
  'cleaning-product': 'Cleaning product',
  detergent: 'Detergent',
  pesticide: 'Pesticide',
  'chemical-product': 'Chemical product',
  'chemicals-cleaning-other': 'Other chemical or cleaning product',
  'pet-food': 'Pet food',
  'pet-toy': 'Pet toy',
  'pet-equipment': 'Pet equipment',
  'pet-product-other': 'Other pet product',
  other: 'Other',
  unknown: 'Unknown product type'
};

export const HAZARD_TYPE_LABELS: Record<HazardType, string> = {
  allergen: 'Allergen',
  'contamination-pathogen': 'Pathogen contamination',
  'contamination-chemical': 'Chemical contamination',
  'foreign-matter': 'Foreign matter',
  choking: 'Choking',
  suffocation: 'Suffocation',
  strangulation: 'Strangulation',
  fire: 'Fire',
  burn: 'Burn',
  'electric-shock': 'Electric shock',
  'battery-overheat': 'Battery overheating',
  injury: 'Injury',
  fall: 'Fall',
  laceration: 'Cut / laceration',
  entrapment: 'Entrapment',
  poisoning: 'Poisoning',
  'chemical-exposure': 'Chemical exposure',
  crash: 'Crash',
  drowning: 'Drowning',
  'labeling-error': 'Labeling issue',
  'regulatory-noncompliance': 'Regulatory issue',
  'quality-defect': 'Quality defect',
  unknown: 'Unknown hazard'
};

export const RECALL_DOMAIN_LABELS: Record<RecallDomain, string> = {
  'consumer-product': 'Consumer product',
  food: 'Food',
  vehicle: 'Vehicle',
  'medical-health': 'Medical / health',
  chemical: 'Chemical',
  'workplace-industrial': 'Workplace / industrial',
  unknown: 'Unknown domain'
};

export const AUDIENCE_LABELS: Record<RecallAudience, string> = {
  general: 'General consumers',
  children: 'Children',
  infants: 'Infants',
  'allergy-sensitive-consumers': 'Allergy-sensitive consumers',
  elderly: 'Older adults',
  'pregnant-people': 'Pregnant people',
  'pet-owners': 'Pet owners',
  workers: 'Workers',
  'outdoor-users': 'Outdoor users',
  'vehicle-users': 'Vehicle users',
  unknown: 'Unknown audience'
};

export const TAXONOMY_V2_PUBLIC_CATEGORY_ORDER: ProductFamily[] = [
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
];

const PRODUCT_FAMILY_HREFS: Record<ProductFamily, string> = {
  'food-grocery': '/recalls/food-grocery',
  'baby-kids': '/recalls/baby-kids',
  'electronics-batteries': '/recalls/electronics-batteries',
  'home-appliances': '/recalls/home-appliances',
  'furniture-household': '/recalls/furniture-household',
  'vehicles-mobility': '/recalls/vehicles-mobility',
  'sports-outdoor': '/recalls/sports-outdoor',
  'tools-equipment': '/recalls/tools-equipment',
  'clothing-accessories': '/recalls/clothing-accessories',
  'health-personal-care': '/recalls/health-personal-care',
  'chemicals-cleaning': '/recalls/chemicals-cleaning',
  'pet-products': '/recalls/pet-products',
  'industrial-workplace': '/recalls/industrial-workplace',
  other: '/recalls/other',
  unknown: '/recalls/needs-review'
};

export function getProductFamilyLabel(value: string): string {
  return PRODUCT_FAMILY_LABELS[value as ProductFamily] ?? value;
}

export function getProductTypeLabel(value: string): string {
  return PRODUCT_TYPE_LABELS[value as ProductType] ?? value;
}

export function getHazardTypeLabel(value: string): string {
  return HAZARD_TYPE_LABELS[value as HazardType] ?? value;
}

export function getRecallDomainLabel(value: string): string {
  return RECALL_DOMAIN_LABELS[value as RecallDomain] ?? value;
}

export function getAudienceLabel(value: string): string {
  return AUDIENCE_LABELS[value as RecallAudience] ?? value;
}

export function getTaxonomyV2CategoryHref(productFamily: string): string {
  return PRODUCT_FAMILY_HREFS[productFamily as ProductFamily] ?? '/recalls/needs-review';
}

export function missingTaxonomyV2DisplayLabels(): Record<string, string[]> {
  return {
    productFamily: PRODUCT_FAMILY_VALUES.filter((value) => !PRODUCT_FAMILY_LABELS[value]),
    productType: PRODUCT_TYPE_VALUES.filter((value) => !PRODUCT_TYPE_LABELS[value]),
    hazardType: HAZARD_TYPE_VALUES.filter((value) => !HAZARD_TYPE_LABELS[value]),
    recallDomain: RECALL_DOMAIN_VALUES.filter((value) => !RECALL_DOMAIN_LABELS[value]),
    audience: RECALL_AUDIENCE_VALUES.filter((value) => !AUDIENCE_LABELS[value])
  };
}
