import {
  CLASSIFICATION_EVIDENCE_FIELD_VALUES,
  CLASSIFICATION_METHOD_VALUES,
  HAZARD_TYPE_VALUES,
  PRODUCT_FAMILY_VALUES,
  PRODUCT_TYPE_VALUES,
  RECALL_AUDIENCE_VALUES,
  RECALL_DOMAIN_VALUES,
  RECALL_TAXONOMY_VERSION,
  type RecallClassificationV2
} from '../src/data/recall-taxonomy-v2.ts';

export type ClassificationValidationResult = {
  ok: boolean;
  errors: string[];
  classification?: RecallClassificationV2;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isAllowed(values: readonly string[], value: unknown): value is string {
  return typeof value === 'string' && values.includes(value);
}

export function parseStrictClassifierJson(rawText: string): ClassificationValidationResult {
  try {
    return validateClassificationOutput(JSON.parse(rawText));
  } catch (error) {
    return {
      ok: false,
      errors: [`Invalid strict JSON: ${error instanceof Error ? error.message : String(error)}`]
    };
  }
}

export function validateClassificationOutput(value: unknown): ClassificationValidationResult {
  const errors: string[] = [];

  if (!isObject(value)) {
    return { ok: false, errors: ['Output is not a JSON object.'] };
  }

  if (value.taxonomyVersion !== RECALL_TAXONOMY_VERSION) {
    errors.push(`taxonomyVersion must be ${RECALL_TAXONOMY_VERSION}.`);
  }
  if (!isAllowed(CLASSIFICATION_METHOD_VALUES, value.method)) {
    errors.push('method is not an allowed value.');
  }
  if (!isAllowed(PRODUCT_FAMILY_VALUES, value.productFamily)) {
    errors.push('productFamily is not an allowed value.');
  }
  if (!isAllowed(PRODUCT_TYPE_VALUES, value.productType)) {
    errors.push('productType is not an allowed value.');
  }
  if (!isAllowed(HAZARD_TYPE_VALUES, value.hazardType)) {
    errors.push('hazardType is not an allowed value.');
  }
  if (!isAllowed(RECALL_DOMAIN_VALUES, value.recallDomain)) {
    errors.push('recallDomain is not an allowed value.');
  }
  if (typeof value.confidence !== 'number' || value.confidence < 0 || value.confidence > 1) {
    errors.push('confidence must be a number between 0 and 1.');
  }
  if (typeof value.needsReview !== 'boolean') {
    errors.push('needsReview must be a boolean.');
  }
  if (typeof value.reason !== 'string' || value.reason.trim().length === 0) {
    errors.push('reason must be a non-empty string.');
  }
  if (typeof value.reason === 'string' && value.reason.length > 320) {
    errors.push('reason must stay short.');
  }

  if (!Array.isArray(value.hazardTags)) {
    errors.push('hazardTags must be an array.');
  } else {
    for (const tag of value.hazardTags) {
      if (typeof tag !== 'string' || tag.length > 60) {
        errors.push('hazardTags must contain short strings only.');
      }
    }
  }

  if (!Array.isArray(value.audience)) {
    errors.push('audience must be an array.');
  } else {
    for (const audience of value.audience) {
      if (!isAllowed(RECALL_AUDIENCE_VALUES, audience)) {
        errors.push(`audience contains invalid value: ${String(audience)}`);
      }
    }
  }

  if (!Array.isArray(value.evidenceFields)) {
    errors.push('evidenceFields must be an array.');
  } else {
    for (const evidenceField of value.evidenceFields) {
      if (!isAllowed(CLASSIFICATION_EVIDENCE_FIELD_VALUES, evidenceField)) {
        errors.push(`evidenceFields contains invalid value: ${String(evidenceField)}`);
      }
    }
  }

  if (typeof value.model !== 'undefined' && typeof value.model !== 'string') {
    errors.push('model must be a string when present.');
  }
  if (typeof value.promptVersion !== 'undefined' && typeof value.promptVersion !== 'string') {
    errors.push('promptVersion must be a string when present.');
  }

  if (errors.length) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    errors: [],
    classification: value as RecallClassificationV2
  };
}
