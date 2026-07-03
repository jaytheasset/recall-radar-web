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
- `npm run validate:launch`
- `npm run plan:source-backfills`
- `npm run audit:source-backfills`
- `npm run dev`
- `npm run preview`

Do not run fetch scripts during local UI-only phases unless the task explicitly asks for fresh local data.

For launch or staging readiness, use `docs/LAUNCH_CHECKLIST.md`. `npm run validate:launch` is local-only and must not include network fetch/update scripts.

Global backfill planning is documented in `docs/global-backfill-runbook.md`. `npm run plan:source-backfills` must not mutate source data, and `npm run audit:source-backfills` should pass with "No source backfill chunks found; nothing to audit." when no ignored chunks exist.

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
- Confirm `npm run audit:sources` passes with only active six-source coverage.
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

## Pages

- `/`
- `/checker`
- `/checker?q=pistachio&source=FDA`
- `/checker?q=smoke&source=CPSC`
- `/checker?q=toy&source=EU_SAFETY_GATE`
- `/checker?source=UK_FSA`
- `/watchlist`
- `/404`
- `/baby-product-recalls`
- `/battery-recalls`
- `/food-allergy-recalls`
- one real CPSC `/recalls/[slug]` page
- one real FDA `/recalls/[slug]` page, when FDA data has been fetched
- one real EU Safety Gate `/recalls/[slug]` page, when EU data has been fetched
- one real UK FSA `/recalls/[slug]` page, when UK FSA data has been fetched
- one normalized real CPSC `/brands/[brand]` page
- Confirm source labels render through `src/lib/recall-sources.ts`.
- Confirm page labels identify EU records as European Union Safety Gate records.
- Confirm page labels identify UK FSA records as United Kingdom FSA Food Alerts records.
- Confirm `/robots.txt` allows crawling.
- Confirm sitemap generation remains deferred until a canonical deployment URL is chosen.
- Confirm category pages show a matching local record count.
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
- Confirm total canonical count is 801.
- Confirm active source filter values are `all`, `CPSC`, `FDA`, `FR_RAPPELCONSO`, `CA_RECALLS`, `EU_SAFETY_GATE`, and `UK_FSA`.
- Confirm Korea, Japan, and Australia do not appear as active source filters.
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
