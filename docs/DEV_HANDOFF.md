# Development Handoff

## Local Setup

```powershell
cd C:\Users\pc\codex-projects\recall-radar-web
npm install
npm run dev
```

Use port `5179` only.

## Data Model

The site-facing recall model is built in `src/lib/recall-data.ts`.

Primary local source:

- `data/processed/recalls.json`

Fallback/demo source:

- `src/data/mock-recalls.ts`

When processed local records exist, they are the primary source for homepage cards, checker search results, recall detail pages, brand pages, and category pages. Mock records remain available only as local fallback/demo data.

Site-facing records include:

- slug
- title
- source label
- source URL
- brand names
- category
- product names
- recall date
- affected units
- description
- hazard
- remedy
- optional FDA fields such as classification, reason, distribution pattern, product quantity, recall number, and status

## Local CPSC Pipeline

Phase 2 added a local-only CPSC recall data pipeline. Phase 3 connects the processed CPSC file to the website. Phase 5 adds local FDA/openFDA food recall records and makes `data/processed/recalls.json` the merged canonical local source.

USDA FSIS integration is deferred. A local Phase 6 attempt against the official USDA FSIS recall endpoint returned HTTP `403 Forbidden` / `Access Denied`; no USDA data was written and no bypass should be attempted. The likely cause is FSIS-side access control, CDN/WAF filtering, User-Agent/header filtering, IP/range filtering, or temporary endpoint restrictions. See `docs/USDA_FSIS_DEFERRED.md`.

Commands:

- `npm run fetch:cpsc` fetches current-year public CPSC recall JSON and writes local files.
- `npm run normalize:cpsc` rebuilds processed recall data from `data/raw/cpsc-recalls.json`.
- `npm run fetch:fda-food` fetches recent public openFDA food enforcement JSON and writes local files.
- `npm run normalize:fda-food` rebuilds FDA processed recall data from `data/raw/fda-food-recalls.json`.
- `npm run fetch:rappelconso` fetches the bounded France RappelConso source spike.
- `npm run normalize:rappelconso` rebuilds RappelConso processed data from `data/raw/rappelconso-recalls.json`.
- `npm run fetch:canada` fetches the bounded Canada Recalls and Safety Alerts source spike.
- `npm run normalize:canada` rebuilds Canada processed data from `data/raw/canada-recalls.json`.
- `npm run fetch:eu-safety-gate` fetches the bounded EU Safety Gate source spike.
- `npm run normalize:eu-safety-gate` rebuilds EU Safety Gate processed data from `data/raw/eu-safety-gate-recalls.json`.
- `npm run fetch:uk-fsa` fetches the bounded UK FSA Food Alerts source spike.
- `npm run normalize:uk-fsa` rebuilds UK FSA processed data from `data/raw/uk-fsa-alerts.json`.
- `npm run fetch:australia-product-safety` fetches the bounded Australia Product Safety source spike.
- `npm run normalize:australia-product-safety` rebuilds Australia processed data from `data/raw/australia-product-safety-recalls.json`.
- `npm run fetch:new-zealand-product-safety` fetches the bounded New Zealand Product Safety source spike.
- `npm run normalize:new-zealand-product-safety` rebuilds New Zealand processed data from `data/raw/new-zealand-product-safety-recalls.json`.
- `npm run fetch:hong-kong-cfs` fetches the bounded Hong Kong CFS food/allergy source spike.
- `npm run normalize:hong-kong-cfs` rebuilds Hong Kong CFS processed data from `data/raw/hong-kong-cfs-food-alerts.json`.
- `npm run fetch:fsanz-food-recalls` fetches the bounded Australia/New Zealand FSANZ food recall source spike.
- `npm run normalize:fsanz-food-recalls` rebuilds FSANZ processed data from `data/raw/fsanz-food-recalls.json`.
- `npm run debug:fsanz-food-recalls-access` checks official FSANZ listing, RSS, and detail-page access without writing data.
- `npm run debug:hong-kong-cfs-access` checks official Hong Kong CFS access without writing data.
- `npm run debug:new-zealand-product-safety-access` checks official Product Safety New Zealand access without writing data.
- `npm run debug:korea-safetykorea-access` checks official SafetyKorea/data.go.kr access without writing records or changing canonical data.
- `npm run audit:korea-safetykorea-contract` validates the prepared SafetyKorea API contract and fixture mapping without network access.
- `npm run audit:sources` audits integrated source counts, active source ids, duplicate ids, sparse fields, and category distribution without making network calls.
- `npm run audit:uk-fsa` audits the bounded UK FSA source spike.
- `npm run audit:australia-product-safety` audits the bounded Australia source spike, including source ids, duplicate ids/slugs/source URLs, official URL shape, image host validity, invalid dates, raw HTML leakage, category distribution, and identifier coverage.
- `npm run audit:new-zealand-product-safety` audits the bounded New Zealand source spike, including source ids, duplicate ids/slugs/source URLs, official URL shape, image host validity, invalid dates, raw HTML leakage, specialist-source exclusions, category distribution, and identifier coverage.
- `npm run audit:hong-kong-cfs` audits the bounded Hong Kong CFS source spike, including source ids, duplicate ids/slugs/source URLs, official URL shape, image host validity, invalid dates, raw HTML leakage, food/allergy mapping, and identifier coverage.
- `npm run audit:fsanz-food-recalls` audits the bounded FSANZ food recall source spike, including source ids, duplicate ids/slugs/source URLs, official URL shape, image host validity, invalid dates, raw HTML leakage, food category mapping, and identifier coverage.
- `npm run validate:launch` runs the local-only launch validation sequence: integrated/source audits, `npm run check`, and `npm run build`.
- `npm run build:data` currently runs the CPSC, FDA/openFDA, France RappelConso, Canada, EU Safety Gate, UK FSA, Australia Product Safety, New Zealand Product Safety, Hong Kong CFS, and FSANZ fetch pipelines.

