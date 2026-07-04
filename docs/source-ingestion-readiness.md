# Source Ingestion Readiness

This document describes how Recall Radar currently prepares recall source data and what a future official source connector must provide before it becomes active coverage.

## A. Current Development State

Recall Radar currently uses local JSON files only. The current seed sources are:

- CPSC consumer product recalls: 301 records
- FDA/openFDA food enforcement recalls: 100 records
- France RappelConso product recalls: 100 records
- Canada Recalls and Safety Alerts: 100 records
- EU Safety Gate dangerous non-food product alerts: 100 records
- UK FSA Food Alerts: 100 records
- Australia Product Safety recalls: 100 records
- New Zealand Product Safety recalls: 100 records
- Hong Kong CFS Food Alerts / Allergy Alerts: 100 records
- Canonical merged file: `data/processed/recalls.json`
- Total current records: 1101

The UI is positioned for a global consumer recall search experience. France RappelConso is included as the first non-U.S. source spike, Canada Recalls and Safety Alerts is included as the second non-U.S. source spike, EU Safety Gate is included as the first regional multi-country source spike, UK FSA Food Alerts is included as the first UK food/allergy-focused source spike, Australia Product Safety is included as the first Oceania source spike, New Zealand Product Safety is included as the second Oceania source spike, and Hong Kong CFS is included as a bounded official food/allergy source spike. The site remains static/local-first and does not use a backend, database, email service, account system, or browser runtime API call.

## B. Current Source Flow

The existing source flow is:

1. Raw or fetched source data is saved under `data/raw/`.
   - CPSC raw file: `data/raw/cpsc-recalls.json`
   - FDA/openFDA raw file: `data/raw/fda-food-recalls.json`
   - France RappelConso raw file: `data/raw/rappelconso-recalls.json`
   - Canada raw file: `data/raw/canada-recalls.json`
   - EU Safety Gate raw file: `data/raw/eu-safety-gate-recalls.json`
   - UK FSA raw file: `data/raw/uk-fsa-alerts.json`
   - Australia Product Safety raw file: `data/raw/australia-product-safety-recalls.json`
   - New Zealand Product Safety raw file: `data/raw/new-zealand-product-safety-recalls.json`
   - Hong Kong CFS raw file: `data/raw/hong-kong-cfs-food-alerts.json`
2. Source-specific normalization scripts map raw records into `NormalizedRecall`.
   - CPSC normalizer: `scripts/normalize-cpsc.ts`
   - FDA/openFDA normalizer: `scripts/normalize-fda-food.ts`
   - France RappelConso normalizer: `scripts/normalize-rappelconso.ts`
   - Canada normalizer: `scripts/normalize-canada-recalls.ts`
   - EU Safety Gate normalizer: `scripts/normalize-eu-safety-gate.ts`
   - UK FSA normalizer: `scripts/normalize-uk-fsa-alerts.ts`
   - Australia Product Safety normalizer: `scripts/normalize-australia-product-safety.ts`
   - New Zealand Product Safety normalizer: `scripts/normalize-new-zealand-product-safety.ts`
   - Hong Kong CFS normalizer: `scripts/normalize-hong-kong-cfs-food-alerts.ts`
