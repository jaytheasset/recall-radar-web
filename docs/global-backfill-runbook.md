# Global source backfill runbook

## Current state

Recall Radar currently indexes 901 static records:

- CPSC: 301
- FDA/openFDA: 100
- France RappelConso: 100
- Canada Recalls and Safety Alerts: 100
- EU Safety Gate: 100
- UK FSA Food Alerts: 100
- Australia Product Safety: 100

Phase 24 does not change canonical data. It adds a source registry, a non-mutating source backfill planning command, a generic ignored-output audit, and a global runbook for future launch-time backfill work.

## Why full backfill is deferred

Full source backfills can add thousands of raw records, generated recall pages, brand pages, and large review diffs. Backfills also affect search quality, static build time, canonical data size, and source-specific data quality. Full backfill should happen near launch or in a controlled staging branch, after each source has a dry-run pipeline and an audit-before-merge process.

## Commands

Plan source readiness without fetching or mutating data:

```bash
npm run plan:source-backfills
```

Plan one source:

```bash
npm run plan:source-backfills -- --source=EU_SAFETY_GATE
```

Audit generated backfill chunks if they exist:

```bash
npm run audit:source-backfills
```

If no generated chunks exist, the audit passes with:

```text
No source backfill chunks found; nothing to audit.
```

## Source readiness matrix

| Source | Status | Suggested mode | Main risk |
| --- | --- | --- | --- |
| CPSC | Partial | date-window | No dry-run chunk/checkpoint pipeline yet |
| FDA/openFDA | Ready | date-window, latest-pagination | Large historical count and no image URLs |
| France RappelConso | Partial | latest-pagination, date-window | GTIN-spaced rows and dedupe policy |
| Canada Recalls | Partial | official-download, detail-refresh | Broad feed, sparse fields, detail image calls |
| EU Safety Gate | Partial | latest-pagination, detail-refresh, source-specific investigation | Verbose details and historical endpoint strategy |
| UK FSA | Partial | latest-pagination, detail-refresh, date-window | Detail payload size and pagination strategy |
| Australia Product Safety | Partial | latest-pagination, detail-refresh, source-specific investigation | Full source size, HTML selector drift, and pagination strategy |

## Recommended launch-time backfill order

1. FDA/openFDA: dry-run pipeline exists; choose an audited launch subset before expansion.
2. CPSC: add date-window dry-run and chunk audit next.
3. UK FSA: add pagination and detail-refresh controls.
4. Australia Product Safety: add dry-run pagination and detail refresh controls.
5. France RappelConso: add offset/date filters and recall-level dedupe.
6. Canada Recalls: design official-feed chunking and optional detail refresh.
7. EU Safety Gate: investigate historical/date strategy before full backfill because payloads and images are verbose.

## Source-specific notes

### CPSC

The current CPSC fetch uses the official SaferProducts recall endpoint with `RecallDateStart` and `RecallDateEnd`. Future backfill should use bounded date windows, chunked raw and processed output, and a source-specific audit before any canonical merge.

### FDA/openFDA

FDA food backfill dry-run tooling exists in `scripts/backfill-fda-food.ts`. Keep using `docs/fda-food-backfill-runbook.md` for FDA-specific operations. The openFDA food enforcement endpoint does not provide usable product image URLs in the current API path.

### France RappelConso

The current script fetches a bounded latest slice from the official RappelConso open-data endpoint. Future backfill should add offset/date controls, audit duplicate recall-level records, and decide whether GTIN-spaced rows should be collapsed or preserved.

### Canada Recalls

The current script downloads the official Canada JSON feed, sorts locally, keeps a bounded slice, and performs bounded detail image enrichment. Future backfill should chunk the official feed locally and make detail refresh optional and auditable.

### EU Safety Gate

The current script fetches most recent alerts and official detail payloads. Future full backfill needs source-specific endpoint investigation, because Safety Gate detail payloads and image metadata are verbose. Do not replace the current selected ids without an explicit source refresh phase.

### UK FSA

The current script fetches a bounded list and then detail payloads for each alert notation. Future backfill should add pagination, optional detail refresh, and an audit for batch/date, pack size, allergen/risk details, source ids, and slug collisions.

### Australia Product Safety

The current script reads the official Product Safety Australia recalls page, uses its Drupal AJAX view for a bounded latest listing, and fetches official detail pages for each selected notice. Future full backfill should page into ignored chunks, audit selector stability, and review generated route count before canonical expansion.

## Output directory policy

Generated backfill output belongs under:

```text
data/backfill/cpsc/
data/backfill/fda-food/
data/backfill/rappelconso/
data/backfill/canada/
data/backfill/eu-safety-gate/
data/backfill/uk-fsa/
data/backfill/australia-product-safety/
```

Generated `.json`, `.jsonl`, `.tmp`, and `.log` files under those directories are ignored by `.gitignore`. Only tiny `README.md` or `.gitkeep` placeholders should ever be committed.

## Chunk, checkpoint, and manifest policy

Future source-specific pipelines should write:

- raw chunks
- processed chunks
- checkpoints
- optional manifests

Generated chunks and checkpoints should stay ignored. A manifest should also stay ignored unless it is a tiny documented sample intentionally reviewed as documentation.

## Audit-before-merge policy

Before canonical merge, every source backfill should verify:

- JSON parse and records array shape
- source id stability
- required normalized fields
- duplicate ids
- slug collisions
- invalid dates
- source-specific missing field counts
- source URL shape
- generated static page count
- build time and output size

Run `npm run audit:source-backfills` for ignored chunks and source-specific audits before any merge.

## No large files in git

Do not commit generated source backfill chunks, checkpoints, or manifests. Before commit:

```bash
git status --short
git diff --stat
```

Generated files under `data/backfill/` should remain ignored and untracked.

## Canonical merge policy

Canonical files must stay unchanged until a separate reviewed source expansion phase approves:

- selected source scope
- dedupe policy
- expected source counts
- static route growth
- build-time impact
- rollback plan

Do not change `data/processed/recalls.json` during planning-only phases.

## Rollback plan

For planning-only or dry-run phases, rollback is usually deleting local ignored files under `data/backfill/`. If a future phase intentionally expands canonical data, rollback should restore previous committed raw, processed, and canonical files together and rerun all source audits plus `npm run validate:launch`.

## Launch-time checklist

- Run source-specific dry-run commands.
- Review generated chunk size and count.
- Run `npm run audit:source-backfills`.
- Run source-specific audits.
- Confirm counts and source filter values are expected.
- Confirm no generated chunks are staged.
- Run `npm run check`, `npm run build`, and `npm run validate:launch`.
- Document canonical count changes in the commit.

## Source-specific future phases

- Additional Asia/Oceania source prototype after Phase 31 discovery, likely `KR_SAFETYKOREA` or another officially accessible source after access verification
- CPSC backfill pipeline
- RappelConso backfill pipeline
- Canada backfill pipeline
- EU Safety Gate backfill pipeline
- UK FSA backfill pipeline
- Australia Product Safety backfill pipeline
- Canonical launch subset selection
- Cross-source dedupe review

## Image limitations

Do not add image scraping as part of global backfill. Image work should remain source-specific and official-source-only. FDA and UK FSA currently do not provide normalized product-card images. Canada and EU image recovery use official source pages/endpoints and should stay bounded and auditable.
