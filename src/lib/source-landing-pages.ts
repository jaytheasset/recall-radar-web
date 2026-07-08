import type { SiteRecall } from './recall-data';
import { categoryRoutes, siteRecalls } from './recall-data';
import { recallMatchesTaxonomyCategory } from './taxonomy-v2-pages';
import { getNoResultIdentifierHint } from './identifier-guidance.ts';
import { getRecallSourceLabel, type CurrentCoverageSourceId } from './recall-sources';

export type SourceLandingPageConfig = {
  route: string;
  title: string;
  heading: string;
  eyebrow: string;
  description: string;
  metaDescription: string;
  sourceIds: CurrentCoverageSourceId[];
  card: {
    title: string;
    agencyLabel: string;
    marketLabel: string;
    domainLabel: string;
    description: string;
    ctaLabel: string;
  };
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
  getNoResultIdentifierHint();

export const sourceLandingPages: SourceLandingPageConfig[] = [
  {
    route: '/us-product-recalls',
    title: 'United States Product Recalls | Recall Radar',
    heading: 'United States Product Recalls',
    eyebrow: 'United States',
    description: 'Browse CPSC and FDA/openFDA recall notices.',
    metaDescription: 'Browse CPSC and FDA recall notices in Recall Radar.',
    sourceIds: ['CPSC', 'FDA'],
    card: {
      title: 'United States',
      agencyLabel: 'CPSC + FDA/openFDA',
      marketLabel: 'United States',
      domainLabel: 'Product + food notices',
      description: 'Product recalls from CPSC and food enforcement notices from FDA/openFDA.',
      ctaLabel: 'Browse US recalls'
    },
    searchLabel: 'Search within United States notices',
    searchPlaceholder: 'Search product, brand, model, lot, date, recall number, or barcode',
    noResultCopy: SOURCE_PAGE_NO_RESULT_COPY
  },
  {
    route: '/canada-product-recalls',
    title: 'Canada Product Recalls | Recall Radar',
    heading: 'Canada Product Recalls',
    eyebrow: 'Canada',
    description: 'Browse Canada recalls and safety alerts.',
    metaDescription: 'Browse Canada recalls and safety alerts in Recall Radar.',
    sourceIds: ['CA_RECALLS'],
    card: {
      title: 'Canada',
      agencyLabel: 'Recalls and Safety Alerts',
      marketLabel: 'Canada',
      domainLabel: 'Product notices',
      description: 'Product recalls and safety alerts from Health Canada.',
      ctaLabel: 'Browse Canada recalls'
    },
    searchLabel: 'Search within Canada notices',
    searchPlaceholder: 'Search product, brand, model, item detail, alert id, or keyword',
    noResultCopy: SOURCE_PAGE_NO_RESULT_COPY
  },
  {
    route: '/eu-safety-gate-recalls',
    title: 'EU Safety Gate Alerts | Recall Radar',
    heading: 'EU Safety Gate Alerts',
    eyebrow: 'European Union',
    description: 'Browse EU Safety Gate product safety alerts.',
    metaDescription: 'Browse EU Safety Gate product safety alerts in Recall Radar.',
    sourceIds: ['EU_SAFETY_GATE'],
    card: {
      title: 'European Union',
      agencyLabel: 'Safety Gate',
      marketLabel: 'European Union',
      domainLabel: 'Product safety alerts',
      description: 'Non-food product safety alerts from Safety Gate.',
      ctaLabel: 'Browse EU alerts'
    },
    searchLabel: 'Search within EU Safety Gate alerts',
    searchPlaceholder: 'Search product, brand, model, batch, alert number, or barcode',
    noResultCopy: SOURCE_PAGE_NO_RESULT_COPY
  },
  {
    route: '/france-product-recalls',
    title: 'France Product Recalls | Recall Radar',
    heading: 'France Product Recalls',
    eyebrow: 'France',
    description: 'Browse RappelConso recall notices.',
    metaDescription: 'Browse RappelConso recall notices in Recall Radar.',
    sourceIds: ['FR_RAPPELCONSO'],
    card: {
      title: 'France',
      agencyLabel: 'RappelConso',
      marketLabel: 'France',
      domainLabel: 'Product + food notices',
      description: 'Consumer product and food recall notices from RappelConso.',
      ctaLabel: 'Browse France recalls'
    },
    searchLabel: 'Search within France notices',
    searchPlaceholder: 'Search product, brand, GTIN, lot, date, reference, or keyword',
    noResultCopy: SOURCE_PAGE_NO_RESULT_COPY
  },
  {
    route: '/uk-food-recalls',
    title: 'UK Food Recalls | Recall Radar',
    heading: 'UK Food Recalls',
    eyebrow: 'United Kingdom',
    description: 'Browse UK FSA food alerts.',
    metaDescription: 'Browse UK FSA food alerts in Recall Radar.',
    sourceIds: ['UK_FSA'],
    card: {
      title: 'United Kingdom',
      agencyLabel: 'FSA Food Alerts',
      marketLabel: 'United Kingdom',
      domainLabel: 'Food alerts',
      description: 'Food alerts and allergy alerts from the UK FSA.',
      ctaLabel: 'Browse UK food alerts'
    },
    searchLabel: 'Search within UK food alerts',
    searchPlaceholder: 'Search food, brand, allergen, batch, date, alert reference, or keyword',
    noResultCopy: SOURCE_PAGE_NO_RESULT_COPY
  },
  {
    route: '/australia-product-recalls',
    title: 'Australia Product Recalls | Recall Radar',
    heading: 'Australia Product Recalls',
    eyebrow: 'Australia',
    description: 'Browse Product Safety Australia recall notices.',
    metaDescription: 'Browse Product Safety Australia recall notices in Recall Radar.',
    sourceIds: ['AU_PRODUCT_SAFETY'],
    card: {
      title: 'Australia',
      agencyLabel: 'Product Safety Australia',
      marketLabel: 'Australia',
      domainLabel: 'General product recalls',
      description: 'General product recalls from Product Safety Australia.',
      ctaLabel: 'Browse Australia recalls'
    },
    searchLabel: 'Search within Australia notices',
    searchPlaceholder: 'Search product, brand, model, batch, supplier, or keyword',
    noResultCopy: SOURCE_PAGE_NO_RESULT_COPY
  },
  {
    route: '/new-zealand-product-recalls',
    title: 'New Zealand Product Recalls | Recall Radar',
    heading: 'New Zealand Product Recalls',
    eyebrow: 'New Zealand',
    description: 'Browse Product Safety New Zealand recall notices.',
    metaDescription: 'Browse Product Safety New Zealand recall notices in Recall Radar.',
    sourceIds: ['NZ_PRODUCT_SAFETY'],
    card: {
      title: 'New Zealand',
      agencyLabel: 'Product Safety',
      marketLabel: 'New Zealand',
      domainLabel: 'General product recalls',
      description: 'General product recalls from Product Safety New Zealand.',
      ctaLabel: 'Browse New Zealand recalls'
    },
    searchLabel: 'Search within New Zealand notices',
    searchPlaceholder: 'Search product, brand, model, SKU, supplier, hazard, or keyword',
    noResultCopy: SOURCE_PAGE_NO_RESULT_COPY
  },
  {
    route: '/hong-kong-food-recalls',
    title: 'Hong Kong Food Recalls | Recall Radar',
    heading: 'Hong Kong Food Recalls',
    eyebrow: 'Hong Kong',
    description: 'Browse Centre for Food Safety food alert and recall notices.',
    metaDescription: 'Browse Hong Kong Centre for Food Safety food alert and recall notices in Recall Radar.',
    sourceIds: ['HK_CFS'],
    card: {
      title: 'Hong Kong',
      agencyLabel: 'Centre for Food Safety',
      marketLabel: 'Hong Kong',
      domainLabel: 'Food alerts',
      description: 'Food alert notices from the Centre for Food Safety.',
      ctaLabel: 'Browse Hong Kong food alerts'
    },
    searchLabel: 'Search within Hong Kong food alerts',
    searchPlaceholder: 'Search food, brand, allergen, batch, best-before date, importer, retailer, or keyword',
    noResultCopy: SOURCE_PAGE_NO_RESULT_COPY
  },
  {
    route: '/australia-new-zealand-food-recalls',
    title: 'FSANZ Food Recalls | Recall Radar',
    heading: 'FSANZ Food Recalls',
    eyebrow: 'Australia & New Zealand food source',
    description: 'Browse food recall notices from Food Standards Australia New Zealand.',
    metaDescription: 'Browse Food Standards Australia New Zealand food recall notices in Recall Radar.',
    sourceIds: ['FSANZ_FOOD_RECALLS'],
    card: {
      title: 'Food Standards Australia New Zealand',
      agencyLabel: 'FSANZ Food Recalls',
      marketLabel: 'Australia & New Zealand',
      domainLabel: 'Food recalls',
      description: 'Food recall notices from Food Standards Australia New Zealand.',
      ctaLabel: 'Browse FSANZ food recalls'
    },
    searchLabel: 'Search within FSANZ food recalls',
    searchPlaceholder: 'Search food, brand, allergen, batch, date marking, state, retailer, or keyword',
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
    const count = recalls.filter((recall) => recallMatchesTaxonomyCategory(recall, route.category)).length;
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
