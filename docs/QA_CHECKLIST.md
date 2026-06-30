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
- `npm run dev`
- `npm run preview`

Do not run `npm run fetch:cpsc` during local UI-only phases unless the task explicitly asks for fresh CPSC data.

## CPSC Data Pipeline

- Confirm `npm run fetch:cpsc` saves `data/raw/cpsc-recalls.json`.
- Confirm `npm run fetch:cpsc` saves `data/processed/recalls.json`.
- Confirm both files contain a positive record count.
- Confirm raw output includes `fetchedAt`.
- Confirm normalized records include `source`, `sourceUrl`, `title`, `brandNames`, `productNames`, `category`, `hazard`, `remedy`, `recallDate`, `affectedUnits`, `description`, `slug`, and `raw`.
- Confirm the website uses `data/processed/recalls.json` as the primary local source.
- Confirm mock data remains only fallback/demo data.
- Confirm Phase 4 UI work does not add any new data source.

## Pages

- `/`
- `/checker`
- `/baby-product-recalls`
- `/battery-recalls`
- `/food-allergy-recalls`
- one real CPSC `/recalls/[slug]` page
- one normalized real CPSC `/brands/[brand]` page
- Confirm page labels identify records as local CPSC data.
- Confirm category pages show a matching local CPSC record count.

## Brand Pages

- Confirm obvious `dba` or `doing business as` source names use a cleaner display brand.
- Confirm raw/source brand names still appear when they differ from the display brand.
- Confirm brand URLs are readable and not excessively long.
- Confirm normalized brand routes still show related recalls.

## Search Cases

- A full CPSC recall title returns an exact local match.
- A real CPSC brand name returns an exact or possible local match.
- A normalized display brand name returns a local match.
- `battery` returns possible or related local matches when battery records exist.
- `smoke detector` returns possible or related local matches when detector records exist.
- `not-a-real-product` returns no local match.
- Confirm result cards show match badges, source label, recall date, product/brand context, hazard summary, and detail links.

## Safety Copy

- Search results show the required disclaimer.
- No page claims that a product is safe.
- Recall detail pages show what to check and direct users to verify official notices.
