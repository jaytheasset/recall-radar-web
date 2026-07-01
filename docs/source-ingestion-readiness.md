# Source Ingestion Readiness

This document describes how Recall Radar currently prepares recall source data and what a future official source connector must provide before it becomes active coverage.

## A. Current Development State

Recall Radar currently uses local JSON files only. The current seed sources are:

- CPSC consumer product recalls: 301 records
- FDA/openFDA food enforcement recalls: 100 records
- France RappelConso product recalls: 100 records
- Canonical merged file: `data/processed/recalls.json`
- Total current records: 501

The UI is positioned for a global consumer recall search experience. France RappelConso is included as the first non-U.S. source spike, but the site remains static/local-first and does not use a backend, database, email service, account system, or browser runtime API call.

## B. Current Source Flow

The existing source flow is:

1. Raw or fetched source data is saved under `data/raw/`.
   - CPSC raw file: `data/raw/cpsc-recalls.json`
   - FDA/openFDA raw file: `data/raw/fda-food-recalls.json`
   - France RappelConso raw file: `data/raw/rappelconso-recalls.json`
2. Source-specific normalization scripts map raw records into `NormalizedRecall`.
   - CPSC normalizer: `scripts/normalize-cpsc.ts`
   - FDA/openFDA normalizer: `scripts/normalize-fda-food.ts`
   - France RappelConso normalizer: `scripts/normalize-rappelconso.ts`
3. Source-specific processed files are written under `data/processed/`.
   - CPSC processed file: `data/processed/cpsc-recalls.json`
   - FDA/openFDA processed file: `data/processed/fda-recalls.json`
   - France RappelConso processed file: `data/processed/rappelconso-recalls.json`
4. `scripts/merge-recalls.ts` merges source-specific processed files into the canonical file.
   - Canonical processed file: `data/processed/recalls.json`
5. `src/data/recall-types.ts` defines the shared `NormalizedRecall` and `ProcessedRecallFile` contract.
6. `src/lib/recall-data.ts` loads `data/processed/recalls.json` at build time and maps normalized records into the site recall model.
7. `src/lib/recall-search.ts` builds search match behavior for the checker page.
8. `src/lib/recall-detail-view.ts` extracts source-specific detail fields for recall report pages.
9. Astro pages render homepage, checker, detail pages, brand pages, category pages, and watchlist UI from the build-time site recall model.

Current package scripts:

- `npm run fetch:cpsc`
- `npm run normalize:cpsc`
- `npm run fetch:fda-food`
- `npm run normalize:fda-food`
- `npm run fetch:rappelconso`
- `npm run normalize:rappelconso`
- `npm run data:rappelconso:fetch`
- `npm run data:rappelconso:normalize`
- `npm run data:merge`
- `npm run audit:rappelconso`
- `npm run update:rappelconso`
- `npm run build:data`

Do not run fetch scripts in UI or planning phases unless a later task explicitly requests a data refresh.
`npm run update:rappelconso` is an explicit France RappelConso refresh workflow that performs a network fetch and audit; it is not part of `npm run check` or `npm run build`.

## C. Current Source Registry

`src/lib/recall-sources.ts` centralizes current source display and behavior. It controls:

- market/source label
- reason label
- action label
- quantity label
- distribution label
- official source label
- product image placeholder label
- source-specific verification intro
- source-specific verification checklist
- source-specific sparse identification guidance
- official notice verification copy

The registry currently exposes only active seed sources through current coverage helpers:

- `CPSC`
- `FDA`
- `FR_RAPPELCONSO`

Future source planning notes must not become active filters until a real source connector, normalized data, and validation path exist.

## D. Normalized Recall Contract

Future source connectors should normalize records into the existing `NormalizedRecall` type in `src/data/recall-types.ts`.

Required or expected fields:

- `id`: stable source-prefixed id, such as `cpsc-26507` or `fda-H-0950-2026`
- `source`: current source id from `RecallSource`
- `sourceUrl`: official notice URL or official record URL
- `title`: consumer-readable recall title
- `recallDate`: normalized date string, preferably `YYYY-MM-DD`
- `category`: source category or normalized raw category
- `brandNames`: recalling firm, brand, importer, manufacturer, or distributor names where available
- `productNames`: product names, descriptions, or affected product families
- `hazard`: consumer product hazard or food recall reason
- `reason`: optional reason field when the source separates reason from hazard
- `remedy`: action, remedy, status, or instruction summary
- `description`: normalized description text for search and detail extraction
- `affectedUnits`: affected units or quantity summary
- `productQuantity`: quantity when the source provides a structured quantity field
- `images`: official product images where available and allowed
- `primaryImageUrl` and `primaryImageAlt`: optional image convenience fields
- `recallNumber`: official recall, enforcement, campaign, or notice number
- `distributionPattern`: distribution, sold-at, retailer, or market region detail
- `classification`: classification when relevant, such as FDA enforcement classification
- `status`: source status when relevant
- `slug`: stable generated slug for static detail pages
- `raw`: preserved raw payload for source-specific detail extraction

The source-specific raw payload should remain available so `src/lib/recall-detail-view.ts` can extract fields that are not part of the shared contract yet, such as importer, manufacturer, manufactured-in, product UPCs, code information, incidents, product photos, and distribution details.

## E. Source Connector Checklist

Before adding a future official source, define and validate:

- Official source name and responsible agency
- Market code and market label
- API, feed, file, or open-data format
- Terms of use, legal notes, and attribution requirements
- Source id naming and stable id strategy
- Source registry entry in `src/lib/recall-sources.ts`
- Raw payload preservation path under `data/raw/`
- Normalized output path under `data/processed/`
- Normalization mapping into `NormalizedRecall`
- Product identifier fields and extraction strategy
- Image availability, licensing, and allowed hotlink/cache behavior
- Official notice URL mapping
- Source language and translation policy
- Category mapping into current site categories
- Reason/hazard/action/remedy mapping
- Quantity and affected units mapping
- Distribution, sold-at, retailer, or region mapping
- Date parsing and timezone assumptions
- Deduplication strategy across source id, recall number, title, date, and product
- Static detail page smoke URL
- Checker search smoke query
- Brand page smoke URL where brand/company exists
- No safety claims in generated copy or UI

## F. Identifier Readiness Checklist

A future source connector should preserve or extract these identifiers when available:

- GTIN
- UPC
- EAN
- Barcode text
- Model number
- SKU
- Item number
- Lot code
- Batch code
- Expiration date
- Best-by date
- Use-by date
- Manufacture date
- Serial number
- VIN
- NDC
- UDI
- Certification number
- Recall number
- Campaign number

These identifiers should be included in normalized fields when there is an obvious shared field, and otherwise preserved in `raw` for detail extraction and search match reasons.

## G. Future Source Priority Notes

France RappelConso is now active as the first non-U.S. source spike. Future candidates to evaluate as planning notes only:

- Canada Recalls and Safety Alerts
- EU Safety Gate
- UK FSA
- Korea SafetyKorea / MFDS
- Australia Product Safety
- Japan Consumer Affairs Agency

These are not active filters or active coverage in this phase. They should not appear in consumer-facing source filters until real data ingestion, source labels, validation, and product detail behavior are implemented.

## H. Non-Goals

This phase does not add:

- Additional API ingestion beyond the current CPSC, FDA/openFDA, and RappelConso scripts
- Additional countries as active coverage
- Backend services
- Database storage
- Alerts or email sending
- LLM features
- Product registration
- User accounts
- Affiliate or referral behavior
- Fake source coverage
- Runtime source calls from the static site
