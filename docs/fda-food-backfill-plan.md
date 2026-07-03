# FDA food enforcement backfill plan

## Current state

Recall Radar currently keeps 100 FDA/openFDA food enforcement records in `data/raw/fda-food-recalls.json` and `data/processed/fda-recalls.json`. The fetch script requests:

```text
https://api.fda.gov/food/enforcement.json?sort=report_date%3Adesc&limit=100
```

That means the FDA source is a latest-record static subset, not a historical backfill. Phase 21 confirmed that `H-0950-2026` parses correctly through the current openFDA response, extraction, date normalization, title/id generation, and normalization filter. If a future specific recall is missing, the likely first question is whether it is included in the selected static subset, not whether the parser failed.

## Available data scope

Use `npm run plan:fda-food-backfill` to query small openFDA metadata and sample pages without mutating project data. The planning script reports `meta.results.total` when available, first sampled pages, selected recall diagnostics, count aggregations, and a rough report-date range estimate.

The script is intentionally read-only. It does not write raw backfill files, processed files, canonical data, routes, slugs, or UI copy.

## Backfill risks

- openFDA paging with `limit` and `skip` is practical for small or medium bounded samples, but large historical scans can run into API result-window limits and rate pressure.
- Fetching all history into one file would make review, audit, retry, and static-site sizing harder.
- Merging thousands of records without selection and audit can create duplicate ids, noisy search results, oversized static output, and weak consumer-facing quality.

## Pagination strategy

For small or medium subsets:

- Use `limit` plus `skip`.
- Keep page size conservative, currently capped at 100 by the planning script.
- Add request pacing and retry behavior before any production backfill script.
- Treat failed pages as retryable chunks, not as a reason to overwrite existing data.

For larger historical coverage:

- Prefer date-windowed queries by `report_date`, then audit against `recall_initiation_date`.
- If openFDA result-window behavior blocks full paging, use smaller year or year-month partitions.
- If official bulk access is needed later, evaluate the official openFDA dataset download path separately.

## Proposed storage strategy

- Store raw FDA food backfill in chunked files by year or year-month, for example `data/raw/fda-food/YYYY-MM.json`.
- Normalize chunks into processed source chunks before any merge.
- Deduplicate by `recall_number`, then `event_id`.
- Keep a manifest with fetched endpoint, count, generatedAt, and audit status per chunk.
- Merge into `data/processed/recalls.json` only after source counts, duplicate ids, required fields, category mapping, and static-site size pass.

## Launch subset strategy

Before full historical FDA coverage is exposed, a larger FDA launch subset should prioritize:

- Class I records first.
- Ongoing records first.
- Recent `report_date` and `recall_initiation_date`.
- Undeclared allergen records.
- Serious pathogen keywords such as Salmonella, Listeria, and E. coli.
- Consumer-facing product descriptions with useful UPC, lot, batch, pack size, or distribution details.
- Specific `recall_number` lookups requested by users, but only through a documented selection policy.

Do not use latest 100 forever as the final policy. Do not blindly add all FDA records without audit. Do not mix one-off diagnostic lookups into canonical data unless the selection policy says they belong in the launch subset.

## Audit requirements

Any future larger FDA subset should verify:

- Total records and per-source counts.
- Source ids and filter values remain stable.
- Duplicate ids, duplicate `recall_number`, and duplicate `event_id`.
- Required fields: sourceUrl, title, recallDate, productNames, brandNames, hazard/reason, raw payload.
- Category mapping for food versus food/allergy.
- Search quality for product, brand, UPC, lot, allergen, and pathogen terms.
- Static route count and build time.

## FDA image limitations

openFDA food enforcement JSON does not provide product image URLs in the fields currently normalized by Recall Radar. Text recall backfill can be solved through the API, but FDA image recovery is separate.

Future FDA image discovery may require mapping enforcement records to official FDA recall, company announcement, or press release pages. Not every enforcement record has a media announcement or product image. This phase does not attempt FDA image recovery.

## Future phases

1. Add a non-mutating FDA date-window planner for a specific year or month.
2. Add a small audited FDA launch-subset generator without changing canonical records by default.
3. Add chunk manifest and duplicate-audit tooling.
4. Decide the product policy for expanding FDA records beyond 100.
5. Investigate official FDA image mapping separately, if needed.
