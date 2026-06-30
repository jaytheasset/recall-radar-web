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
- Confirm the website still uses local mock data until a later phase explicitly switches it.

## Pages

- `/`
- `/checker`
- `/baby-product-recalls`
- `/battery-recalls`
- `/food-allergy-recalls`
- `/recalls/brightnest-convertible-crib-rail-guard`
- `/brands/brightnest`

## Search Cases

- `BrightNest` returns an exact local match.
- `VEB-20` returns an exact local match.
- `peanut granola` returns a possible local match.
- `battery` returns related local matches.
- `not-a-real-product` returns no local match.

## Safety Copy

- Search results show the required disclaimer.
- No page claims that a product is safe.
- Recall detail pages direct users to verify official notices.