Local output files:

- `data/raw/cpsc-recalls.json`
- `data/raw/fda-food-recalls.json`
- `data/raw/rappelconso-recalls.json`
- `data/raw/canada-recalls.json`
- `data/raw/eu-safety-gate-recalls.json`
- `data/raw/uk-fsa-alerts.json`
- `data/raw/australia-product-safety-recalls.json`
- `data/raw/new-zealand-product-safety-recalls.json`
- `data/raw/hong-kong-cfs-food-alerts.json`
- `data/raw/fsanz-food-recalls.json`
- `data/processed/cpsc-recalls.json`
- `data/processed/fda-recalls.json`
- `data/processed/rappelconso-recalls.json`
- `data/processed/canada-recalls.json`
- `data/processed/eu-safety-gate-recalls.json`
- `data/processed/uk-fsa-alerts.json`
- `data/processed/australia-product-safety-recalls.json`
- `data/processed/new-zealand-product-safety-recalls.json`
- `data/processed/hong-kong-cfs-food-alerts.json`
- `data/processed/fsanz-food-recalls.json`
- `data/processed/recalls.json`

The fetch script calls `https://www.saferproducts.gov/RestWebServices/Recall` without an API key. It writes only after the API returns non-empty records, and each raw file includes a `fetchedAt` timestamp.

The FDA/openFDA fetch script calls `https://api.fda.gov/food/enforcement.json` without an API key. It fetches a limited set of recent records, writes only after the API returns non-empty records, and each raw file includes a `fetchedAt` timestamp.

The EU Safety Gate fetch script calls official EU Safety Gate endpoints only:

- `https://ec.europa.eu/safety-gate-alerts/public/api/notification/mostRecent/?`
- `https://ec.europa.eu/safety-gate-alerts/public/api/notification/{id}?language=en`

It fetches a bounded default of 100 recent dangerous non-food product alerts, writes only after non-empty records return, and each raw file includes a `fetchedAt` timestamp.

The UK FSA fetch script calls official FSA Food Alerts endpoints only:

- `https://data.food.gov.uk/food-alerts/id.json?_limit=100&_sort=-created`
- `https://data.food.gov.uk/food-alerts/id/{notation}.json`

It fetches a bounded default of 100 recent food alerts, allergy alerts, product recall information notices, and food alerts for action. It writes only after non-empty records return, and each raw file includes a `fetchedAt` timestamp. See `docs/uk-fsa-source.md`.

