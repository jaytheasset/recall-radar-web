# QA Checklist

## Local Project Isolation

- Confirm the project folder is `C:\Users\pc\codex-projects\recall-radar-web`.
- Confirm no files from other projects were copied or reused.
- Confirm the intended Git remote is `origin` for `jaytheasset/recall-radar-web` when a phase requires a branch push.
- Confirm no real `.env` files exist.

## Commands

- `npm run check`
- `npm run build`
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
- `npm run audit:sources`
- `npm run audit:eu-safety-gate`
- `npm run fetch:uk-fsa`
- `npm run normalize:uk-fsa`
- `npm run audit:uk-fsa`
- `npm run fetch:australia-product-safety`
- `npm run normalize:australia-product-safety`
- `npm run audit:australia-product-safety`
- `npm run fetch:new-zealand-product-safety`
- `npm run normalize:new-zealand-product-safety`
- `npm run debug:new-zealand-product-safety-access`
- `npm run audit:new-zealand-product-safety`
- `npm run fetch:hong-kong-cfs`
- `npm run normalize:hong-kong-cfs`
- `npm run debug:hong-kong-cfs-access`
- `npm run audit:hong-kong-cfs`
- `npm run fetch:fsanz-food-recalls`
- `npm run normalize:fsanz-food-recalls`
- `npm run debug:fsanz-food-recalls-access`
- `npm run audit:fsanz-food-recalls`
- `npm run debug:korea-safetykorea-access`
- `npm run audit:korea-safetykorea-contract`
- `npm run validate:launch`
- `npm run plan:source-backfills`
- `npm run audit:source-backfills`
- `npm run dev`
- `npm run preview`

Do not run fetch scripts during local UI-only phases unless the task explicitly asks for fresh local data.

For launch or staging readiness, use `docs/LAUNCH_CHECKLIST.md`. `npm run validate:launch` is local-only and must not include network fetch/update scripts.

Global backfill planning is documented in `docs/global-backfill-runbook.md`. `npm run plan:source-backfills` must not mutate source data, and `npm run audit:source-backfills` should pass with "No source backfill chunks found; nothing to audit." when no ignored chunks exist.

Asia/Oceania source discovery is documented in `docs/asia-oceania-source-discovery.md`. Australia Product Safety, New Zealand Product Safety, Hong Kong CFS, and FSANZ Food Recalls are now bounded active sources. Korea SafetyKorea access discovery is documented in `docs/korea-safetykorea-source-discovery.md`; contract prep is documented in `docs/korea-safetykorea-api-contract.md`. `npm run debug:korea-safetykorea-access` and `npm run audit:korea-safetykorea-contract` are non-mutating and do not add coverage. Japan, Korea, Singapore, and Taiwan must not appear as active source filters or live coverage until a future ingestion phase adds validated data and source registry entries.

USDA FSIS is not part of the current passing MVP. The local Phase 6 attempt returned HTTP `403 Forbidden` / `Access Denied`, likely from FSIS-side access control, CDN/WAF filtering, User-Agent/header filtering, IP/range filtering, or temporary endpoint restrictions. No USDA data was written, no bypass should be attempted, and no USDA fetch script is active. See `docs/USDA_FSIS_DEFERRED.md`.

## CPSC Data Pipeline

- Confirm `npm run fetch:cpsc` saves `data/raw/cpsc-recalls.json`.
- Confirm `npm run fetch:cpsc` saves `data/processed/cpsc-recalls.json`.
- Confirm `npm run fetch:cpsc` rebuilds canonical `data/processed/recalls.json`.
- Confirm both files contain a positive record count.
- Confirm raw output includes `fetchedAt`.
- Confirm normalized records include `source`, `sourceUrl`, `title`, `brandNames`, `productNames`, `category`, `hazard`, `remedy`, `recallDate`, `affectedUnits`, `description`, `slug`, and `raw`.
- Confirm the website uses `data/processed/recalls.json` as the primary local source.
- Confirm mock data remains only fallback/demo data.

