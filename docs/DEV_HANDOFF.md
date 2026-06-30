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

When processed CPSC records exist, they are the primary source for homepage cards, checker search results, recall detail pages, brand pages, and category pages. Mock records remain available only as local fallback/demo data.

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

## Local CPSC Pipeline

Phase 2 added a local-only CPSC recall data pipeline. Phase 3 connects the processed CPSC file to the website.

Commands:

- `npm run fetch:cpsc` fetches current-year public CPSC recall JSON and writes local files.
- `npm run normalize:cpsc` rebuilds processed recall data from `data/raw/cpsc-recalls.json`.
- `npm run build:data` currently runs the CPSC fetch pipeline.

Local output files:

- `data/raw/cpsc-recalls.json`
- `data/processed/recalls.json`

The fetch script calls `https://www.saferproducts.gov/RestWebServices/Recall` without an API key. It writes only after the API returns non-empty records, and each raw file includes a `fetchedAt` timestamp.

Normalized records use `src/data/recall-types.ts` and include `id`, `source`, `sourceUrl`, `title`, `brandNames`, `productNames`, `category`, `hazard`, `remedy`, `recallDate`, `affectedUnits`, `description`, `slug`, and `raw`.

Do not call `npm run fetch:cpsc` during Phase 3 or Phase 4 unless a later task explicitly asks for fresh local CPSC data.

## Site Data Loader

`src/lib/recall-data.ts`:

- loads `data/processed/recalls.json` at build time
- maps CPSC records into a UI-safe `SiteRecall` shape
- limits generated detail slugs while preserving uniqueness with the CPSC id
- builds brand groups from `brandNames`
- keeps raw CPSC brand/legal names on each recall
- adds normalized consumer-facing brand display names and shorter brand slugs through `src/lib/brand-normalize.ts`
- classifies records lightly into baby/kids, battery/electronics, food/allergy, household/appliance, or general consumer product
- falls back to mock records only when no processed records are available

## Brand Normalization

`src/lib/brand-normalize.ts` is intentionally conservative:

- prefers explicit `dba`, `d/b/a`, or `doing business as` names
- removes trailing CPSC location phrases such as `of Houston, Texas` when safe
- removes common legal suffix noise such as `Inc.`, `LLC`, `Ltd.`, `Corporation`, and `Co. Ltd.`
- keeps the raw source name available on recall detail and brand pages
- limits brand slugs to avoid very long legal-entity URLs

Example:

- raw source name: `7111495 Canada Inc., dba Arizer Tech, of Waterloo, Ontario`
- display brand: `Arizer Tech`
- route: `/brands/arizer-tech`

## Search Helper

`src/lib/recall-search.ts` exports:

- `searchRecalls`
- `getRecallMatch`
- `MATCH_LABELS`
- `NO_MATCH_DISCLAIMER`

Match types are `exact`, `possible`, `related`, and `none`.

The checker renders grouped local results with match badges, recall date, source label, product/brand context, hazard summary, and detail links. Keep the required no-match disclaimer exact wherever search results appear.

## Guardrails

Keep this repo local-only. Do not add remotes, secrets, deployments, databases, or external API calls except the local public CPSC recall fetch allowed for phase 2.
