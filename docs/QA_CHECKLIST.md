# QA Checklist

## Local Project Isolation

- Confirm the project folder is `C:\Users\pc\codex-projects\recall-radar-web`.
- Confirm no files from other projects were copied or reused.
- Confirm no Git remote is configured.
- Confirm no real `.env` files exist.

## Commands

- `npm run check`
- `npm run build`
- `npm run fetch:cpsc`
- `npm run normalize:cpsc`
- `npm run fetch:fda-food`
- `npm run normalize:fda-food`
- `npm run dev`
- `npm run preview`

Do not run fetch scripts during local UI-only phases unless the task explicitly asks for fresh local data.

USDA FSIS is not part of the current passing MVP. The local Phase 6 attempt returned HTTP `403 Forbidden` / `Access Denied`, so USDA integration is deferred and no USDA fetch script is active. See `docs/USDA_FSIS_DEFERRED.md`.

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

## Pages

- `/`
- `/checker`
- `/checker?q=pistachio&source=FDA`
- `/checker?q=smoke&source=CPSC`
- `/watchlist`
- `/baby-product-recalls`
- `/battery-recalls`
- `/food-allergy-recalls`
- one real CPSC `/recalls/[slug]` page
- one real FDA `/recalls/[slug]` page, when FDA data has been fetched
- one normalized real CPSC `/brands/[brand]` page
- Confirm page labels identify CPSC records as local CPSC data.
- Confirm page labels identify FDA records as local FDA/openFDA data.
- Confirm category pages show a matching local record count.
- Confirm `/food-allergy-recalls` shows FDA/openFDA food records before CPSC food/allergy records when FDA records exist.
- Confirm core pages remain readable at narrow mobile widths and long titles/labels wrap instead of overflowing.

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
- Confirm source, category, sort, and date filter changes update the URL query string.
- Confirm category filters include all, baby/kids, battery/electronics, food/allergy, household/appliance, food, and general.
- Confirm sort options include best match, newest first, and oldest first.
- A full CPSC recall title returns an exact local match.
- A real CPSC brand name returns an exact or possible local match.
- A real FDA recalling firm or food product returns an exact or possible local match when FDA records exist.
- A normalized display brand name returns a local match.
- `battery` returns possible or related local matches when battery records exist.
- `smoke detector` returns possible or related local matches when detector records exist.
- `not-a-real-product` returns no local match.
- Confirm result cards show match badges, source label, recall date, product/brand context, hazard summary, and detail links.

## Watchlist Demo

- Confirm `/checker?q=pistachio&source=FDA` can save a search to browser localStorage.
- Confirm `/brands/arizer-tech` can save the normalized brand to browser localStorage.
- Confirm `/watchlist` reads saved items from `recall-radar-watchlist-v1`.
- Confirm `/watchlist` shows saved search terms, saved brands, source/category preferences, source labels, and detail links.
- Confirm saved watchlist items can be removed individually.
- Confirm all saved watchlist items can be cleared.
- Confirm the demo alert form says local demo only and does not submit, send, store, or transmit an email address.
- Confirm watchlist matching results show the required disclaimer.

## Safety Copy

- Search results show the required disclaimer.
- No page claims that a product is safe.
- Recall detail pages show what to check and direct users to verify official notices.