## FDA/openFDA Food Pipeline

- Confirm `npm run fetch:fda-food` saves `data/raw/fda-food-recalls.json`.
- Confirm `npm run fetch:fda-food` saves `data/processed/fda-recalls.json`.
- Confirm `npm run fetch:fda-food` rebuilds canonical `data/processed/recalls.json`.
- Confirm raw FDA output includes `fetchedAt`.
- Confirm FDA records include `source: FDA`, `sourceUrl`, `title`, `brandNames`, `productNames`, `category`, `hazard` or `reason`, `recallDate`, `affectedUnits` or `productQuantity`, `description`, `slug`, and `raw`.
- Confirm canonical records preserve existing CPSC records and append FDA records by stable id.
- Confirm canonical records are sorted by `recallDate` descending where possible.

## EU Safety Gate Pipeline

- Confirm `npm run fetch:eu-safety-gate` saves `data/raw/eu-safety-gate-recalls.json`.
- Confirm `npm run fetch:eu-safety-gate` saves `data/processed/eu-safety-gate-recalls.json`.
- Confirm `npm run fetch:eu-safety-gate` rebuilds canonical `data/processed/recalls.json`.
- Confirm raw EU output includes `fetchedAt`.
- Confirm EU records include `source: EU_SAFETY_GATE`, `sourceUrl`, `title`, `productNames`, `category`, `hazard` or `reason`, `recallDate`, `description`, `slug`, and `raw`.
- Confirm the EU source label renders as `European Union · Safety Gate`.
- Confirm official Safety Gate detail URLs use `https://ec.europa.eu/safety-gate-alerts/screen/webReport/alertDetail/{id}`.
- Confirm official Safety Gate image URLs use `https://ec.europa.eu/safety-gate-alerts/public/api/notification/image/{photoId}` where images are available.
- Confirm canonical records preserve existing CPSC, FDA/openFDA, France RappelConso, and Canada records and append bounded EU Safety Gate records by stable id.
- Confirm canonical records are sorted by `recallDate` descending where possible.
- Confirm `npm run audit:sources` passes with active eight-source coverage.
- Confirm `npm run audit:eu-safety-gate` passes.
- Confirm EU audit reports barcode, model/type, batch/serial, risk type, notifying country, country of origin, countries concerned or market detail coverage.
- Confirm EU audit reports no suspicious category mappings and no EU records are mapped to food/allergy.
- Confirm EU detail pages show Safety Gate risk type, identifiers, notifying country, country of origin, countries concerned when present, and the official Safety Gate source link.
- Confirm `npm run update:eu-safety-gate` remains an explicit refresh command and is not part of `npm run check` or `npm run build`.
- Confirm the default EU Safety Gate limit remains `EU_SAFETY_GATE_LIMIT=100`.
- Confirm EU raw, EU processed, and canonical processed data are reviewed and committed together after a successful EU update.

## UK FSA Food Alerts Pipeline

