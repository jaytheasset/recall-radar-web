# Recall Radar

Recall Radar is a static Astro product recall search site. It helps consumers search indexed official recall notices across markets by product, brand, model, UPC/barcode, lot code, ingredient, or keyword.

## Current Scope

- 801 indexed recall notices.
- 6 official source feeds.
- Active sources: CPSC, FDA/openFDA, France RappelConso, Canada Recalls and Safety Alerts, EU Safety Gate, and UK FSA Food Alerts.
- Static build output with no backend, database, account system, email service, runtime API, or live alerting.
- Browser-only watchlist UI using `localStorage`.
- Data source at build time: `data/processed/recalls.json`.

Search results are possible matches, not safety confirmations. Always verify affected models, lots, dates, distribution, and remedies with the official notice.

## Setup

Run all commands from:

```powershell
cd C:\Users\pc\codex-projects\recall-radar-web
npm install
```

## Development

```powershell
npm run dev
```

The local dev server is configured for `127.0.0.1:5179`.

## Validation

```powershell
npm run validate:launch
```

Equivalent explicit sequence:

```powershell
npm run audit:sources
npm run audit:uk-fsa
npm run audit:eu-safety-gate
npm run audit:canada
npm run audit:rappelconso
npm run check
npm run build
```

## Preview

```powershell
npm run preview
```

Preview also uses `127.0.0.1:5179`.

## Deployment Build

The production build command is `npm run build`. It creates the static site in `dist`.

See `docs/DEPLOYMENT.md` for Cloudflare Pages setup and post-deploy checks.

## Data Refresh Guardrail

Normal validation and build commands do not fetch fresh source data. Network fetch/update scripts should be run only during an intentional data-refresh phase.

See `docs/LAUNCH_CHECKLIST.md`, `docs/DEV_HANDOFF.md`, and `scripts/README.md` before changing source data.
