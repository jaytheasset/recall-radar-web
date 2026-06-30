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

## CPSC Data Pipeline

- Confirm `npm run fetch:cpsc` saves `data/raw/cpsc-recalls.json`.
- Confirm `npm run fetch:cpsc` saves `data/processed/recalls.json`.
- Confirm both files contain a positive record count.
- Confirm raw output includes `fetchedAt`.
- Confirm normalized records include `source`, `sourceUrl`, `title`, `brandNames`, `productNames`, `category`, `hazard`, `remedy`, `recallDate`, `affectedUnits`, `description`, `slug`, and `raw`.
- Confirm the website uses `data/processed/recalls.json` as the primary local source.
- Confirm mock data remains only fallback/demo data.

## Pages

- `/`
- `/checker`
- `/baby-product-recalls`
- `/battery-recalls`
- `/food-allergy-recalls`
- one real CPSC `/recalls/[slug]` page
- one real CPSC `/brands/[brand]` page
- Confirm page labels identify records as local CPSC data.

## Search Cases

- A full CPSC recall title returns an exact local match.
- A real CPSC brand name returns an exact or possible local match.
- `battery` returns possible or related local matches when battery records exist.
- `smoke detector` returns possible or related local matches when detector records exist.
- `not-a-real-product` returns no local match.

## Safety Copy

- Search results show the required disclaimer.
- No page claims that a product is safe.
- Recall detail pages direct users to verify official notices.