- Confirm `npm run fetch:uk-fsa` saves `data/raw/uk-fsa-alerts.json`.
- Confirm `npm run fetch:uk-fsa` saves `data/processed/uk-fsa-alerts.json`.
- Confirm `npm run fetch:uk-fsa` rebuilds canonical `data/processed/recalls.json`.
- Confirm raw UK FSA output includes `fetchedAt`.
- Confirm UK FSA records include `source: UK_FSA`, `sourceUrl`, `title`, `brandNames`, `productNames`, `category`, `hazard` or `reason`, `recallDate`, `description`, `slug`, and `raw`.
- Confirm the UK FSA source label renders as `United Kingdom · FSA Food Alerts`.
- Confirm official FSA notice URLs use `https://alerts.food.gov.uk/news-alerts/alert/{notation}` or `https://www.food.gov.uk/news-alerts/alert/{notation}`.
- Confirm canonical records preserve existing CPSC, FDA/openFDA, France RappelConso, Canada, and EU Safety Gate records and append bounded UK FSA records by stable id.
- Confirm canonical records are sorted by `recallDate` descending where possible.
- Confirm `npm run audit:uk-fsa` passes.
- Confirm UK FSA audit reports alert type distribution, pack size coverage, batch/date detail coverage, allergen or risk label coverage, retailer/distribution-like detail coverage, image and related-media availability, official URL shape, source filter values, and suspicious category mappings.
- Confirm UK FSA detail pages show FSA alert reference, pack size, batch/date details when present, allergen/risk details, consumer action, and the official FSA source link.
- Confirm Food Alert For Action records do not display generic instructions such as "Food businesses selling these products..." as the brand or company name.
- Confirm `npm run update:uk-fsa` remains an explicit refresh command and is not part of `npm run check` or `npm run build`.
- Confirm `npm run update:uk-fsa` is documented as fetch, normalize, merge, then audit.
- For no-network QA phases, confirm `npm run data:uk-fsa:normalize`, `npm run data:merge`, and `npm run audit:uk-fsa` validate the committed raw file path without calling the UK FSA endpoint.
- Confirm the default UK FSA limit remains `UK_FSA_LIMIT=100`.

## Australia Product Safety Pipeline

- Confirm `npm run fetch:australia-product-safety` saves `data/raw/australia-product-safety-recalls.json`.
- Confirm `npm run fetch:australia-product-safety` saves `data/processed/australia-product-safety-recalls.json`.
- Confirm `npm run fetch:australia-product-safety` rebuilds canonical `data/processed/recalls.json`.
- Confirm raw Australia output includes `fetchedAt`.
- Confirm Australia records include `source: AU_PRODUCT_SAFETY`, `sourceUrl`, `title`, `brandNames`, `productNames`, `category`, `hazard` or `reason`, `recallDate`, `description`, `slug`, official image URLs when available, and `raw`.
- Confirm the Australia source label renders as `Australia · Product Safety Australia`.
- Confirm official source URLs use `https://www.productsafety.gov.au/search-consumer-product-recalls/...`.
- Confirm official image URLs use `https://www.productsafety.gov.au/system/files/...`.
- Confirm canonical records preserve existing sources and append bounded Australia records by stable id.
- Confirm canonical records are sorted by `recallDate` descending where possible.
- Confirm `npm run audit:australia-product-safety` passes.
- Confirm Australia audit reports source count, canonical count, wrong source ids, duplicate ids/slugs/source URLs, official URL shape, invalid dates, image availability, official image host validity, suspicious image candidates, category distribution, supplier/brand coverage, product coverage, hazard/reason coverage, remedy/action coverage, distribution detail availability, identifier coverage, raw HTML leakage, and source filter values.
- Confirm `npm run update:australia-product-safety` remains an explicit refresh command and is not part of `npm run check` or `npm run build`.
- For no-network QA phases, confirm `npm run data:australia-product-safety:normalize`, `npm run data:merge`, and `npm run audit:australia-product-safety` validate the committed raw file path without calling Product Safety Australia.
- Confirm the default Australia Product Safety limit remains `AU_PRODUCT_SAFETY_LIMIT=100`.
- Confirm future full Australia backfills are kept in ignored chunks and do not expand canonical data without a separate reviewed phase.

## New Zealand Product Safety Pipeline