3. Source-specific processed files are written under `data/processed/`.
   - CPSC processed file: `data/processed/cpsc-recalls.json`
   - FDA/openFDA processed file: `data/processed/fda-recalls.json`
   - France RappelConso processed file: `data/processed/rappelconso-recalls.json`
   - Canada processed file: `data/processed/canada-recalls.json`
   - EU Safety Gate processed file: `data/processed/eu-safety-gate-recalls.json`
   - UK FSA processed file: `data/processed/uk-fsa-alerts.json`
   - Australia Product Safety processed file: `data/processed/australia-product-safety-recalls.json`
   - New Zealand Product Safety processed file: `data/processed/new-zealand-product-safety-recalls.json`
   - Hong Kong CFS processed file: `data/processed/hong-kong-cfs-food-alerts.json`
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
- `npm run fetch:canada`
- `npm run normalize:canada`
- `npm run fetch:eu-safety-gate`
- `npm run normalize:eu-safety-gate`
- `npm run fetch:uk-fsa`
- `npm run normalize:uk-fsa`
- `npm run fetch:australia-product-safety`
- `npm run normalize:australia-product-safety`
- `npm run fetch:new-zealand-product-safety`
- `npm run normalize:new-zealand-product-safety`
- `npm run fetch:hong-kong-cfs`
- `npm run normalize:hong-kong-cfs`
- `npm run debug:hong-kong-cfs-access`
- `npm run debug:new-zealand-product-safety-access`
- `npm run debug:korea-safetykorea-access`
- `npm run audit:korea-safetykorea-contract`
- `npm run data:rappelconso:fetch`
- `npm run data:rappelconso:normalize`
- `npm run data:canada:fetch`
- `npm run data:canada:normalize`
- `npm run data:eu-safety-gate:fetch`
- `npm run data:eu-safety-gate:normalize`
- `npm run data:uk-fsa:fetch`
- `npm run data:uk-fsa:normalize`
- `npm run data:australia-product-safety:fetch`
- `npm run data:australia-product-safety:normalize`
- `npm run data:new-zealand-product-safety:fetch`
- `npm run data:new-zealand-product-safety:normalize`
- `npm run data:hong-kong-cfs:fetch`
- `npm run data:hong-kong-cfs:normalize`
- `npm run data:merge`
- `npm run audit:sources`
- `npm run audit:rappelconso`
- `npm run audit:canada`
- `npm run audit:eu-safety-gate`
- `npm run audit:uk-fsa`
- `npm run audit:australia-product-safety`
- `npm run audit:new-zealand-product-safety`
- `npm run audit:hong-kong-cfs`
- `npm run update:rappelconso`
- `npm run update:canada`
- `npm run update:eu-safety-gate`
- `npm run update:uk-fsa`
- `npm run update:australia-product-safety`
- `npm run update:new-zealand-product-safety`
- `npm run update:hong-kong-cfs`
- `npm run build:data`

Do not run fetch scripts in UI or planning phases unless a later task explicitly requests a data refresh.
`npm run update:rappelconso` is an explicit France RappelConso refresh workflow that performs a network fetch and audit; it is not part of `npm run check` or `npm run build`.
`npm run update:canada` is an explicit Canada refresh workflow that performs a bounded network fetch, writes raw Canada data, normalizes Canada records, rebuilds the canonical merged file, and runs the Canada audit; it is not part of `npm run check` or `npm run build`.
`npm run update:eu-safety-gate` is an explicit EU Safety Gate refresh workflow that performs a bounded official Safety Gate API fetch, writes raw EU data, normalizes EU records, rebuilds the canonical merged file, and runs the EU audit; it is not part of `npm run check` or `npm run build`.
`npm run update:uk-fsa` is an explicit UK FSA refresh workflow that performs a bounded official Food Alerts API fetch, normalizes from saved raw, rebuilds the canonical merged file, and runs the UK FSA audit; it is not part of `npm run check` or `npm run build`.
`npm run update:australia-product-safety` is an explicit Australia Product Safety refresh workflow that performs a bounded official Product Safety Australia fetch, normalizes from saved raw, rebuilds the canonical merged file, and runs the Australia audit; it is not part of `npm run check` or `npm run build`.
`npm run update:new-zealand-product-safety` is an explicit New Zealand Product Safety refresh workflow that performs a bounded official Product Safety New Zealand fetch, normalizes from saved raw, rebuilds the canonical merged file, and runs the New Zealand audit; it is not part of `npm run check` or `npm run build`.
`npm run update:hong-kong-cfs` is an explicit Hong Kong CFS refresh workflow that performs a bounded official CFS XML/archive/detail fetch, normalizes from saved raw, rebuilds the canonical merged file, and runs the Hong Kong CFS audit; it is not part of `npm run check` or `npm run build`.
`npm run debug:hong-kong-cfs-access` is a non-mutating official access diagnostic for Hong Kong CFS listing, XML feed, archive, and detail candidates.
`npm run debug:new-zealand-product-safety-access` is a non-mutating official access diagnostic for Product Safety New Zealand listing, detail, JSON, and RSS candidates.
`npm run debug:korea-safetykorea-access` is a non-mutating official SafetyKorea/data.go.kr access diagnostic. It does not write Korea raw files, processed files, source filters, or canonical data. After Phase 36 it uses the prepared SafetyKorea API contract and only sends a live probe when `SAFETYKOREA_API_KEY` is present.
`npm run audit:korea-safetykorea-contract` is a non-network fixture audit for the prepared SafetyKorea AuthKey header, domestic recall list/detail URL builders, draft mapping, image extraction, category mapping, and Korean text preservation.
`npm run audit:sources` is a local-only integrated source audit that reads `data/processed/recalls.json`, checks expected source ids/counts, reports missing fields by source, and verifies the active source registry matches the canonical data.

