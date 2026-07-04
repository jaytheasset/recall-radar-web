# Recall Data Schema V2

Phase 43 finalizes the future normalized recall data schema. It is a planning and type-definition phase only. Runtime pages, canonical JSON, source ids, source counts, and current route behavior are unchanged.

## Product Decision

The current single `category` field is deprecated. It may exist in current test records until migration, but it is not a long-term compatibility requirement.

Future canonical records require a `classification` object using Recall Taxonomy V2. Public UI categories, category routes, filters, SEO groupings, and source-page product type filters should be derived from `classification.productFamily`, `classification.productType`, `classification.hazardType`, and `classification.recallDomain`, not from the old `category` string.

Current test records can be deleted and regenerated later after the classifier and review gate are accepted.

## Current Legacy Category Inventory

The old field is still required by the current runtime and is intentionally not removed in Phase 43:

- `src/data/recall-types.ts` requires `NormalizedRecall.category`.
- All source normalizers write `category` into current processed files.
- `scripts/merge-recalls.ts` preserves the field while merging current processed source files.
- Source audits summarize raw or mapped category distributions.
- `src/lib/recall-data.ts` maps source records into current `SiteRecall.category`, `rawCategory`, and `categoryLabel`.
- `/checker`, category pages, source landing filters, homepage product type cards, category search helpers, and related-recall logic use current category-derived values.
- Phase 42 dry-run sampling and comparison use the field only as legacy evidence.

V2 migration should replace these runtime dependencies after classified data has passed review.

## Final Normalized Record Shape

The future static JSON record should use this top-level shape:

```ts
type NormalizedRecallV2 = {
  schemaVersion: 'recall-data-schema-v2';
  id: string;
  source: RecallSource;
  sourceRecordId?: string;
  sourceUrl: string;
  sourceLabel?: string;
  market?: string;
  agency?: string;
  title: string;
  productNames: string[];
  brandNames: string[];
  recallDate: string;
  lastUpdated?: string;
  description?: string;
  hazard?: string;
  remedy?: string;
  affectedUnits?: string;
  identifiers?: RecallIdentifierV2[];
  images?: RecallImageV2[];
  classification: RecallClassificationV2;
  legacyCategory?: string;
  raw: unknown;
  createdAt?: string;
  updatedAt?: string;
};
```

`legacyCategory` is optional and transitional only. New consumers must not depend on it.

## Classification Object

`classification` is required and uses `RecallClassificationV2`:

- `taxonomyVersion`
- `method`
- `model`
- `promptVersion`
- `productFamily`
- `productType`
- `hazardType`
- `hazardTags`
- `recallDomain`
- `audience`
- `confidence`
- `needsReview`
- `reason`
- `evidenceFields`

The classification object is the source of truth for future browsing and filtering.

## Required Fields

Every future canonical V2 record must include:

- `schemaVersion`
- `id`
- `source`
- `sourceUrl`
- `title`
- `productNames`
- `brandNames`
- `recallDate`
- `classification`
- `raw`

Within `classification`, all Recall Taxonomy V2 required fields must validate against the exported enum values.

## Optional Fields

Optional or source-dependent fields:

- `sourceRecordId`
- `sourceLabel`
- `market`
- `agency`
- `lastUpdated`
- `description`
- `hazard`
- `remedy`
- `affectedUnits`
- `identifiers`
- `images`
- `legacyCategory`
- `createdAt`
- `updatedAt`

Optional arrays should be empty or omitted when the source does not expose reliable values.

## Fields Not Shown Directly To Users

These fields are for validation, traceability, audits, or future admin/review tools:

- `raw`
- `classification.reason` when it reads like internal classifier rationale
- `classification.confidence`
- `classification.needsReview`
- `classification.evidenceFields`
- `classification.model`
- `classification.promptVersion`
- `createdAt`
- `updatedAt`
- `legacyCategory`

User-facing pages may show source-derived fields and human-readable classification labels after review, but should not expose raw payloads or internal classifier mechanics as consumer copy.

## Search Fields

Future search index input should include:

- `title`
- `productNames`
- `brandNames`
- `description`
- `hazard`
- `remedy`
- `affectedUnits`
- `identifiers.value`
- `source`
- `sourceLabel`
- `market`
- `agency`
- `classification.productFamily`
- `classification.productType`
- `classification.hazardType`
- `classification.hazardTags`
- `classification.recallDomain`
- `classification.audience`

The old `category` string should not be part of the future search index except as an internal migration comparison field.

## Filter Fields

Future filter controls should derive from:

- market/source: `source`, `market`, `agency`
- product family: `classification.productFamily`
- product type: `classification.productType`
- hazard: `classification.hazardType`
- recall domain: `classification.recallDomain`
- review/admin status: `classification.needsReview`
- date: `recallDate`

## SEO And Category Page Fields

Future SEO/category pages should derive from:

- product category pages: `classification.productFamily`
- deeper product pages: `classification.productType`
- hazard pages: `classification.hazardType`
- source/country pages: `source`, `market`, `agency`
- food/consumer/vehicle/health grouping: `classification.recallDomain`

Do not create new public category routes until V2 classified data has passed the migration gate.

## Static JSON Strategy

Current canonical data remains `data/processed/recalls.json`.

Phase 44 per-source LLM classification outputs must write ignored review artifacts only:

- `outputs/llm-classifier/per-source/<source-id>-classified.json`
- `outputs/llm-classifier/per-source/<source-id>-report.md`
- `outputs/llm-classifier/per-source/summary.json`
- `outputs/llm-classifier/per-source/review-candidates.json`

Future canonical migration should create `data/processed/recalls-v2.json` only after review. It should not overwrite current `data/processed/recalls.json` until the migration has its own approved phase.

## Migration Gate

Before any V2 classified data becomes canonical:

- all records have `classification`
- enum validation passes
- no invalid taxonomy values exist
- no required fields are missing
- confidence threshold is reviewed
- `needsReview` records are exported
- known bad legacy category cases are fixed by classification
- food/general product separation is verified
- source counts are preserved
- no raw HTML appears in visible fields
- no safety claims are introduced
- category routes are derived from `productFamily`
- hazard filters are derived from `hazardType`

Initial rule:

- `confidence >= 0.75` and `needsReview === false` can be auto-accepted.
- `confidence < 0.75` or `needsReview === true` requires review.
- `productFamily === 'unknown'` requires review.
- `hazardType === 'unknown'` may be allowed but must be counted and reviewed by source.

## Migration Path

1. Keep current test data and runtime behavior unchanged.
2. Run Phase 44 per-source classification into ignored outputs.
3. Review per-source reports, low-confidence records, and unknown-heavy distributions.
4. Adjust taxonomy or prompt only through reviewed schema/prompt phases.
5. Generate `data/processed/recalls-v2.json` in a separate migration phase.
6. Add V2 runtime loader behind a separate reviewed branch.
7. Migrate category/search/filter pages to classification-derived fields.
8. Remove long-term dependency on the old `category` field.