- Confirm `npm run debug:new-zealand-product-safety-access` reports the official Product Safety New Zealand listing/detail pages as feasible without writing records.
- Confirm `npm run fetch:new-zealand-product-safety` saves `data/raw/new-zealand-product-safety-recalls.json`.
- Confirm `npm run fetch:new-zealand-product-safety` saves `data/processed/new-zealand-product-safety-recalls.json`.
- Confirm `npm run fetch:new-zealand-product-safety` rebuilds canonical `data/processed/recalls.json`.
- Confirm raw New Zealand output includes `fetchedAt`.
- Confirm New Zealand records include `source: NZ_PRODUCT_SAFETY`, `sourceUrl`, `title`, `brandNames`, `productNames`, `category`, `hazard` or `reason`, `recallDate`, `description`, `slug`, official image URLs, and `raw`.
- Confirm the New Zealand source label renders as `New Zealand · Product Safety`.
- Confirm official source URLs use `https://www.productsafety.govt.nz/recalls/...`.
- Confirm official image URLs use `https://www.productsafety.govt.nz/assets/uploads/...`.
- Confirm canonical records preserve existing sources and append bounded New Zealand records by stable id.
- Confirm canonical records are sorted by `recallDate` descending where possible.
- Confirm `npm run audit:new-zealand-product-safety` passes.
- Confirm New Zealand audit reports source count, canonical count, wrong source ids, duplicate ids/slugs/source URLs, official URL shape, invalid dates, image availability, official image host validity, specialist-source exclusions, category distribution, supplier/brand coverage, product coverage, hazard/reason coverage, remedy/action coverage, identifier coverage, raw HTML leakage, and source filter values.
- Confirm `npm run update:new-zealand-product-safety` remains an explicit refresh command and is not part of `npm run check` or `npm run build`.
- For no-network QA phases, confirm `npm run data:new-zealand-product-safety:normalize`, `npm run data:merge`, and `npm run audit:new-zealand-product-safety` validate the committed raw file path without calling Product Safety New Zealand.
- Confirm the default New Zealand Product Safety limit remains `NZ_PRODUCT_SAFETY_LIMIT=100`.
- Confirm future full New Zealand backfills are kept in ignored chunks and do not expand canonical data without a separate reviewed phase.
- Confirm New Zealand MPI food and NZTA vehicle recalls remain separate future source candidates.

## Korea SafetyKorea Access Discovery

- Confirm `npm run debug:korea-safetykorea-access` runs without writing raw Korea records, processed Korea records, or canonical data.
- Confirm the diagnostic reports `hasAuthKey`, `authHeaderName: AuthKey`, generated list/detail endpoints, request mode, fixture mapping, and feasibility.
- Confirm missing `SAFETYKOREA_API_KEY` exits successfully with missing-auth behavior.
- Confirm `npm run audit:korea-safetykorea-contract` validates URL builders, AuthKey header handling, fixture mapping, Korean text preservation, category mapping, and image extraction without network access.
- Confirm Phase 35 did not add `KR_SAFETYKOREA` to active source filters because official recall-record access was not confirmed without an application/service-key flow.
- Confirm Phase 36 did not add `KR_SAFETYKOREA` to active source filters; it only prepared the official AuthKey/list/detail API contract.
- Confirm no Korea landing page exists until a future live source phase adds validated records.
- Confirm canonical total remains 1201 after FSANZ activation and until a future Korea source phase adds validated Korea records.
- Confirm `SAFETYKOREA_API_KEY` is not committed or stored in the repo.

## Hong Kong CFS Food Alerts Pipeline

