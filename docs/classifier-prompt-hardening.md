# Classifier Prompt Hardening

This phase updates the Recall Taxonomy V2 classifier prompt from `recall-classifier-v1` to `recall-classifier-v2`.

The change is prompt-only plus validation/docs. It does not write canonical data, write a database, change runtime UI, or run source fetches.

## Why

The full source-specific preview proved that Gemini can produce valid Taxonomy V2 output for all current records, but the prompt needed clearer production rules before any persistence phase:

- parser/source fields are evidence only
- mixed-domain feeds such as Canada must be classified by actual product evidence
- medical/health records must not become baby/kids only because they mention infant or pediatric use
- source-specific categories must not be copied as final taxonomy values
- confidence and `needsReview` thresholds must be explicit
- `productType: unknown` must be allowed when family/domain/hazard are clear but no listed product type fits

## Prompt Version

Current prompt version:

```text
recall-classifier-v2
```

## Required Validation

Run:

```bash
npm run preview:all-classifier-inputs
npm run audit:all-classifier-input-previews
RECALL_CLASSIFIER_PROVIDER=gemini RECALL_CLASSIFIER_MODEL=gemini-2.5-flash-lite npm run classify:recalls:taxonomy-v2:source-specific-dry-run
npm run audit:source-specific-classifier-dry-run
npm run audit:llm-classifier-dry-run
npm run check
npm run build
```

Generated classifier outputs remain ignored under `outputs/llm-classifier/`.

## Deferred

- no full 1201-record reclassification in this prompt-hardening step
- no database insert
- no canonical `recalls-v2.json`
- no runtime UI migration
