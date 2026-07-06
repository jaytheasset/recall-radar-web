import type { HazardType, ProductFamily, ProductType } from '../data/recall-taxonomy-v2';
import type { SiteRecall } from './recall-data';
import {
  getHazardTypeLabel,
  getProductFamilyLabel,
  getProductTypeLabel,
  TAXONOMY_V2_PUBLIC_CATEGORY_ORDER
} from './taxonomy-v2-display';
import { needsTaxonomyReview } from './taxonomy-review';

export type TaxonomyV2CategoryRoute = {
  href: string;
  label: string;
  category: ProductFamily;
  slug: string;
  description: string;
  productTypes: ProductType[];
  hazardFilters: HazardType[];
};

export type TaxonomyV2CategoryPage = TaxonomyV2CategoryRoute & {
  count: number;
  productTypeLabels: string[];
  hazardFilterLabels: string[];
};

const CATEGORY_SLUGS: Record<ProductFamily, string> = {
  'food-grocery': 'food-grocery',
  'baby-kids': 'baby-kids',
  'electronics-batteries': 'electronics-batteries',
  'home-appliances': 'home-appliances',
  'furniture-household': 'furniture-household',
  'vehicles-mobility': 'vehicles-mobility',
  'sports-outdoor': 'sports-outdoor',
  'tools-equipment': 'tools-equipment',
  'clothing-accessories': 'clothing-accessories',
  'health-personal-care': 'health-personal-care',
  'chemicals-cleaning': 'chemicals-cleaning',
  'pet-products': 'pet-products',
  'industrial-workplace': 'industrial-workplace',
  other: 'other',
  unknown: 'need-review'
};

const CATEGORY_DESCRIPTIONS: Record<ProductFamily, string> = {
  'food-grocery': 'Food, beverages, ingredients, allergens, lots, date marks, and grocery products.',
  'baby-kids': 'Toys, nursery gear, strollers, child furniture, clothing, and school products.',
  'electronics-batteries': 'Batteries, chargers, power banks, electronics, lighting, and electrical accessories.',
  'home-appliances': 'Kitchen appliances, laundry appliances, heaters, fans, and home fixtures.',
  'furniture-household': 'Furniture, bedding, cookware, tableware, and non-electrical household products.',
  'vehicles-mobility': 'Passenger vehicles, golf carts, bicycles, scooters, mobility devices, and accessories.',
  'sports-outdoor': 'Exercise equipment, outdoor gear, water products, helmets, and protective equipment.',
  'tools-equipment': 'Power tools, hand tools, ladders, machinery, and equipment.',
  'clothing-accessories': 'Clothing, footwear, jewelry, bags, luggage, and fashion accessories.',
  'health-personal-care': 'Cosmetics, personal care, hygiene products, and consumer medical devices.',
  'chemicals-cleaning': 'Cleaning products, detergents, pesticides, and chemical products.',
  'pet-products': 'Pet food, pet toys, and pet equipment.',
  'industrial-workplace': 'Workplace equipment and industrial products.',
  other: 'Known products that do not fit a listed product family.',
  unknown: 'Records that need review before a public product family is selected.'
};

const PRODUCT_TYPES_BY_FAMILY: Record<ProductFamily, ProductType[]> = {
  'food-grocery': ['packaged-food', 'beverage', 'dairy', 'meat-seafood', 'snacks-bakery', 'infant-food'],
  'baby-kids': ['toy', 'stroller-pram', 'nursery-gear', 'child-furniture', 'child-clothing', 'school-product'],
  'electronics-batteries': ['battery', 'charger', 'power-bank', 'appliance-electrical', 'lighting', 'electronic-accessory'],
  'home-appliances': ['kitchen-appliance', 'laundry-appliance', 'heater', 'air-conditioner-fan', 'home-fixture'],
  'furniture-household': ['furniture', 'bedding', 'cookware', 'tableware', 'household-product'],
  'vehicles-mobility': ['passenger-vehicle', 'golf-cart-utility-vehicle', 'bicycle', 'scooter', 'mobility-device'],
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

export const taxonomyV2CategoryRoutes: TaxonomyV2CategoryRoute[] = TAXONOMY_V2_PUBLIC_CATEGORY_ORDER.map(
  (category) => ({
    category,
    slug: CATEGORY_SLUGS[category],
    href: `/recalls/${CATEGORY_SLUGS[category]}`,
    label: getProductFamilyLabel(category),
    description: CATEGORY_DESCRIPTIONS[category],
    productTypes: PRODUCT_TYPES_BY_FAMILY[category],
    hazardFilters: HAZARD_FILTERS_BY_FAMILY[category]
  })
);

export function getTaxonomyV2CategoryRouteBySlug(slug: string): TaxonomyV2CategoryRoute | undefined {
  return taxonomyV2CategoryRoutes.find((route) => route.slug === slug);
}

export function getTaxonomyV2CategoryHref(productFamily: string): string {
  return taxonomyV2CategoryRoutes.find((route) => route.category === productFamily)?.href ?? '/recalls/need-review';
}

export function recallMatchesTaxonomyCategory(recall: SiteRecall, category: string): boolean {
  if (category === 'unknown') {
    return needsTaxonomyReview(recall);
  }

  return recall.taxonomyProductFamily === category || recall.category === category;
}

export function getTaxonomyV2CategoryPage(route: TaxonomyV2CategoryRoute, recalls: SiteRecall[]): TaxonomyV2CategoryPage {
  return {
    ...route,
    count: recalls.filter((recall) => recallMatchesTaxonomyCategory(recall, route.category)).length,
    productTypeLabels: route.productTypes.map(getProductTypeLabel),
    hazardFilterLabels: route.hazardFilters.map(getHazardTypeLabel)
  };
}

export function getTaxonomyV2CategoryPages(recalls: SiteRecall[]): TaxonomyV2CategoryPage[] {
  return taxonomyV2CategoryRoutes.map((route) => getTaxonomyV2CategoryPage(route, recalls));
}