- Confirm `npm run debug:hong-kong-cfs-access` reports the official CFS listing, XML feed, archive pages, and detail pages as feasible without writing records.
- Confirm `npm run fetch:hong-kong-cfs` saves `data/raw/hong-kong-cfs-food-alerts.json`.
- Confirm `npm run fetch:hong-kong-cfs` saves `data/processed/hong-kong-cfs-food-alerts.json`.
- Confirm `npm run fetch:hong-kong-cfs` rebuilds canonical `data/processed/recalls.json`.
- Confirm raw Hong Kong CFS output includes `fetchedAt`.
- Confirm Hong Kong CFS records include `source: HK_CFS`, official CFS `sourceUrl`, `title`, product names, company/brand where available, `category`, `hazard` or `reason`, `recallDate`, `description`, `slug`, official CFS image URLs when available, and `raw`.
- Confirm the Hong Kong CFS source label renders as `Hong Kong · Centre for Food Safety`.
- Confirm official source URLs use `https://www.cfs.gov.hk/english/whatsnew/whatsnew_fa/...`.
- Confirm official image URLs use `https://www.cfs.gov.hk/...` only.
- Confirm canonical records preserve existing sources and append bounded Hong Kong records by stable id.
- Confirm canonical records are sorted by `recallDate` descending where possible.
- Confirm `npm run audit:hong-kong-cfs` passes.
- Confirm Hong Kong CFS audit reports source count, canonical count, wrong source ids, duplicate ids/slugs/source URLs, official URL shape, invalid dates, image availability, official image host validity, category distribution, product/company coverage, hazard/reason coverage, remedy/action coverage, identifier coverage, raw HTML leakage, and source filter values.
- Confirm `npm run update:hong-kong-cfs` remains an explicit refresh command and is not part of `npm run check` or `npm run build`.
- For no-network QA phases, confirm `npm run data:hong-kong-cfs:normalize`, `npm run data:merge`, and `npm run audit:hong-kong-cfs` validate the committed raw file path without calling CFS.
- Confirm the default Hong Kong CFS limit remains `HK_CFS_LIMIT=100`.
- Confirm future full Hong Kong CFS backfills are kept in ignored chunks and do not expand canonical data without a separate reviewed phase.

## Australia/New Zealand FSANZ Food Recalls Pipeline

- Confirm `npm run debug:fsanz-food-recalls-access` reports the official FSANZ listing, RSS, and detail pages as feasible without writing records.
- Confirm `npm run fetch:fsanz-food-recalls` saves `data/raw/fsanz-food-recalls.json`.
- Confirm `npm run fetch:fsanz-food-recalls` saves `data/processed/fsanz-food-recalls.json`.
- Confirm `npm run fetch:fsanz-food-recalls` rebuilds canonical `data/processed/recalls.json`.
- Confirm raw FSANZ output includes `fetchedAt`.
- Confirm FSANZ records include `source: FSANZ_FOOD_RECALLS`, official FSANZ `sourceUrl`, `title`, company/brand where available, `productNames`, `category`, `hazard` or `reason`, `recallDate`, `description`, `slug`, official FSANZ image URLs when available, and `raw`.
- Confirm the FSANZ source label renders as `Australia/New Zealand · FSANZ`.
- Confirm official source URLs use `https://www.foodstandards.gov.au/food-recalls/recall-alert/...`.
- Confirm official image URLs use `https://www.foodstandards.gov.au/sites/default/files/...` only.
- Confirm canonical records preserve existing sources and append bounded FSANZ records by stable id.
- Confirm canonical records are sorted by `recallDate` descending where possible.
- Confirm `npm run audit:fsanz-food-recalls` passes.
- Confirm FSANZ audit reports source count, canonical count, wrong source ids, duplicate ids/slugs/source URLs, official URL shape, invalid dates, image availability, official image host validity, category distribution, product/company coverage, hazard/reason coverage, remedy/action coverage, identifier coverage, raw HTML leakage, and source filter values.
- Confirm `npm run update:fsanz-food-recalls` remains an explicit refresh command and is not part of `npm run check` or `npm run build`.
- For no-network QA phases, confirm `npm run data:fsanz-food-recalls:normalize`, `npm run data:merge`, and `npm run audit:fsanz-food-recalls` validate the committed raw file path without calling FSANZ.
- Confirm the default FSANZ limit remains `FSANZ_FOOD_RECALLS_LIMIT=100`.
- Confirm future full FSANZ backfills are kept in ignored chunks and do not expand canonical data without a separate reviewed phase.

## Pages

