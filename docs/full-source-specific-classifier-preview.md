# Full Source-Specific Classifier Preview

This preview runs Gemini classification across the current canonical recall set using source-specific input blocks.

It is a preview/audit step only:

- does not write Taxonomy V2 values to `data/raw`
- does not write Taxonomy V2 values to `data/processed`
- does not write to a database
- does not change runtime UI
- writes generated outputs only under ignored `outputs/llm-classifier/full-source-specific-preview/`

## Commands

```bash
npm run classify:recalls:taxonomy-v2:full-source-specific-preview
npm run audit:full-source-specific-classifier-preview
```

The classifier command expects a live provider, usually:

```bash
RECALL_CLASSIFIER_PROVIDER=gemini
RECALL_CLASSIFIER_MODEL=gemini-2.5-flash-lite
```

Local `.env` files may provide those values. Do not commit `.env` files.

## Output files

Ignored local outputs:

- `full-source-specific-classifier-results.json`
- `full-source-specific-classifier-summary.json`
- `full-source-specific-classifier-quality-report.md`
- `full-source-specific-classifier-review-candidates.json`
- `full-source-specific-classifier-failures.json`
- `full-source-specific-classifier-audit.json`
- `full-source-specific-classifier-audit.md`

## Quality audit

The audit blocks on:

- incomplete run
- classifier failures
- source count mismatch
- duplicate result ids
- committed generated outputs
- canonical data changes

It reports, but does not block on, quality review metrics such as:

- `needsReview`
- low confidence
- unknown product family/type/hazard
- source/domain mismatches
- evidence field alias repairs

Review these outputs before any phase writes classification values to a database or canonical V2 classification block.

The next local-only gate is the classification DB write preview:

```bash
npm run preview:classification-db-write
npm run audit:classification-db-write-preview
```

That step shapes the ignored classifier results into future `classification_runs` and `recall_classifications` payloads without writing to a database or canonical data.
