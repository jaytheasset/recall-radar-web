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
- `npm run build:data` currently runs the CPSC fetch pipeline and the FDA/openFDA fetch pipeline.

Local output files:

- `data/raw/cpsc-recalls.json`
- `data/raw/fda-food-recalls.json`
- `data/processed/cpsc-recalls.json`
- `data/processed/fda-recalls.json`
- `data/processed/recalls.json`

The fetch script calls `https://www.saferproducts.gov/RestWebServices/Recall` without an API key. It writes only after the API returns non-empty records, and each raw file includes a `fetchedAt` timestamp.

The FDA/openFDA fetch script calls `https://api.fda.gov/food/enforcement.json` without an API key. It fetches a limited set of recent records, writes only after the API returns non-empty records, and each raw file includes a `fetchedAt` timestamp.

Normalized records use `src/data/recall-types.ts` and include `id`, `source`, `sourceUrl`, `title`, `brandNames`, `productNames`, `category`, `hazard`, `remedy`, `recallDate`, `affectedUnits`, `description`, `slug`, and `raw`. FDA records can also include `classification`, `reason`, `distributionPattern`, `productQuantity`, `recallNumber`, and `status`.

Do not call fetch scripts during UI-only phases unless a later task explicitly asks for fresh local data.

## Site Data Loader

`src/lib/recall-data.ts`:

- loads `data/processed/recalls.json` at build time
- maps CPSC and FDA/openFDA records into a UI-safe `SiteRecall` shape
- labels CPSC records as `Local CPSC data`
- labels FDA records as `Local FDA/openFDA data`
- builds concise recall detail slugs from cleaned title text, with product/brand fallback context
- limits generated detail slugs at word boundaries while preserving uniqueness with the CPSC id
- builds brand groups from `brandNames`
- keeps raw CPSC brand/legal names on each recall
- adds normalized consumer-facing brand display names and shorter brand slugs through `src/lib/brand-normalize.ts`
- classifies records lightly into baby/kids, battery/electronics, food/allergy, household/appliance, or general consumer product
- routes FDA/openFDA food records into the food/allergy page for local browsing
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
- `NO_MATCH_DISCLAIMER`

Match types are `exact`, `possible`, `related`, and `none`.

The checker renders grouped local results with match badges, recall date, source label, product/brand context, hazard summary, category, and detail links. Keep the required no-match disclaimer exact wherever search results appear.

Phase 7 added local-only search controls on `/checker`:

- keyword/product/brand/model/UPC/lot text query
- source filter for all records, CPSC, or FDA/openFDA
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
- `/watchlist` embeds the existing local recall data at build time and previews matching local recall records in the browser.
- The demo alert form is labeled `Local demo only - no email is sent`; it does not submit, send, store, or transmit email addresses.

The watchlist is not an alert backend. It uses only browser `localStorage`; there is no API endpoint, server persistence, database, email service, external dependency, or network request.

## Guardrails

Keep this repo local-only. Do not add remotes, secrets, deployments, databases, or external API calls except the local public CPSC and FDA/openFDA fetch scripts when explicitly requested for data-pipeline phases.