- `/`
- `/checker`
- `/checker?q=pistachio&source=FDA`
- `/checker?q=smoke&source=CPSC`
- `/checker?q=toy&source=EU_SAFETY_GATE`
- `/checker?source=UK_FSA`
- `/checker?source=AU_PRODUCT_SAFETY`
- `/checker?source=NZ_PRODUCT_SAFETY`
- `/checker?source=HK_CFS`
- `/checker?source=FSANZ_FOOD_RECALLS`
- `/watchlist`
- `/404`
- `/baby-product-recalls`
- `/battery-recalls`
- `/food-allergy-recalls`
- `/household-product-recalls`
- `/us-product-recalls`
- `/canada-product-recalls`
- `/eu-safety-gate-recalls`
- `/france-product-recalls`
- `/uk-food-recalls`
- `/australia-product-recalls`
- `/new-zealand-product-recalls`
- `/hong-kong-food-recalls`
- `/australia-new-zealand-food-recalls`
- one real CPSC `/recalls/[slug]` page
- one real FDA `/recalls/[slug]` page, when FDA data has been fetched
- one real EU Safety Gate `/recalls/[slug]` page, when EU data has been fetched
- one real UK FSA `/recalls/[slug]` page, when UK FSA data has been fetched
- one real Australia Product Safety `/recalls/[slug]` page, when Australia data has been fetched
- one real New Zealand Product Safety `/recalls/[slug]` page, when New Zealand data has been fetched
- one real Hong Kong CFS `/recalls/[slug]` page, when Hong Kong data has been fetched
- one real FSANZ `/recalls/[slug]` page, when FSANZ data has been fetched
- one normalized real CPSC `/brands/[brand]` page
- Confirm source labels render through `src/lib/recall-sources.ts`.
- Confirm page labels identify EU records as European Union Safety Gate records.
- Confirm page labels identify UK FSA records as United Kingdom FSA Food Alerts records.
- Confirm page labels identify Australia records as Australia Product Safety Australia records.
- Confirm page labels identify New Zealand records as New Zealand Product Safety records.
- Confirm page labels identify Hong Kong records as Centre for Food Safety food alerts.
- Confirm page labels identify FSANZ records as Australia/New Zealand FSANZ food recalls.
- Confirm homepage source cards distinguish market, official source, and recall domain.
- Confirm Australia and New Zealand homepage cards remain separate general product recall cards.
- Confirm the FSANZ homepage card is presented as a regional food recall source and not as a merged Australia/New Zealand product recall card.
- Confirm `/robots.txt` allows crawling.
- Confirm sitemap generation remains deferred until a canonical deployment URL is chosen.
- Confirm category pages show a matching local record count.
- Confirm `/household-product-recalls` shows Household Products notices and the page count matches the `household-appliance` category filter count.
- Confirm country/source landing pages show United States 401, Canada 100, EU Safety Gate 100, France 100, UK Food 100, Australia 100, New Zealand 100, Hong Kong 100, and Australia/New Zealand FSANZ 100 indexed notices.
- Confirm `/food-allergy-recalls` shows FDA/openFDA food records before CPSC food/allergy records when FDA records exist.
- Confirm core pages remain readable at narrow mobile widths and long titles/labels wrap instead of overflowing.
- Confirm recall detail pages show company recall history and related recall sections.
- Confirm recall detail pages use small source attribution links instead of large official source CTAs.
- Confirm recall detail pages show conservative what-to-check items without invented model, UPC, lot, or date-code values.

## Brand Pages

- Confirm obvious `dba` or `doing business as` source names use a cleaner display brand.
- Confirm raw/source brand names still appear when they differ from the display brand.
- Confirm brand URLs are readable and not excessively long.
- Confirm brand URLs do not cut off in the middle of a word.
- Confirm normalized brand routes still show related recalls.

## Slug Quality

- Confirm recall URLs keep the source id suffix, for example `cpsc-26565`.
- Confirm recall URLs do not cut off in the middle of a word.
- Confirm common filler phrases such as `recalled due to`, `risk of`, and `serious injury or death` are not overrepresented in generated recall URLs.
- Confirm a cleaned real recall URL still renders its detail page.

## Search Cases