The Australia Product Safety fetch script calls the official Product Safety Australia recalls page and official Drupal AJAX listing endpoint, then fetches official detail pages for the bounded records. The RSS endpoint investigated during source discovery self-redirected and is not used for the current spike. It writes only after non-empty records return, keeps the default limit at 100, and each raw file includes a `fetchedAt` timestamp. See `docs/australia-product-safety-source.md`.

The New Zealand Product Safety fetch script calls the official Product Safety New Zealand recalls page with `start` pagination, then fetches official detail pages for the bounded records. JSON and RSS candidates investigated during Phase 37 did not expose a usable feed, so the current connector uses official HTML listing/detail pages only. It writes only after non-empty records return, keeps the default limit at 100, and each raw file includes a `fetchedAt` timestamp. See `docs/new-zealand-product-safety-source.md`.

The Hong Kong CFS fetch script calls the official Centre for Food Safety food alerts XML dataset, annual archive pages, and official detail pages. It writes only after non-empty records return, keeps the default limit at 100, and each raw file includes a `fetchedAt` timestamp. See `docs/hong-kong-cfs-food-alerts-source.md`.

The FSANZ Food Recalls fetch script calls the official Food Standards Australia New Zealand recall alert listing pages, official recall detail pages, and the official RSS feed for supplemental latest metadata. It writes only after non-empty records return, keeps the default limit at 100, and each raw file includes a `fetchedAt` timestamp. See `docs/fsanz-food-recalls-source.md`.

The Korea SafetyKorea diagnostic script checks official SafetyKorea and data.go.kr candidates only. Phase 35 did not add `KR_SAFETYKOREA` because the official data.go.kr page indicates an application/login/service-key flow, the reachable structured metadata is not a recall-record payload, and SafetyKorea page access was not stable enough to justify a live source or HTML scraper. See `docs/korea-safetykorea-source-discovery.md`.

Phase 36 prepared the SafetyKorea domestic recall API contract after the official interface document review. SafetyKorea requires a separately issued service ID in the case-sensitive HTTP header `AuthKey`; use `SAFETYKOREA_API_KEY` locally and never commit it. Prepared docs and tests are in `docs/korea-safetykorea-api-contract.md`, `scripts/korea-safetykorea-api-contract.ts`, `scripts/audit-korea-safetykorea-contract.ts`, and `data/samples/korea-safetykorea-domestic-recall-samples.json`. This is not a live source activation.

EU Safety Gate operational update strategy:

- Explicit refresh command: `npm run update:eu-safety-gate`
- The refresh command fetches the bounded Safety Gate data, writes raw EU data, normalizes EU records, rebuilds `data/processed/recalls.json`, and runs `npm run audit:eu-safety-gate`.
- Local-only validation sequence: `npm run data:eu-safety-gate:normalize`, `npm run data:merge`, `npm run audit:eu-safety-gate`.
- Default limit remains `EU_SAFETY_GATE_LIMIT=100`; full EU backfill is a separate phase.
- For the current 100-record spike, commit `data/raw/eu-safety-gate-recalls.json`, `data/processed/eu-safety-gate-recalls.json`, and `data/processed/recalls.json` together only after audit passes.
- Block or investigate an EU data merge if source counts change unexpectedly, duplicate ids or slug collisions appear, suspicious category mappings appear, or any EU record maps to `food-allergy`.

Australia Product Safety operational update strategy:

- Explicit refresh command: `npm run update:australia-product-safety`
- The refresh command fetches the bounded Product Safety Australia data, writes raw Australia data, normalizes Australia records, rebuilds `data/processed/recalls.json`, and runs `npm run audit:australia-product-safety`.
- Local-only validation sequence: `npm run data:australia-product-safety:normalize`, `npm run data:merge`, `npm run audit:australia-product-safety`.
- Default limit remains `AU_PRODUCT_SAFETY_LIMIT=100`; full Australia backfill is a separate phase.
- For the current 100-record spike, commit `data/raw/australia-product-safety-recalls.json`, `data/processed/australia-product-safety-recalls.json`, and `data/processed/recalls.json` together only after audit passes.
- Block or investigate an Australia data merge if source counts change unexpectedly, wrong source ids appear, duplicate ids/slugs/source URLs appear, official source URLs are malformed, recall dates are invalid, official image URLs are malformed or off-host, raw HTML leaks into visible fields, or source filter values change.

