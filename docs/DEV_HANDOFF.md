# Development Handoff

## Local Setup

```powershell
cd C:\Users\pc\codex-projects\recall-radar-web
npm install
npm run dev
```

Use port `5179` only.

## Data Model

Mock recall records live in `src/data/mock-recalls.ts`.

Each recall includes:

- slug
- title
- brand
- category
- product name
- notice date
- mock agency
- recall number
- summary
- hazard
- remedy
- model numbers
- UPCs
- lot codes
- keywords

## Local CPSC Pipeline

Phase 2 adds a local-only CPSC recall data pipeline. It does not replace the website mock data yet.

Commands:

- `npm run fetch:cpsc` fetches current-year public CPSC recall JSON and writes local files.
- `npm run normalize:cpsc` rebuilds processed recall data from `data/raw/cpsc-recalls.json`.
- `npm run build:data` currently runs the CPSC fetch pipeline.

Local output files:

- `data/raw/cpsc-recalls.json`
- `data/processed/recalls.json`

The fetch script calls `https://www.saferproducts.gov/RestWebServices/Recall` without an API key. It writes only after the API returns non-empty records, and each raw file includes a `fetchedAt` timestamp.

Normalized records use `src/data/recall-types.ts` and include `id`, `source`, `sourceUrl`, `title`, `brandNames`, `productNames`, `category`, `hazard`, `remedy`, `recallDate`, `affectedUnits`, `description`, `slug`, and `raw`.

## Search Helper

`src/lib/recall-search.ts` exports:

- `searchRecalls`
- `getRecallMatch`
- `MATCH_LABELS`
- `NO_MATCH_DISCLAIMER`

Match types are `exact`, `possible`, `related`, and `none`.

## Guardrails

Keep this repo local-only. Do not add remotes, secrets, deployments, databases, or external API calls except the local public CPSC recall fetch allowed for phase 2.