- Confirm `/checker?q=arizer` reads the URL query on load and renders local results.
- Confirm `/checker?q=pistachio&source=FDA` applies the FDA/openFDA source filter.
- Confirm `/checker?q=smoke&source=CPSC` applies the CPSC source filter.
- Confirm `/checker?q=toy&source=EU_SAFETY_GATE` applies the EU Safety Gate source filter.
- Confirm `/checker?source=UK_FSA` applies the UK FSA source filter.
- Confirm `/checker?source=AU_PRODUCT_SAFETY` applies the Australia Product Safety source filter.
- Confirm `/checker?source=NZ_PRODUCT_SAFETY` applies the New Zealand Product Safety source filter.
- Confirm `/checker?source=HK_CFS` applies the Hong Kong CFS source filter.
- Confirm `/checker?source=FSANZ_FOOD_RECALLS` applies the FSANZ Food Recalls source filter.
- Confirm a real UK FSA food, allergen, batch, or date query returns an exact or possible match when UK FSA records exist.
- Confirm source, category, sort, and date filter changes update the URL query string.
- Confirm category filters include all, baby/kids, battery/electronics, food/allergy, household/appliance, food, and general.
- Confirm sort options include best match, newest first, and oldest first.
- A full CPSC recall title returns an exact match.
- A real CPSC brand name returns an exact or possible match.
- A real FDA recalling firm or food product returns an exact or possible match when FDA records exist.
- A normalized display brand name returns a match.
- `battery` returns possible or related matches when battery records exist.
- `smoke detector` returns possible or related matches when detector records exist.
- `not-a-real-product` returns the no-clear-match warning.
- Confirm result cards show match badges, source label, recall date, product/brand context, hazard summary, and detail links.

## Source Counts

- Confirm CPSC count is 301.
- Confirm FDA/openFDA count is 100.
- Confirm France RappelConso count is 100.
- Confirm Canada Recalls and Safety Alerts count is 100.
- Confirm EU Safety Gate count is 100.
- Confirm UK FSA Food Alerts count is 100.
- Confirm Australia Product Safety count is 100.
- Confirm New Zealand Product Safety count is 100.
- Confirm Hong Kong CFS count is 100.
- Confirm FSANZ Food Recalls count is 100.
- Confirm total canonical count is 1201.
- Confirm active source filter values are `all`, `CPSC`, `FDA`, `FR_RAPPELCONSO`, `CA_RECALLS`, `EU_SAFETY_GATE`, `UK_FSA`, `AU_PRODUCT_SAFETY`, `NZ_PRODUCT_SAFETY`, `HK_CFS`, and `FSANZ_FOOD_RECALLS`.
- Confirm Korea and Japan do not appear as active source filters.
- Confirm Singapore and Taiwan do not appear as active source filters.
- Confirm `npm run audit:sources` reports no unknown source ids, no duplicate ids, no active source with zero records, and no source-registry/data mismatch.
- Confirm consumer-facing coverage copy says indexed notices and official source feeds, not complete global coverage.
- Confirm long source labels wrap cleanly on checker, watchlist, category, brand, and detail pages at mobile widths.

## I18n Foundation

- Confirm current launch UI remains English-only.
- Confirm `src/lib/i18n.ts` supports only `en`.
- Confirm no locale routes such as `/en` or `/ko` were added.
- Confirm no browser language detection, IP redirect, `hreflang`, or localized sitemap behavior was added.
- Confirm official source text remains untranslated and source-traceable.
- Confirm future i18n planning is documented in `docs/i18n-foundation.md`.
- Confirm practical string boundaries are documented in `docs/i18n-string-audit.md`.

## Watchlist Demo

- Confirm `/checker?q=pistachio&source=FDA` can save a search to browser localStorage.
- Confirm `/brands/arizer-tech` can save the normalized brand to browser localStorage.
- Confirm `/watchlist` reads saved items from `recall-radar-watchlist-v1`.
- Confirm `/watchlist` shows saved search terms, saved brands, source/category preferences, source labels, and detail links.
- Confirm saved watchlist items can be removed individually.
- Confirm all saved watchlist items can be cleared.
- Confirm the email preview form does not submit, send, store, or transmit an email address.
- Confirm watchlist matching results show the required disclaimer.

## Safety Copy

