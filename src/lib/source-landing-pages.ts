import type { SiteRecall } from './recall-data';
import { categoryRoutes, siteRecalls } from './recall-data';
import { getRecallSourceLabel, type CurrentCoverageSourceId } from './recall-sources';

export type SourceLandingPageConfig = {
  route: string;
  title: string;
  heading: string;
  eyebrow: string;
  description: string;
  metaDescription: string;
  sourceIds: CurrentCoverageSourceId[];
  searchLabel: string;
  searchPlaceholder: string;
  noResultCopy: string;
};

export type SourceLandingPageCard = SourceLandingPageConfig & {
  count: number;
  sourceLabels: string[];
};

export type SourceLandingProductTypeFilter = {
  category: 'all' | (typeof categoryRoutes)[number]['category'];
  label: string;
  count: number;
  href: string;
};

const SOURCE_PAGE_NO_RESULT_COPY =
  'No indexed notices match this search or product type filter in this source group. This does not mean the product is safe or recall-free. Try another brand, model, barcode, lot, ingredient, hazard, or keyword.';

export const sourceLandingPages: SourceLandingPageConfig[] = [
  {
    route: '/us-product-recalls',
    title: 'United States Product Recalls | Recall Radar',
    heading: 'United States Product Recalls',
    eyebrow: 'United States',
    description: 'Browse indexed CPSC and FDA/openFDA recall notices.',
    metaDescription: 'Browse indexed CPSC and FDA recall notices in Recall Radar.',
    sourceIds: ['CPSC', 'FDA'],
    searchLabel: 'Search within United States notices',
    searchPlaceholder: 'Search product, brand, model, UPC, lot, ingredient, or keyword',
    noResultCopy: SOURCE_PAGE_NO_RESULT_COPY
  },
  {
    route: '/canada-product-recalls',
    title: 'Canada Product Recalls | Recall Radar',
    heading: 'Canada Product Recalls',
    eyebrow: 'Canada',
    description: 'Browse indexed Canada recalls and safety alerts.',
    metaDescription: 'Browse indexed Canada recalls and safety alerts in Recall Radar.',
    sourceIds: ['CA_RECALLS'],
    searchLabel: 'Search within Canada notices',
    searchPlaceholder: 'Search product, brand, model, barcode, alert id, or keyword',
    noResultCopy: SOURCE_PAGE_NO_RESULT_COPY
  },
  {
    route: '/eu-safety-gate-recalls',
    title: 'EU Safety Gate Alerts | Recall Radar',
    heading: 'EU Safety Gate Alerts',
    eyebrow: 'European Union',
    description: 'Browse indexed EU Safety Gate product safety alerts.',
    metaDescription: 'Browse indexed EU Safety Gate product safety alerts in Recall Radar.',
    sourceIds: ['EU_SAFETY_GATE'],
    searchLabel: 'Search within EU Safety Gate alerts',
    searchPlaceholder: 'Search product, brand, model, barcode, risk, reference, or keyword',
    noResultCopy: SOURCE_PAGE_NO_RESULT_COPY
  },
  {
    route: '/france-product-recalls',
    title: 'France Product Recalls | Recall Radar',
    heading: 'France Product Recalls',
    eyebrow: 'France',
    description: 'Browse indexed RappelConso recall notices.',
    metaDescription: 'Browse indexed RappelConso recall notices in Recall Radar.',
    sourceIds: ['FR_RAPPELCONSO'],
    searchLabel: 'Search within France notices',
    searchPlaceholder: 'Search product, brand, GTIN, lot, risk, reference, or keyword',
    noResultCopy: SOURCE_PAGE_NO_RESULT_COPY
  },
  {
    route: '/uk-food-recalls',
    title: 'UK Food Recalls | Recall Radar',
    heading: 'UK Food Recalls',
    eyebrow: 'United Kingdom',
    description: 'Browse indexed UK FSA food alerts.',
    metaDescription: 'Browse indexed UK FSA food alerts in Recall Radar.',
    sourceIds: ['UK_FSA'],
    searchLabel: 'Search within UK food alerts',
    searchPlaceholder: 'Search food, brand, allergen, batch, date, alert reference, or keyword',
    noResultCopy: SOURCE_PAGE_NO_RESULT_COPY
  },
  {
    route: '/australia-product-recalls',
    title: 'Australia Product Recalls | Recall Radar',
    heading: 'Australia Product Recalls',
    eyebrow: 'Australia',
    description: 'Browse indexed Product Safety Australia recall notices.',
    metaDescription: 'Browse indexed Product Safety Australia recall notices in Recall Radar.',
    sourceIds: ['AU_PRODUCT_SAFETY'],
    searchLabel: 'Search within Australia notices',
    searchPlaceholder: 'Search product, brand, model, barcode, supplier, hazard, or keyword',
    noResultCopy: SOURCE_PAGE_NO_RESULT_COPY
  },
  {
    route: '/new-zealand-product-recalls',
    title: 'New Zealand Product Recalls | Recall Radar',
    heading: 'New Zealand Product Recalls',
    eyebrow: 'New Zealand',
    description: 'Browse indexed Product Safety New Zealand recall notices.',
    metaDescription: 'Browse indexed Product Safety New Zealand recall notices in Recall Radar.',
    sourceIds: ['NZ_PRODUCT_SAFETY'],
    searchLabel: 'Search within New Zealand notices',
    searchPlaceholder: 'Search product, brand, model, SKU, supplier, hazard, or keyword',
    noResultCopy: SOURCE_PAGE_NO_RESULT_COPY
  }
];

export function getRecallsBySourceIds(sourceIds: readonly CurrentCoverageSourceId[]): SiteRecall[] {
  return siteRecalls.filter((recall) => sourceIds.includes(recall.source as CurrentCoverageSourceId));
}

export function getSourceLandingPageByRoute(route: string): SourceLandingPageConfig | undefined {
  return sourceLandingPages.find((page) => page.route === route);
}

export function getSourceLandingPageRecalls(page: SourceLandingPageConfig): SiteRecall[] {
  return getRecallsBySourceIds(page.sourceIds);
}

export function getSourceLandingPageCards(): SourceLandingPageCard[] {
  return sourceLandingPages.map((page) => ({
    ...page,
    count: getSourceLandingPageRecalls(page).length,
    sourceLabels: page.sourceIds.map((source) => getRecallSourceLabel(source))
  }));
}

export function getSourceLandingProductTypeFilters(page: SourceLandingPageConfig): SourceLandingProductTypeFilter[] {
  const recalls = getSourceLandingPageRecalls(page);
  const filters: SourceLandingProductTypeFilter[] = [
    {
      category: 'all',
      label: 'All',
      count: recalls.length,
      href: page.route
    }
  ];

  for (const route of categoryRoutes) {
    const count = recalls.filter((recall) => recall.category === route.category).length;
    if (count > 0) {
      filters.push({
        category: route.category,
        label: route.label,
        count,
        href: `${page.route}?category=${route.category}`
      });
    }
  }

  return filters;
}
