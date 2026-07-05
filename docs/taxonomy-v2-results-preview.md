# Taxonomy V2 Results Preview

This development-only page lets the team inspect the full Recall Taxonomy V2 classifier result before any database or canonical data migration.

Route:

```text
/dev/taxonomy-v2-results-preview
```

The page is intentionally not linked from the homepage or public browse flows. It includes `noindex, nofollow` metadata.

## What It Reads

The page reads ignored local preview outputs:

```text
outputs/llm-classifier/full-source-specific-preview/full-source-specific-classifier-results.json
outputs/llm-classifier/db-write-preview/classification-db-write-preview.json
```

It also reads the current canonical processed records only to attach detail links and legacy categories:

```text
data/processed/recalls.json
```

## What It Shows

- classifier run metadata
- provider, model, prompt version, generated time, and estimated cost
- success/failure/review counts
- source, product family, hazard, review-state, and text search filters
- each record's legacy category, V2 product family, product type, hazard type, recall domain, confidence, reason, evidence fields, and detail link

## Boundaries

This page does not change runtime search, public category routing, recall detail pages, or canonical recall data.

It does not write database rows.

It does not write canonical recall data.

It does not call Gemini.

It does not run source fetch, normalize, merge, or backfill scripts.

Generated classifier outputs remain ignored under `outputs/llm-classifier/` and must not be committed.

## Validation

Run:

```bash
npm run audit:taxonomy-v2-results-preview
npm run check
npm run build
```

The audit expects the full source-specific classifier preview to use `recall-classifier-v2`, cover 1,201 records, and have 1,201 successful classifications.