New Zealand Product Safety operational update strategy:

- Explicit refresh command: `npm run update:new-zealand-product-safety`
- The refresh command fetches the bounded Product Safety New Zealand data, writes raw New Zealand data, normalizes New Zealand records, rebuilds `data/processed/recalls.json`, and runs `npm run audit:new-zealand-product-safety`.
- Local-only validation sequence: `npm run data:new-zealand-product-safety:normalize`, `npm run data:merge`, `npm run audit:new-zealand-product-safety`.
- Default limit remains `NZ_PRODUCT_SAFETY_LIMIT=100`; full New Zealand backfill is a separate phase.
- For the current 100-record spike, commit `data/raw/new-zealand-product-safety-recalls.json`, `data/processed/new-zealand-product-safety-recalls.json`, and `data/processed/recalls.json` together only after audit passes.
- Block or investigate a New Zealand data merge if source counts change unexpectedly, wrong source ids appear, duplicate ids/slugs/source URLs appear, official source URLs are malformed, recall dates are invalid, official image URLs are malformed or off-host, raw HTML leaks into visible fields, specialist vehicle/medical records appear, or source filter values change.

Hong Kong CFS operational update strategy:

- Explicit refresh command: `npm run update:hong-kong-cfs`
- The refresh command fetches the bounded Hong Kong CFS data, writes raw Hong Kong data, normalizes Hong Kong records, rebuilds `data/processed/recalls.json`, and runs `npm run audit:hong-kong-cfs`.
- Local-only validation sequence: `npm run data:hong-kong-cfs:normalize`, `npm run data:merge`, `npm run audit:hong-kong-cfs`.
- Default limit remains `HK_CFS_LIMIT=100`; full Hong Kong CFS historical backfill is a separate phase.
- For the current 100-record spike, commit `data/raw/hong-kong-cfs-food-alerts.json`, `data/processed/hong-kong-cfs-food-alerts.json`, and `data/processed/recalls.json` together only after audit passes.
- Block or investigate a Hong Kong CFS data merge if source counts change unexpectedly, wrong source ids appear, duplicate ids/slugs/source URLs appear, official source URLs are malformed, recall dates are invalid, official CFS image URLs are malformed or off-host, raw HTML leaks into visible fields, or source filter values change.

FSANZ Food Recalls operational update strategy:

- Explicit refresh command: `npm run update:fsanz-food-recalls`
- The refresh command fetches the bounded FSANZ food recall data, writes raw FSANZ data, normalizes FSANZ records, rebuilds `data/processed/recalls.json`, and runs `npm run audit:fsanz-food-recalls`.
- Local-only validation sequence: `npm run data:fsanz-food-recalls:normalize`, `npm run data:merge`, `npm run audit:fsanz-food-recalls`.
- Default limit remains `FSANZ_FOOD_RECALLS_LIMIT=100`; full FSANZ backfill is a separate phase.
- For the current 100-record spike, commit `data/raw/fsanz-food-recalls.json`, `data/processed/fsanz-food-recalls.json`, and `data/processed/recalls.json` together only after audit passes.
- Block or investigate a FSANZ data merge if source counts change unexpectedly, wrong source ids appear, duplicate ids/slugs/source URLs appear, official source URLs are malformed, recall dates are invalid, official FSANZ image URLs are malformed or off-host, raw HTML leaks into visible fields, or source filter values change.

Normalized records use `src/data/recall-types.ts` and include `id`, `source`, `sourceUrl`, `title`, `brandNames`, `productNames`, `category`, `hazard`, `remedy`, `recallDate`, `affectedUnits`, `description`, `slug`, and `raw`. FDA, France, Canada, EU, UK FSA, Australia, New Zealand, Hong Kong, and FSANZ records can also include `classification`, `reason`, `distributionPattern`, `productQuantity`, `recallNumber`, `status`, and official image fields when available.

Do not call fetch scripts during UI-only phases unless a later task explicitly asks for fresh local data.

Phase 24 global backfill planning:

- `docs/global-backfill-runbook.md` documents source-agnostic backfill policy for CPSC, FDA/openFDA, France RappelConso, Canada, EU Safety Gate, and UK FSA.
- `npm run plan:source-backfills` reports current source readiness without fetching or mutating data.
- `npm run audit:source-backfills` audits generated files under ignored `data/backfill/` directories if they exist.
- Canonical data remains unchanged until a separate reviewed launch-time backfill phase.

