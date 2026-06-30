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

## Search Helper

`src/lib/recall-search.ts` exports:

- `searchRecalls`
- `getRecallMatch`
- `MATCH_LABELS`
- `NO_MATCH_DISCLAIMER`

Match types are `exact`, `possible`, `related`, and `none`.

## Guardrails

Keep this repo local-only. Do not add remotes, secrets, deployments, databases, or external API calls until a future step explicitly changes the scope.