Canada update expectations for the current spike:

- Default limit: `CANADA_RECALLS_LIMIT=100`
- Expected `CA_RECALLS` count: 100
- Expected canonical total: 1101
- Local-only validation sequence: `npm run data:canada:normalize`, `npm run data:merge`, `npm run audit:canada`
- Full Canada backfill remains a separate phase.

EU Safety Gate update expectations for the current spike:

- Default limit: `EU_SAFETY_GATE_LIMIT=100`
- Expected `EU_SAFETY_GATE` count: 100
- Expected canonical total: 1101
- Explicit refresh command: `npm run update:eu-safety-gate`
- Local-only validation sequence: `npm run data:eu-safety-gate:normalize`, `npm run data:merge`, `npm run audit:eu-safety-gate`
- Commit together for the current spike: `data/raw/eu-safety-gate-recalls.json`, `data/processed/eu-safety-gate-recalls.json`, and `data/processed/recalls.json`
- Block or investigate the merge if EU count is 0, duplicate ids exist, slug collisions exist, suspicious category mappings exist, any EU record maps to `food-allergy`, source filter values change, or total/source counts change unexpectedly.
- Future larger EU pulls should reconsider raw payload commits because Safety Gate detail records are verbose.
- Full EU Safety Gate backfill remains a separate phase.

UK FSA update expectations for the current spike:

- Default limit: `UK_FSA_LIMIT=100`
- Expected `UK_FSA` count: 100
- Expected canonical total: 1101
- Explicit refresh command: `npm run update:uk-fsa`
- Local-only validation sequence: `npm run data:uk-fsa:normalize`, `npm run data:merge`, `npm run audit:uk-fsa`
- Commit together for the current spike: `data/raw/uk-fsa-alerts.json`, `data/processed/uk-fsa-alerts.json`, and `data/processed/recalls.json`
- Block or investigate the merge if UK FSA count is 0, duplicate ids exist, slug collisions exist, suspicious category mappings exist, UK FSA records stop mapping to `food-allergy`, source filter values change, or total/source counts change unexpectedly.
- Full UK FSA backfill remains a separate phase.

Australia Product Safety update expectations for the current spike:

- Default limit: `AU_PRODUCT_SAFETY_LIMIT=100`
- Current fetch mode: official Product Safety Australia recalls page, official Drupal AJAX listing view, and official detail pages
- The RSS endpoint investigated during source discovery currently self-redirects and is not used for this spike
- Expected `AU_PRODUCT_SAFETY` count: 100
- Expected canonical total: 1101
- Explicit refresh command: `npm run update:australia-product-safety`
- Local-only validation sequence: `npm run data:australia-product-safety:normalize`, `npm run data:merge`, `npm run audit:australia-product-safety`
- Commit together for the current spike: `data/raw/australia-product-safety-recalls.json`, `data/processed/australia-product-safety-recalls.json`, and `data/processed/recalls.json`
- Block or investigate the merge if Australia count is 0 or not 100, wrong source ids appear, duplicate ids/slugs/source URLs exist, official source URLs are malformed, recall dates are invalid, official image URLs are malformed or off-host, raw HTML/script/style leaks into visible fields, source filter values change, or total/source counts change unexpectedly.
- Full Australia Product Safety backfill remains a separate phase.

New Zealand Product Safety update expectations for the current spike:

- Default limit: `NZ_PRODUCT_SAFETY_LIMIT=100`
- Current fetch mode: official Product Safety New Zealand recalls page with `start` pagination and official detail pages
- The JSON/RSS candidates investigated during source discovery did not expose a usable machine feed for this spike
- Expected `NZ_PRODUCT_SAFETY` count: 100
- Expected canonical total: 1101
- Explicit refresh command: `npm run update:new-zealand-product-safety`
- Local-only validation sequence: `npm run data:new-zealand-product-safety:normalize`, `npm run data:merge`, `npm run audit:new-zealand-product-safety`
- Commit together for the current spike: `data/raw/new-zealand-product-safety-recalls.json`, `data/processed/new-zealand-product-safety-recalls.json`, and `data/processed/recalls.json`
- Block or investigate the merge if New Zealand count is 0 or not 100, wrong source ids appear, duplicate ids/slugs/source URLs appear, official source URLs are malformed, recall dates are invalid, official image URLs are malformed or off-host, raw HTML leaks into visible fields, specialist vehicle/medical records appear, or source filter values change.
- Full New Zealand Product Safety backfill remains a separate phase.