Phase 31 Asia/Oceania source discovery:

- `docs/asia-oceania-source-discovery.md` documents official source candidates for Australia, New Zealand, Japan, Korea, Singapore, Hong Kong, and Taiwan.
- Phase 33 added Australia Product Safety as the first active Oceania source spike.
- Phase 37 added New Zealand Product Safety as the second active Oceania source spike.
- Phase 38 added Hong Kong CFS as a bounded official food/allergy source spike.
- Phase 39 added FSANZ Food Recalls as a bounded official Australia/New Zealand food recall source spike.
- Japan, Korea, Singapore, and Taiwan remain discovery candidates.
- Phase 35 checked Korea SafetyKorea access and deferred `KR_SAFETYKOREA`.
- Phase 36 prepared the SafetyKorea AuthKey/list/detail contract and fixture audit. Live activation still requires an issued SafetyKorea service ID/AuthKey and a separate Korea source activation phase.

Homepage source-card guidance:

- Browse-by-source cards distinguish market, official source/agency, and recall domain.
- Australia Product Safety and New Zealand Product Safety remain separate general product recall cards.
- FSANZ Food Recalls is a regional Australia/New Zealand food recall source card; it does not replace or merge the Australia/New Zealand general product recall sources.
- Phase 40 changed source-card copy and layout only. It did not change routes, source ids, source counts, or canonical data.

Current source counts:

- CPSC: 301
- FDA/openFDA: 100
- France RappelConso: 100
- Canada Recalls and Safety Alerts: 100
- EU Safety Gate: 100
- UK FSA Food Alerts: 100
- Australia Product Safety: 100
- New Zealand Product Safety: 100
- Hong Kong CFS Food Alerts: 100
- FSANZ Food Recalls: 100
- Total: 1201

Phase 10.1 UK FSA QA notes:

- `scripts/audit-uk-fsa-alerts.ts` reports pack size, batch/date, allergen/risk, retailer/distribution-like details, image availability, related-media availability, alert type distribution, and suspicious category mappings.
- UK FSA records remain conservatively routed to food/allergy because the source is food alerts, allergy alerts, product recall information notices, and food alerts for action.
- Food Alert For Action records avoid treating generic "Food businesses selling these products..." instructions as a brand/company name.

Phase 10.2 UK FSA update workflow:

- `npm run update:uk-fsa` is the explicit network refresh workflow and runs fetch, normalize, merge, and audit in sequence.
- Local-only validation should use `npm run data:uk-fsa:normalize`, `npm run data:merge`, and `npm run audit:uk-fsa`.
- Keep `UK_FSA_LIMIT=100` as the default until a separate full-backfill phase reviews raw file size, page count, brand page growth, and commit strategy.

Phase 11 integrated source QA:

- Active source ids are `CPSC`, `FDA`, `FR_RAPPELCONSO`, `CA_RECALLS`, `EU_SAFETY_GATE`, `UK_FSA`, `AU_PRODUCT_SAFETY`, `NZ_PRODUCT_SAFETY`, `HK_CFS`, and `FSANZ_FOOD_RECALLS`.
- `npm run audit:sources` verifies the integrated source registry and canonical `data/processed/recalls.json` stay aligned.
- Current expected counts are 301 CPSC, 100 FDA/openFDA, 100 France RappelConso, 100 Canada Recalls and Safety Alerts, 100 EU Safety Gate, 100 UK FSA Food Alerts, 100 Australia Product Safety, 100 New Zealand Product Safety, 100 Hong Kong CFS, and 100 FSANZ Food Recalls records, for 1201 total records.
- Current static build output is around 2200 pages, and `data/processed/recalls.json` is around 10 MB.
- Full backfills should measure canonical data size, detail page count, brand page count, build time, and static output size before merge.
- Cross-source dedupe is not implemented yet; source-prefixed ids are preserved.

Phase 13 launch readiness:

- `docs/LAUNCH_CHECKLIST.md` is the launch/staging handoff checklist.
- `npm run validate:launch` is the preferred local-only pre-launch validation command.
- `public/robots.txt` allows crawling.
- `src/pages/404.astro` provides a simple static not-found page.
- No sitemap is configured yet; defer sitemap generation until a deployment domain/canonical site URL is chosen.

