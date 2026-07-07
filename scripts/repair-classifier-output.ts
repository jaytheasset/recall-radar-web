import {
  CLASSIFICATION_EVIDENCE_FIELD_VALUES,
  type ClassificationEvidenceField
} from '../src/data/recall-taxonomy-v2.ts';

export type EvidenceFieldRepair = {
  from: string;
  to: ClassificationEvidenceField;
};

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const canonicalEvidenceFields = new Map<string, ClassificationEvidenceField>(
  CLASSIFICATION_EVIDENCE_FIELD_VALUES.map((field) => [normalize(field), field])
);

export function mapEvidenceFieldAlias(value: unknown): ClassificationEvidenceField {
  const text = typeof value === 'string' ? value : '';
  const key = normalize(text);
  const direct = canonicalEvidenceFields.get(key);

  if (direct) {
    return direct;
  }

  if (/(hazard|risk|problem|issue|reason|defect|safetyhazard|allergen|contamination)/.test(key)) {
    return 'hazard';
  }
  if (/(action|remedy|advice|measure|whattodo|instruction)/.test(key)) {
    return 'remedy';
  }
  if (/(productname|productdescription|affectedproduct|productdetail|foodproduct)/.test(key)) {
    return 'productNames';
  }
  if (/(brand|supplier|importer|retailer|firm|company|manufacturer|business)/.test(key)) {
    return 'brandNames';
  }
  if (/(sourcecategory|sourcecategories|sourceproductcategory|sourceproducttype|sourcealerttype|category|classification|alerttype|notificationtype)/.test(key)) {
    return 'rawSourceCategory';
  }
  if (/(url|notice)/.test(key)) {
    return 'sourceUrl';
  }
  if (/(identifier|recallnumber|barcode|upc|gtin|ean|jan|model|batch|lot|date|bestbefore|useby|expiry|code|sku|serial|pack)/.test(key)) {
    return 'identifiers';
  }
  if (/(source|sourcehints|market|officialsource|sourceapi)/.test(key)) {
    return 'source';
  }

  return 'description';
}

export function repairClassifierEvidenceFields(rawText: string): { rawText: string; repairs: EvidenceFieldRepair[] } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return { rawText, repairs: [] };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { rawText, repairs: [] };
  }

  const output = parsed as Record<string, unknown>;
  if (!Array.isArray(output.evidenceFields)) {
    return { rawText, repairs: [] };
  }

  const repairs: EvidenceFieldRepair[] = [];
  const mapped = output.evidenceFields.map((field) => {
    const mappedField = mapEvidenceFieldAlias(field);
    if (typeof field !== 'string' || field !== mappedField) {
      repairs.push({ from: String(field), to: mappedField });
    }
    return mappedField;
  });

  output.evidenceFields = [...new Set(mapped)].slice(0, 8);
  return {
    rawText: JSON.stringify(output),
    repairs
  };
}
