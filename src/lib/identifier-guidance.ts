import type { CurrentCoverageSourceId } from './recall-sources.ts';

export const GENERAL_IDENTIFIER_GUIDANCE =
  'Not every recall notice includes a barcode. Try a brand, product name, model number, lot or batch code, date mark, pack size, certification number, recall number, or another identifier from the product or packaging.';

export const IDENTIFIER_SEARCH_PLACEHOLDER =
  'Search by brand, product, model, barcode, lot, date, or recall number';

export const NO_RESULT_IDENTIFIER_HINT =
  'No indexed notices match this search. This does not mean the product is safe or recall-free. Identifier names vary by source, so try another brand, model, barcode, lot or batch code, date mark, pack size, certification number, recall number, ingredient, or keyword.';

const DEFAULT_SOURCE_IDENTIFIER_GUIDANCE =
  'Identifier details vary by official source. Try brand, product name, model, lot, batch, date, pack size, certification number, or recall number.';

export const SOURCE_IDENTIFIER_GUIDANCE: Record<CurrentCoverageSourceId, string> = {
  CPSC:
    'CPSC notices may identify products by model, item, serial number, UPC, date range, product description, or recall number.',
  FDA:
    'FDA food enforcement records often use recall numbers, product descriptions, lot or code information, distribution details, and product quantity rather than product images or barcodes.',
  FR_RAPPELCONSO:
    'RappelConso notices may include GTIN, lot, batch, date, brand, and product reference details.',
  CA_RECALLS:
    'Canada notices may use product descriptions, company names, model or item details when available. Some records have sparse structured identifiers.',
  EU_SAFETY_GATE:
    'Safety Gate alerts may include barcode, model or type, batch or serial number, alert number, country of origin, and countries concerned.',
  UK_FSA:
    'UK FSA alerts often identify food products by batch code, best-before or use-by date, pack size, allergen or risk, retailer, or distribution details.',
  AU_PRODUCT_SAFETY:
    'Australia Product Safety notices may include model, item, barcode-like, batch, date range, supplier, or retailer details when available.',
  NZ_PRODUCT_SAFETY:
    'New Zealand Product Safety notices may include model, SKU, barcode-like, supplier, retailer, or product detail text when available.',
  HK_CFS:
    'Hong Kong CFS alerts may identify foods by product name, brand, pack size, origin, importer, retailer, batch, or expiry details.',
  FSANZ_FOOD_RECALLS:
    'FSANZ recalls may identify foods by product name, brand, batch, date marking, pack size, allergen, retailer, or distribution details.'
};

function isCurrentCoverageSourceId(source: string): source is CurrentCoverageSourceId {
  return source in SOURCE_IDENTIFIER_GUIDANCE;
}

export function getGeneralIdentifierGuidance(): string {
  return GENERAL_IDENTIFIER_GUIDANCE;
}

export function getIdentifierSearchHint(): string {
  return GENERAL_IDENTIFIER_GUIDANCE;
}

export function getNoResultIdentifierHint(): string {
  return NO_RESULT_IDENTIFIER_HINT;
}

export function getSourceIdentifierGuidance(source: string): string {
  return isCurrentCoverageSourceId(source) ? SOURCE_IDENTIFIER_GUIDANCE[source] : DEFAULT_SOURCE_IDENTIFIER_GUIDANCE;
}

export function getDetailVerificationIdentifierHint(source: string): string {
  return `Product details vary by source. ${getSourceIdentifierGuidance(source)} Compare all available details with the official notice.`;
}