## Site Data Loader

`src/lib/recall-data.ts`:

- loads `data/processed/recalls.json` at build time
- maps CPSC and FDA/openFDA records into a UI-safe `SiteRecall` shape
- routes source labels through `src/lib/recall-sources.ts`
- builds concise recall detail slugs from cleaned title text, with product/brand fallback context
- limits generated detail slugs at word boundaries while preserving uniqueness with the CPSC id
- builds brand groups from `brandNames`
- keeps raw CPSC brand/legal names on each recall
- adds normalized consumer-facing brand display names and shorter brand slugs through `src/lib/brand-normalize.ts`
- classifies records lightly into baby/kids, battery/electronics, food/allergy, household/appliance, or general consumer product
- routes FDA/openFDA and UK FSA food records into the food/allergy page for browsing
- falls back to mock records only when no processed records are available

## Brand Normalization

`src/lib/brand-normalize.ts` is intentionally conservative:

- prefers explicit `dba`, `d/b/a`, or `doing business as` names
- removes trailing CPSC location phrases such as `of Houston, Texas` when safe
- removes common legal suffix noise such as `Inc.`, `LLC`, `Ltd.`, `Corporation`, and `Co. Ltd.`
- keeps the raw source name available on recall detail and brand pages
- limits brand slugs to avoid very long legal-entity URLs
- avoids cutting brand slugs in the middle of a word
- keeps brand routes unique if two different display names normalize to the same slug

Example:

- raw source name: `7111495 Canada Inc., dba Arizer Tech, of Waterloo, Ontario`
- display brand: `Arizer Tech`
- route: `/brands/arizer-tech`

## Slug Quality

`src/lib/slug.ts` removes common low-value recall-title phrases before generating recall page URLs, including `recalled due to`, `risk of`, `serious injury or death`, `sold exclusively`, `sold at`, and standalone importer/manufacturer clauses. Recall slugs keep the source id suffix, such as `cpsc-26565`, so cleaned URLs remain stable and unique for the same source record.

## Search Helper

`src/lib/recall-search.ts` exports:

- `searchRecalls`
- `getRecallMatch`
- `MATCH_LABELS`
- `SEARCH_RESULTS_DISCLAIMER`

Match types are `exact`, `possible`, `related`, and `none`.

The checker renders grouped indexed-notice results with match badges, recall date, source label, product/brand context, reason/risk summary, category, and detail links. Keep the generic search disclaimer and no-result warning consistent wherever search results appear.

Phase 7 added local-only search controls on `/checker`:

- keyword/product/brand/model/UPC/lot text query
- source filter for all markets plus `CPSC`, `FDA`, `FR_RAPPELCONSO`, `CA_RECALLS`, `EU_SAFETY_GATE`, `UK_FSA`, `AU_PRODUCT_SAFETY`, `NZ_PRODUCT_SAFETY`, and `HK_CFS`
- category filter for baby/kids, battery/electronics, food/allergy, household/appliance, food, and general records
- sort controls for best match, newest first, and oldest first
- optional date windows for last 30 days, last 90 days, and all time
- URL query state such as `/checker?q=arizer`, `/checker?q=pistachio&source=FDA`, and `/checker?q=smoke&source=CPSC`

The checker remains static and local-only. It embeds the local processed recall records at build time and does not add a server, API route, database, or external data call.

## Recall Detail Pages

Recall detail pages use structured local summaries instead of long official text blocks. Each detail page shows product, brand/company, hazard, remedy, affected units, a conservative what-to-check checklist, company recall history, related recalls, and a smaller official source attribution link.

`src/lib/recall-checklist.ts` derives checklist items from available local fields such as product names, brand/company names, recall numbers, affected units, and identifier-like text already present in the local record. It does not invent model, UPC, lot, or date-code values.

`src/lib/related-recalls.ts` builds company recall history from conservative normalized brand/company matching and related recalls from category, hazard keywords, product terms, and source tie-breakers. It avoids matching only on legal suffixes, generic company words, or location-only overlap.

## Local Watchlist Demo

Phase 8 adds a static `/watchlist` page and browser-only watchlist UX.