- Search results show the required disclaimer.
- No page claims that a product is safe.
- Recall detail pages show what to check and direct users to verify official notices.

## Recall Taxonomy V2 Design

- Confirm `npm run audit:recall-taxonomy-v2-design` passes.
- Confirm `docs/recall-taxonomy-v2.md` documents the old `category` field as deprecated for future data.
- Confirm `docs/llm-recall-classifier-contract.md` requires strict JSON, enum-only output, confidence, reason, evidence fields, and `needsReview`.
- Confirm `src/data/recall-taxonomy-v2.ts` is not imported into the current runtime schema yet.
- Confirm no canonical data files in `data/processed` changed.
- Confirm no source fetch, normalize, merge, backfill, LLM, backend, database, translation, or UI route migration was introduced in Phase 41.
- Confirm the Yamaha UMAX Bistro example maps to `vehicles-mobility`, not `food-grocery`.
- Confirm food contamination examples use contamination hazard types rather than forcing every food recall into `allergen`.

## LLM Recall Classifier Dry Run

- Confirm `npm run classify:recalls:taxonomy-v2:dry-run` succeeds in default mock mode.
- Confirm `npm run audit:llm-classifier-dry-run` passes.
- Confirm generated dry-run files are under ignored `outputs/llm-classifier/`.
- Confirm generated dry-run files are not staged or committed.
- Confirm the mock sample includes at least one Yamaha/UMAX/Bistro/golf/utility vehicle edge case when present in current data.
- Confirm strict JSON output validates against `RecallClassificationV2`.
- Confirm the dry run reports success, failed, needsReview, legacy comparison flags, and token/cost estimates.
- Confirm live providers are skipped unless the matching local env key exists.
- Confirm no canonical data files in `data/raw` or `data/processed` changed.
- Confirm no runtime pages, filters, source ids, source counts, backend, database, translation, or source refresh scripts changed.

## Recall Data Schema V2

- Confirm `npm run audit:recall-data-schema-v2-readiness` passes.
- Confirm `docs/recall-data-schema-v2.md` defines the final future normalized record shape.
- Confirm `docs/recall-db-schema-v2.md` is planning only and does not add DB implementation.
- Confirm `docs/phase-44-per-source-llm-classification-plan.md` plans Gemini per-source classification into ignored outputs only.
- Confirm `src/data/recall-data-schema-v2.ts` is type-only and not wired into runtime loaders.
- Confirm `NormalizedRecallV2` requires `classification` and does not require old `category`.
- Confirm current canonical `data/processed/recalls.json` remains unchanged.
- Confirm no UI category migration, route migration, source refresh, LLM call, backend, database, or translation was introduced in Phase 43.

## LLM Environment Setup

- Confirm `.env.example` exists and contains no real keys.
- Confirm `.env.local` and `.env.*.local` are ignored.
- Confirm `npm run debug:llm-classifier-env` prints masked key status only.
- Confirm `npm run probe:gemini-classifier` skips clearly when `GEMINI_API_KEY` is missing.
- If `GEMINI_API_KEY` is present, confirm the probe validates one artificial recall response.
- Confirm generated outputs under `outputs/llm-classifier/` are ignored and not committed.
- Confirm no full per-source classification, canonical data migration, UI migration, source refresh, backend, database, or translation happened in Phase 44A.

## Taxonomy V2 UI Preview

- Confirm `npm run audit:taxonomy-v2-ui-preview` passes.
- Open `/dev/taxonomy-v2-preview` and confirm it is clearly labeled Development Preview.
- Confirm the page shows all 15 approved future product-family cards in order, secondary issue tags, sample detail sections, sample classified records, and the legacy replacement map.
- Confirm the visible public category label is exactly `Need Review`.
- Confirm issue/hazard tags are described as secondary metadata, not primary public navigation.
- Confirm `/dev/taxonomy-v2-preview` is not linked from the public homepage or primary navigation.
- Confirm current category pages, source pages, checker, homepage, and detail pages still work unchanged.
