import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CLASSIFICATION_EVIDENCE_FIELD_VALUES,
  CLASSIFICATION_METHOD_VALUES,
  HAZARD_TYPE_VALUES,
  PRODUCT_FAMILY_VALUES,
  PRODUCT_TYPE_VALUES,
  RECALL_AUDIENCE_VALUES,
  RECALL_DOMAIN_VALUES,
  RECALL_TAXONOMY_VERSION
} from '../src/data/recall-taxonomy-v2.ts';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));

type Fixture = {
  id: string;
  expectedClassification: {
    taxonomyVersion: string;
    method: string;
    productFamily: string;
    productType: string;
    hazardType: string;
    hazardTags: string[];
    recallDomain: string;
    audience: string[];
    confidence: number;
    needsReview: boolean;
    reason: string;
    evidenceFields: string[];
  };
};

function hasAll<T extends string>(values: readonly T[], required: readonly string[]): string[] {
  return required.filter((value) => !values.includes(value as T));
}

function assert(condition: boolean, message: string, blockers: string[]): void {
  if (!condition) {
    blockers.push(message);
  }
}

async function readText(relativePath: string): Promise<string> {
  return readFile(resolve(projectRoot, relativePath), 'utf8');
}

async function runAudit(): Promise<void> {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const taxonomyDoc = await readText('docs/recall-taxonomy-v2.md');
  const classifierDoc = await readText('docs/llm-recall-classifier-contract.md');
  const fixtures = JSON.parse(await readText('data/samples/recall-taxonomy-v2-examples.json')) as Fixture[];

  assert(RECALL_TAXONOMY_VERSION === 'recall-taxonomy-v2', 'Taxonomy version constant is missing or wrong.', blockers);
  assert(
    CLASSIFICATION_METHOD_VALUES.length > 0,
    'Classification method enum values are missing.',
    blockers
  );
  assert(
    CLASSIFICATION_EVIDENCE_FIELD_VALUES.length > 0,
    'Classification evidence field enum values are missing.',
    blockers
  );

  const requiredFamilies = [
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
  const requiredProductTypes = [
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
  ];
  const requiredHazards = [
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
  ];
  const requiredDomains = ['consumer-product', 'food', 'vehicle', 'medical-health', 'chemical', 'workplace-industrial', 'unknown'];
  const requiredAudiences = [
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
  ];

  for (const [label, missing] of [
    ['productFamily', hasAll(PRODUCT_FAMILY_VALUES, requiredFamilies)],
    ['productType', hasAll(PRODUCT_TYPE_VALUES, requiredProductTypes)],
    ['hazardType', hasAll(HAZARD_TYPE_VALUES, requiredHazards)],
    ['recallDomain', hasAll(RECALL_DOMAIN_VALUES, requiredDomains)],
    ['audience', hasAll(RECALL_AUDIENCE_VALUES, requiredAudiences)]
  ] as const) {
    assert(missing.length === 0, `${label} enum is missing required values: ${missing.join(', ')}`, blockers);
  }

  assert(
    taxonomyDoc.includes('Old category compatibility is not a long-term requirement'),
    'Taxonomy doc must state old category compatibility is not a long-term requirement.',
    blockers
  );
  assert(
    taxonomyDoc.includes('Yamaha UMAX Bistro') && taxonomyDoc.includes('vehicles-mobility'),
    'Taxonomy doc must map Yamaha/Bistro vehicle example to vehicles-mobility.',
    blockers
  );
  assert(
    classifierDoc.includes('Return strict JSON') || classifierDoc.includes('strict JSON'),
    'Classifier contract must require strict JSON.',
    blockers
  );
  assert(
    classifierDoc.includes('fixed enum choices only') || classifierDoc.includes('enum-only'),
    'Classifier contract must require enum-only output.',
    blockers
  );
  assert(
    classifierDoc.includes('reason') && classifierDoc.includes('evidenceFields') && classifierDoc.includes('confidence'),
    'Classifier contract must require reason, evidenceFields, and confidence.',
    blockers
  );
  assert(
    classifierDoc.includes('prefer `unknown`') || classifierDoc.includes('Prefer `unknown`'),
    'Classifier contract must require unknown over hallucination.',
    blockers
  );

  assert(Array.isArray(fixtures) && fixtures.length >= 8, 'Taxonomy fixture must include at least 8 sample cases.', blockers);

  const byId = new Map(fixtures.map((fixture) => [fixture.id, fixture]));
  const yamaha = byId.get('sample-yamaha-umax-bistro')?.expectedClassification;
  assert(
    yamaha?.productFamily === 'vehicles-mobility' && yamaha?.productType === 'golf-cart-utility-vehicle',
    'Yamaha/Bistro fixture must map to vehicles-mobility and golf-cart-utility-vehicle.',
    blockers
  );
  assert(yamaha?.productFamily !== 'food-grocery', 'Yamaha/Bistro fixture must not map to food-grocery.', blockers);

  const allergen = byId.get('sample-undeclared-milk-cookie')?.expectedClassification;
  assert(
    allergen?.productFamily === 'food-grocery' && allergen?.hazardType === 'allergen',
    'Undeclared milk fixture must map to food-grocery + allergen.',
    blockers
  );

  const contamination = byId.get('sample-salmonella-nut-butter')?.expectedClassification;
  assert(
    contamination?.productFamily === 'food-grocery' && contamination?.hazardType === 'contamination-pathogen',
    'Salmonella fixture must map to food-grocery + contamination-pathogen.',
    blockers
  );
  assert(
    contamination?.hazardType !== 'allergen',
    'Contamination fixture must not force allergen hazard type.',
    blockers
  );

  for (const fixture of fixtures) {
    const classification = fixture.expectedClassification;
    if (!PRODUCT_FAMILY_VALUES.includes(classification.productFamily as never)) {
      blockers.push(`${fixture.id} has invalid productFamily ${classification.productFamily}.`);
    }
    if (!PRODUCT_TYPE_VALUES.includes(classification.productType as never)) {
      blockers.push(`${fixture.id} has invalid productType ${classification.productType}.`);
    }
    if (!HAZARD_TYPE_VALUES.includes(classification.hazardType as never)) {
      blockers.push(`${fixture.id} has invalid hazardType ${classification.hazardType}.`);
    }
    if (!RECALL_DOMAIN_VALUES.includes(classification.recallDomain as never)) {
      blockers.push(`${fixture.id} has invalid recallDomain ${classification.recallDomain}.`);
    }
    if (!CLASSIFICATION_METHOD_VALUES.includes(classification.method as never)) {
      blockers.push(`${fixture.id} has invalid method ${classification.method}.`);
    }
    if (classification.taxonomyVersion !== RECALL_TAXONOMY_VERSION) {
      blockers.push(`${fixture.id} has invalid taxonomyVersion ${classification.taxonomyVersion}.`);
    }
    if (typeof classification.confidence !== 'number' || classification.confidence < 0 || classification.confidence > 1) {
      blockers.push(`${fixture.id} confidence must be a number from 0 to 1.`);
    }
    if (!classification.reason.trim()) {
      blockers.push(`${fixture.id} must include a classification reason.`);
    }
    if (!classification.evidenceFields.length) {
      blockers.push(`${fixture.id} must include evidenceFields.`);
    }
    for (const audience of classification.audience) {
      if (!RECALL_AUDIENCE_VALUES.includes(audience as never)) {
        blockers.push(`${fixture.id} has invalid audience ${audience}.`);
      }
    }
    for (const evidenceField of classification.evidenceFields) {
      if (!CLASSIFICATION_EVIDENCE_FIELD_VALUES.includes(evidenceField as never)) {
        blockers.push(`${fixture.id} has invalid evidence field ${evidenceField}.`);
      }
    }
  }

  if (!taxonomyDoc.includes('Do not implement these routes in Phase 41')) {
    warnings.push('Taxonomy doc does not explicitly state future UI routes are not implemented in Phase 41.');
  }

  const result = {
    passed: blockers.length === 0,
    taxonomyVersion: RECALL_TAXONOMY_VERSION,
    fixtureCount: fixtures.length,
    enumCounts: {
      productFamily: PRODUCT_FAMILY_VALUES.length,
      productType: PRODUCT_TYPE_VALUES.length,
      hazardType: HAZARD_TYPE_VALUES.length,
      recallDomain: RECALL_DOMAIN_VALUES.length,
      audience: RECALL_AUDIENCE_VALUES.length,
      methods: CLASSIFICATION_METHOD_VALUES.length,
      evidenceFields: CLASSIFICATION_EVIDENCE_FIELD_VALUES.length
    },
    blockers,
    warnings
  };

  console.log(JSON.stringify(result, null, 2));

  if (blockers.length) {
    process.exitCode = 1;
  }
}

runAudit().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