- Storage key: `recall-radar-watchlist-v1`
- Implementation: `src/lib/watchlist.ts`
- Users can save search terms from `/checker` with source and category preferences.
- Users can save normalized brand pages from `/brands/[brand]`.
- Users can remove individual saved items or clear the watchlist.
- `/watchlist` embeds the existing indexed notices at build time and previews matching recall records in the browser.
- The email preview form is non-submitting UI only; it does not submit, send, store, or transmit email addresses.

The watchlist is not an alert backend. It uses only browser `localStorage`; there is no API endpoint, server persistence, database, email service, external dependency, or network request.

## I18n Foundation

Phase 15 adds planning docs for future multilingual UI support without wiring localization into the visible app.

- `docs/i18n-foundation.md` defines translation boundaries, future locale planning, source-language policy, SEO considerations, and deferred items.
- `docs/i18n-string-audit.md` audits the main UI areas and identifies which strings are product-owned UI versus source-derived recall fields.
- `src/lib/i18n.ts` contains an English-only message dictionary for future typed message work. It is not connected to pages yet.
- Current launch UI remains English-only.
- Official source text remains in the source language and should not be automatically translated or rewritten as official notice truth.
- Locale routes such as `/en` or `/ko`, browser language detection, `hreflang`, translated slugs, translated source records, and LLM translation are deferred.

## Guardrails

Keep this repo static/local-first. Do not add secrets, deployments, databases, or runtime source calls. Only run source fetch scripts when a data-pipeline or source-refresh phase explicitly requests them.

## Recall Taxonomy V2 Design

Phase 41 adds a breaking-schema design for future recall classification without changing runtime behavior.

- Design doc: `docs/recall-taxonomy-v2.md`
- LLM classifier contract: `docs/llm-recall-classifier-contract.md`
- Draft enum/type contract: `src/data/recall-taxonomy-v2.ts`
- Artificial fixture examples: `data/samples/recall-taxonomy-v2-examples.json`
- Static audit: `npm run audit:recall-taxonomy-v2-design`

The old single `category` field is deprecated for future data because it mixes product family, product type, hazard type, source type, recall domain, and UI grouping. Phase 41 does not migrate existing records, does not modify `NormalizedRecall`, does not regenerate canonical data, and does not call an LLM. The recommended next phase is an offline LLM classifier dry run and cost estimate.

## LLM Recall Classifier Dry Run

Phase 42 adds an offline-first dry-run classifier pipeline for Recall Taxonomy V2 without changing runtime behavior.

- Dry-run guide: `docs/llm-recall-classifier-dry-run.md`
- Mock/default command: `npm run classify:recalls:taxonomy-v2:dry-run`
- Static/output audit: `npm run audit:llm-classifier-dry-run`
- Default provider: deterministic `mock`
- Optional providers: `gemini` with `GEMINI_API_KEY`, or `openai` with `OPENAI_API_KEY`
- Output folder: ignored `outputs/llm-classifier/`
- Prompt version: `recall-classifier-v1`

The dry run reads `data/processed/recalls.json`, builds short structured classifier inputs, validates strict JSON output against `RecallClassificationV2`, compares taxonomy v2 fields to the legacy `category`, and estimates token/cost projections. It does not write canonical taxonomy fields, does not modify `data/raw` or `data/processed`, does not change UI routes or filters, and does not run source refreshes.

Keep Phase 42 outputs uncommitted. If a live provider is used later, provide keys only through local environment variables and do not print or commit them.

## Recall Data Schema V2

Phase 43 finalizes the future V2 schema plan without runtime migration.

- Schema plan: `docs/recall-data-schema-v2.md`
- Future DB plan: `docs/recall-db-schema-v2.md`
- Phase 44 plan: `docs/phase-44-per-source-llm-classification-plan.md`
- Type-only draft: `src/data/recall-data-schema-v2.ts`
- Readiness audit: `npm run audit:recall-data-schema-v2-readiness`

Future `NormalizedRecallV2` records require `classification` and do not require the old `category` field. The current runtime still uses legacy category-derived fields until a separate migration phase. Phase 44 should run a bounded Gemini per-source classification test into ignored `outputs/llm-classifier/per-source/` files only.