Hong Kong CFS update expectations for the current spike:

- Default limit: `HK_CFS_LIMIT=100`
- Current fetch mode: official Hong Kong CFS food alerts XML feed plus official annual archive and detail pages
- Expected `HK_CFS` count: 100
- Expected canonical total: 1101
- Explicit refresh command: `npm run update:hong-kong-cfs`
- Local-only validation sequence: `npm run data:hong-kong-cfs:normalize`, `npm run data:merge`, `npm run audit:hong-kong-cfs`
- Commit together for the current spike: `data/raw/hong-kong-cfs-food-alerts.json`, `data/processed/hong-kong-cfs-food-alerts.json`, and `data/processed/recalls.json`
- Block or investigate the merge if Hong Kong CFS count is 0 or not 100, wrong source ids appear, duplicate ids/slugs/source URLs appear, official source URLs are malformed, recall dates are invalid, official CFS image URLs are malformed or off-host, raw HTML leaks into visible fields, or source filter values change.
- Full Hong Kong CFS historical backfill remains a separate phase.

Korea SafetyKorea discovery expectations:

- Phase 35 did not activate `KR_SAFETYKOREA`.
- Phase 36 prepared the SafetyKorea API contract after reviewing the official interface document, but still did not activate `KR_SAFETYKOREA`.
- Official authentication requires the case-sensitive HTTP header `AuthKey: <issued service ID>`.
- Local environment variable for future activation prep: `SAFETYKOREA_API_KEY`
- Prepared contract documentation: `docs/korea-safetykorea-api-contract.md`
- Official data.go.kr metadata for SafetyKorea is reachable, but it indicates an application/login/service-key flow and does not expose a callable recall-record payload without credentials.
- SafetyKorea Open API and recall board access was not stable enough in Phase 35 to justify a live source or HTML scraper.
- Non-mutating diagnostic command: `npm run debug:korea-safetykorea-access`
- Non-network fixture audit command: `npm run audit:korea-safetykorea-contract`
- Documentation: `docs/korea-safetykorea-source-discovery.md`
- Expected canonical total remains 1101 until a future reviewed Korea source phase confirms official API/feed access and adds validated records.

Current build/runtime size note:

- Current canonical data: 1101 records.
- Current build output: around 1700 pages.
- Current `data/processed/recalls.json` size: around 7 MB.
- Full backfills should measure canonical data size, detail page count, brand page count, build time, and static output size before merge.

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
- `CA_RECALLS`
- `EU_SAFETY_GATE`
- `UK_FSA`
- `AU_PRODUCT_SAFETY`
- `NZ_PRODUCT_SAFETY`
- `HK_CFS`

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

## G. Source Priority Notes

France RappelConso is active as the first non-U.S. source spike. Canada Recalls and Safety Alerts is active as the second non-U.S. source spike. EU Safety Gate is active as the first regional multi-country source spike. UK FSA Food Alerts is active as the first UK food/allergy-focused source spike. Australia Product Safety and New Zealand Product Safety are active as bounded Oceania source spikes. Hong Kong CFS is active as a bounded official food/allergy source spike.

Future candidates to evaluate as planning notes only:

- Korea SafetyKorea / MFDS
- New Zealand MPI food recalls
- Japan Consumer Affairs Agency
- Singapore SFA / CPSO
- Hong Kong EMSD
- Taiwan TFDA / BSMI

Phase 31 source discovery is documented in `docs/asia-oceania-source-discovery.md`. Phase 33 activated the bounded `AU_PRODUCT_SAFETY` spike. Phase 37 activated the bounded `NZ_PRODUCT_SAFETY` spike. Phase 38 activated the bounded `HK_CFS` food/allergy spike. Phase 35 checked SafetyKorea access and deferred `KR_SAFETYKOREA` because official recall-record API access was not confirmed without an application/service-key flow; see `docs/korea-safetykorea-source-discovery.md`.

These future candidates are not active filters or active coverage in this phase. They should not appear in consumer-facing source filters until real data ingestion, source labels, validation, and product detail behavior are implemented.

## H. Non-Goals

This phase does not add:

- Additional API ingestion beyond the current CPSC, FDA/openFDA, RappelConso, Canada, EU Safety Gate, UK FSA, Australia Product Safety, New Zealand Product Safety, and Hong Kong CFS scripts
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
