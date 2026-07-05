# Classification DB Write Preview

This phase defines the write shape for classified Taxonomy V2 records without writing to a database, canonical JSON, or runtime UI.

The preview reads:

- `outputs/llm-classifier/full-source-specific-preview/full-source-specific-classifier-results.json`
- `data/processed/recalls.json` for id/source/count validation only

It writes ignored local artifacts under:

- `outputs/llm-classifier/db-write-preview/`

Generated files:

- `classification-run.json`
- `recall-classifications.json`
- `classification-db-write-preview-summary.json`
- `classification-db-write-preview.md`
- `classification-db-write-preview-audit.json`
- `classification-db-write-preview-audit.md`

## Commands

```bash
npm run preview:classification-db-write
npm run audit:classification-db-write-preview
```

## Target Write Contract

The preview shapes data as two future table-style payloads:

- `classification_runs`: one row describing the classifier run, model, prompt version, counts, quality metrics, source counts, and cost estimate.
- `recall_classifications`: one row per recall id with the Taxonomy V2 classification, source trace, model metadata, quality flags, and review status.

This is a staging/review contract only. The existing future `recalls.classification` JSONB plan remains the canonical record target after a separate migration phase.

## Review Status

Rows are marked as:

- `auto-accept-candidate`: confidence is at least `0.75`, `needsReview` is false, and product family is not `unknown`.
- `manual-review-candidate`: confidence is below the gate, `needsReview` is true, or product family is `unknown`.
- `failed`: source classifier output failed validation.

These labels do not write decisions. They are only a review queue preview.

## Audit Blocks

The audit blocks if:

- output files are missing
- preview status is not `preview`
- `dbWrites` is not false
- `canonicalDataWrites` is not false
- rows do not match canonical recall ids
- source counts differ from canonical data
- duplicate `runId` and `recallId` rows exist
- required fields are missing
- taxonomy enum values are invalid
- raw payloads are included in classification rows
- generated outputs are tracked by git
- `data/raw` or `data/processed` changed

## Explicitly Deferred

- no database connection
- no database insert
- no DB migration
- no canonical `data/processed/recalls-v2.json`
- no runtime loader migration
- no UI/category/search migration
- no new LLM calls
