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

Do not call `npm run fetch:cpsc` during Phase 3 unless a later task explicitly asks for fresh local CPSC data.

## Site Data Loader

`src/lib/recall-data.ts`:

- loads `data/processed/recalls.json` at build time
- maps CPSC records into a UI-safe `SiteRecall` shape
- limits generated detail slugs while preserving uniqueness with the CPSC id
- builds brand groups from `brandNames`
- classifies records lightly into baby/kids, battery/electronics, food/allergy, household/appliance, or general consumer product
- falls back to mock records only when no processed records are available

## Search Helper

`src/lib/recall-search.ts` exports:

- `searchRecalls`
- `getRecallMatch`
- `MATCH_LABELS`
- `NO_MATCH_DISCLAIMER`

Match types are `exact`, `possible`, `related`, and `none`.

## Guardrails

Keep this repo local-only. Do not add remotes, secrets, deployments, databases, or external API calls except the local public CPSC recall fetch allowed for phase 2.
