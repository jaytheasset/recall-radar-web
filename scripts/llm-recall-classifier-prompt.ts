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

export const RECALL_CLASSIFIER_PROMPT_VERSION = 'recall-classifier-v1' as const;

function enumLine(label: string, values: readonly string[]): string {
  return `${label}: ${values.join(', ')}`;
}

export function buildRecallClassifierPrompt(input: RecallClassifierInput, model = ''): string {
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
    'Do not use recallDomain values as productFamily values.',
    'Do not use productType values as productFamily values. productFamily is the broad group; productType is the narrower item type.',
    'For medical devices, diagnostics, assays, hospital equipment, or health products: productFamily must usually be health-personal-care and recallDomain must be medical-health.',
    'For kitchenware, tableware, jars, bottles, or food containers that are not food contents: productFamily must usually be furniture-household and recallDomain must be consumer-product.',
    'For beverages, packaged foods, or food contents: productFamily must be food-grocery.',
    'For chemical products, cement, primer, cleaning products, or pesticides: productFamily must be chemicals-cleaning.',
    'For lighting, laser pointers, appliances, chargers, batteries, or other electrical products: productFamily must usually be electronics-batteries.',
    'For vehicles, golf carts, off-road vehicles, or mobility products: productFamily must usually be vehicles-mobility.',
    'Use unknown when source text is insufficient. Set needsReview true when confidence is low.',
    'The reason must be one short sentence based only on the provided fields.',
    enumLine('productFamily', PRODUCT_FAMILY_VALUES),
    enumLine('productType', PRODUCT_TYPE_VALUES),
    enumLine('hazardType', HAZARD_TYPE_VALUES),
    enumLine('recallDomain', RECALL_DOMAIN_VALUES),
    enumLine('audience', RECALL_AUDIENCE_VALUES),
    enumLine('evidenceFields', CLASSIFICATION_EVIDENCE_FIELD_VALUES),
    'Return JSON with exactly this shape:',
    JSON.stringify(outputTemplate, null, 2),
    'Recall input:',
    JSON.stringify(input, null, 2)
  ].join('\n');
}
