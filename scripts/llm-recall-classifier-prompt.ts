import {
  CLASSIFICATION_EVIDENCE_FIELD_VALUES,
  HAZARD_TYPE_VALUES,
  PRODUCT_FAMILY_VALUES,
  PRODUCT_TYPE_VALUES,
  RECALL_AUDIENCE_VALUES,
  RECALL_DOMAIN_VALUES,
  RECALL_TAXONOMY_VERSION
} from '../src/data/recall-taxonomy-v2.ts';
import type { RecallClassifierInput } from './build-recall-classifier-input.ts';

export const RECALL_CLASSIFIER_PROMPT_VERSION = 'recall-classifier-v2' as const;

function enumLine(label: string, values: readonly string[]): string {
  return `${label}: ${values.join(', ')}`;
}

export function buildRecallClassifierPromptFromInput(input: unknown, model = '', inputLabel = 'Recall input'): string {
  const outputTemplate = {
    taxonomyVersion: RECALL_TAXONOMY_VERSION,
    method: 'llm',
    model,
    promptVersion: RECALL_CLASSIFIER_PROMPT_VERSION,
    productFamily: 'unknown',
    productType: 'unknown',
    hazardType: 'unknown',
    hazardTags: [],
    recallDomain: 'unknown',
    audience: ['unknown'],
    confidence: 0,
    needsReview: true,
    reason: 'One short source-grounded sentence.',
    evidenceFields: ['title', 'productNames']
  };

  return [
    'You classify official recall notices into Recall Taxonomy V2.',
    'Return strict JSON only. Do not wrap the JSON in markdown. Do not include comments.',
    'Classify only. Do not summarize, judge, advise, or make safety claims.',
    'Never assert product safety status or affected/not-affected status.',
    'Use only the enum values listed below. Never invent enum values.',
    'Parser fields and source categories are evidence only. Do not copy source category text into final taxonomy fields.',
    'Prefer evidence from title, product names, affected product rows, identifiers, hazard/risk text, remedy/action text, and official source category together.',
    'If source evidence conflicts, choose the classification best supported by the concrete product and hazard text, not the broad source feed.',
    'If one source field appears to describe a different product than the title, productNames, and description, treat that field as noisy and classify productFamily/productType from the concrete product evidence.',
    'Do not use recallDomain values as productFamily values.',
    'Do not use productType values as productFamily values. productFamily is the broad group; productType is the narrower item type.',
    'Do not use productFamily values as productType values. If the product is clear but no narrower productType fits, use productType other; use productType unknown only when the product identity is unclear.',
    'For medical devices, diagnostics, assays, hospital equipment, implants, catheters, syringes, resuscitation systems, drugs, or health products: productFamily must usually be health-personal-care and recallDomain must be medical-health.',
    'Do not classify a medical/health record as baby-kids only because the title contains infant, child, pediatric, or neonatal. Use baby-kids only when the recalled product is a consumer child product such as a toy, stroller, nursery item, child furniture, child clothing, school product, or baby care product.',
    'For kitchenware, tableware, jars, bottles, food containers, cake decorations, or household items that are not food contents: productFamily must usually be furniture-household or chemicals-cleaning as appropriate, and recallDomain must usually be consumer-product.',
    'For beverages, packaged foods, ingredients, supplements sold as food, infant formula, allergens, pathogens, foreign matter in food, or food date/lot recalls: productFamily must be food-grocery and recallDomain must be food.',
    'For chemical products, cement, primer, solvents, cleaners, detergents, pesticides, or chemical exposure hazards: productFamily must be chemicals-cleaning.',
    'For lighting, laser pointers, appliances, chargers, batteries, power banks, button-battery products, or other electrical products: productFamily must usually be electronics-batteries.',
    'Use the closest allowed productType instead of unknown when the product text is clear: smoke alarms/detectors and carbon monoxide alarms/detectors -> electronics-other; lamps and night lights -> lighting; mobile, cell, feature, or candybar phones -> electronics-other; electronic headsets, hearing defenders, and speaker-based hearing protection -> electronics-other; waxing kits and wax warmers -> personal-care-product; washing machines -> laundry-appliance; spa/pool drain covers -> pool-water-sports; USB power-supply storage holders -> electronic-accessory; lighters -> other; scuba or diving regulators -> pool-water-sports; vacuum cleaners -> home-appliance-other.',
    'For passenger vehicles, golf carts, off-road vehicles, scooters, bicycles, trailers, mobility products, or vehicle accessories: productFamily must usually be vehicles-mobility.',
    'For source feeds that mix domains, especially Canada, classify from the actual product and official category. Do not assume one feed means one product family.',
    'consumer-product is a recallDomain value, never a productFamily value. If no listed productFamily fits, use productFamily other or unknown.',
    'Do not output ingestion, magnet-ingestion, button-battery-ingestion, or button-battery-overheat as hazardType values. For magnet or small-object ingestion, use choking or injury. For button-battery ingestion, use choking or burn depending on the source risk.',
    'Pick the closest specific productType only when the text clearly supports it. If the product is clear but no listed productType fits, use productType other instead of inventing a new value. Use productType unknown only when the product identity is unclear.',
    'Pick one primary hazardType. Use regulatory-noncompliance for labeling, certification, or standard-compliance failures when no concrete injury mechanism is stated.',
    'Use hazardType unknown only when the source does not state a usable hazard, risk, issue, defect, allergen, contaminant, or noncompliance reason.',
    'Audience must be evidence-based. Use children, infants, allergy-sensitive-consumers, pet-owners, workers, vehicle-users, or other specific audiences only when product intent, affected consumers, or source warning supports it; otherwise use general.',
    'Use unknown when source text is insufficient. Set needsReview true when productFamily is unknown, recallDomain is unknown, confidence is below 0.75, or key product/hazard evidence is missing.',
    'Do not set needsReview true only because productType is unknown when productFamily, recallDomain, and hazardType are well supported.',
    'Confidence guidance: 0.90-0.95 for explicit product and hazard evidence; 0.75-0.89 for good but incomplete evidence; below 0.75 for ambiguous, conflicting, or sparse evidence.',
    'The reason must be one short sentence based only on the provided fields.',
    'If the input contains source-specific field names, classify from those fields but map evidenceFields to the closest allowed generic evidence enum values.',
    'Never output source-specific field names in evidenceFields. Examples: hazardText, riskText, riskDescription, issueText, reasonText, problemText, foodSafetyHazardText, defectText, sourceCategory, sourceCategories, sourceProductCategory, productDescription, affectedProducts, productDetails, importer, retailer, supplierName, actionText, consumerAdvice, measures, recallNumber must be mapped to the closest allowed generic evidenceFields value.',
    'Never output semantic classification field names in evidenceFields. Do not output productFamily, productType, hazardType, recallDomain, audience, confidence, needsReview, reason, or hazardTags as evidenceFields.',
    'Evidence mapping examples: hazardText/riskText/problemText/issueText/reasonText -> hazard; actionText/consumerAdvice/measures -> remedy; productDescription/affectedProducts/productDetails -> productNames or description; supplierName/importer/retailer -> brandNames; sourceCategory/sourceCategories/sourceProductCategory -> rawSourceCategory; recallNumber/barcode/model/batch/date fields -> identifiers.',
    enumLine('productFamily', PRODUCT_FAMILY_VALUES),
    enumLine('productType', PRODUCT_TYPE_VALUES),
    enumLine('hazardType', HAZARD_TYPE_VALUES),
    enumLine('recallDomain', RECALL_DOMAIN_VALUES),
    enumLine('audience', RECALL_AUDIENCE_VALUES),
    enumLine('evidenceFields', CLASSIFICATION_EVIDENCE_FIELD_VALUES),
    'Return JSON with exactly this shape:',
    JSON.stringify(outputTemplate, null, 2),
    `${inputLabel}:`,
    JSON.stringify(input, null, 2)
  ].join('\n');
}

export function buildRecallClassifierPrompt(input: RecallClassifierInput, model = ''): string {
  return buildRecallClassifierPromptFromInput(input, model);
}