Phase 44D adds type-only Identifier V2 planning and source-aware UI guidance. `identifiers` is a typed array in the future schema, barcode is optional, and identifier availability varies by official source. Current canonical data is not migrated; search/detail/category/source pages only receive concise guidance copy.

## LLM Environment Setup

Phase 44A adds local-only environment handling for classifier CLI scripts.

- Env setup guide: `docs/llm-env-setup.md`
- Example env file: `.env.example`
- Local secret file: `.env.local`, ignored by git
- Env loader: `scripts/load-local-env.ts`
- Diagnostic: `npm run debug:llm-classifier-env`
- Gemini probe: `npm run probe:gemini-classifier`

The Gemini probe uses one artificial recall classification prompt and does not read source records, write canonical data, or run per-source classification. Full Phase 44 classification remains deferred.

## Taxonomy V2 UI Preview

Phase 44B adds `/dev/taxonomy-v2-preview` as a noindex development preview for future Taxonomy V2 menus, issue tags, detail-page sections, and legacy category replacement planning. Phase 44C locks the product-owner-approved public product-family list as all 15 Taxonomy V2 families, using `Need Review` as the visible label for `unknown`.

- Preview doc: `docs/taxonomy-v2-ui-preview.md`
- Display helpers: `src/lib/taxonomy-v2-display.ts`
- Preview data helper: `src/lib/taxonomy-v2-preview-data.ts`
- Audit: `npm run audit:taxonomy-v2-ui-preview`

The preview uses artificial examples only. Product family categories are the future primary public browse model; hazard types are secondary issue tags for results/details and optional later filtering. Phase 44C does not change canonical records, current public category pages, source pages, homepage category links, runtime filtering, or detail pages.

## Source-Aware Identifier Guidance

Phase 44D centralizes identifier guidance in `src/lib/identifier-guidance.ts` and audits it with `npm run audit:identifier-guidance`.

- Barcode is optional and must not be described as required.
- Source-specific guidance covers all active sources.
- No-result copy reminds users that no indexed match is not a safety or recall-free confirmation.
- Detail pages show a concise source-aware verification note.
- Identifier V2 remains type-only planning; no canonical records or source outputs are changed.

## CPSC Classifier Input Preview

Phase 44E-1 adds a CPSC-only input preview before any live per-source classification.

- Guide: `docs/cpsc-classifier-input-preview.md`
- Preview command: `npm run preview:cpsc-classifier-input`
- Static audit: `npm run audit:cpsc-classifier-input-preview`
- Output folder: ignored `outputs/llm-classifier/input-preview/cpsc/`

The preview compares the current generic classifier input with a proposed CPSC-specific input view, estimates tokens, checks prompt noise, and forces the Yamaha/UMAX/Bistro vehicle review case when present. It does not call Gemini or OpenAI, does not classify records, does not modify `data/raw` or `data/processed`, and does not change runtime UI.

## FSANZ Classifier Input Preview

Phase 44E-2 adds the same input-noise gate for FSANZ food recalls before any live per-source classification.

- Guide: `docs/fsanz-classifier-input-preview.md`
- Preview command: `npm run preview:fsanz-classifier-input`
- Static audit: `npm run audit:fsanz-classifier-input-preview`
- Output folder: ignored `outputs/llm-classifier/input-preview/fsanz/`

The preview keeps allergen, pathogen or chemical contamination, foreign matter, date marking, pack-size, and batch/lot/barcode evidence source-specific before any live classifier run. It does not call Gemini or OpenAI, does not classify records, does not modify `data/raw` or `data/processed`, and does not change runtime UI.

## New Zealand Product Safety Classifier Input Preview

Phase 44E-3 adds the same input-noise gate for New Zealand Product Safety records before any live per-source classification.

- Guide: `docs/new-zealand-classifier-input-preview.md`
- Preview command: `npm run preview:new-zealand-classifier-input`
- Static audit: `npm run audit:new-zealand-classifier-input-preview`
- Output folder: ignored `outputs/llm-classifier/input-preview/new-zealand/`

The preview keeps product identifiers, supplier names, official categories, hazard/action evidence, and model/SKU/serial/barcode-style identifiers source-specific while checking that supplier/contact boilerplate does not dominate the prompt. It does not call Gemini or OpenAI, does not classify records, does not modify `data/raw` or `data/processed`, and does not change runtime UI.
