# EU Safety Gate Source Spike

Phase 9 adds a bounded European Union Safety Gate source spike.

## Official Source Verification

Official pages checked:

- Safety Gate alert report app: `https://ec.europa.eu/safety-gate-alerts/screen/webReport`
- Safety Gate homepage: `https://ec.europa.eu/safety-gate-alerts/`

The implementation uses official endpoints exposed by the Safety Gate web app:

- Recent notifications: `https://ec.europa.eu/safety-gate-alerts/public/api/notification/mostRecent/?`
- Notification detail: `https://ec.europa.eu/safety-gate-alerts/public/api/notification/{id}?language=en`
- Official image URL shape: `https://ec.europa.eu/safety-gate-alerts/public/api/notification/image/{photoId}`
- Official detail page shape: `https://ec.europa.eu/safety-gate-alerts/screen/webReport/alertDetail/{id}`

No third-party mirror and no HTML scraping are used.

## Current Scope

- Source id: `EU_SAFETY_GATE`
- Display label: `European Union · Safety Gate`
- Default limit: `EU_SAFETY_GATE_LIMIT=100`
- Current EU records: 100
- Current canonical total: 701
- Static/local-first only: the built site reads `data/processed/recalls.json`
- No runtime API calls from the browser
- No backend, database, account system, email, product registration, alert backend, LLM feature, or affiliate behavior

Safety Gate covers dangerous non-food consumer products. Do not treat it as food recall coverage.

## Commands

Fetch the bounded EU spike from the official Safety Gate API:

```powershell
npm run fetch:eu-safety-gate
```

Rebuild EU processed data from the committed raw file without a network call:

```powershell
npm run normalize:eu-safety-gate
```

Audit the local EU processed data:

```powershell
npm run audit:eu-safety-gate
```

Run the explicit EU refresh workflow:

```powershell
npm run update:eu-safety-gate
```

`update:eu-safety-gate` performs a network fetch and then runs the EU audit. It is not part of `npm run check` or `npm run build`.

## Files

- Fetch script: `scripts/fetch-eu-safety-gate.ts`
- Normalizer: `scripts/normalize-eu-safety-gate.ts`
- Audit: `scripts/audit-eu-safety-gate.ts`
- Raw EU file: `data/raw/eu-safety-gate-recalls.json`
- Processed EU file: `data/processed/eu-safety-gate-recalls.json`
- Canonical merged file: `data/processed/recalls.json`

## Normalized Mapping

EU records are mapped into `NormalizedRecall`:

- `id`: `eu-safety-gate-{notificationId}`
- `source`: `EU_SAFETY_GATE`
- `sourceUrl`: official Safety Gate alert detail route
- `title`: product-first Safety Gate alert title
- `brandNames`: official brand list when available
- `productNames`: product name, specific name, barcode, model, and batch identifiers when available
- `category`: Safety Gate product category
- `hazard` / `reason`: Safety Gate risk description
- `remedy`: Safety Gate measure summary
- `recallDate`: publication date
- `classification`: notification type code/name
- `recallNumber`: Safety Gate reference, such as `SR/01950/26`
- `distributionPattern`: reporting country and country of origin when available
- `images`: official Safety Gate image endpoint URLs
- `raw`: original Safety Gate detail payload

## Audit Expectations

Current expected counts:

- CPSC: 301
- FDA/openFDA: 100
- France RappelConso: 100
- Canada Recalls and Safety Alerts: 100
- EU Safety Gate: 100
- Total: 701

Current EU audit checks:

- EU record count
- Canonical source counts
- source filter values
- duplicate ids
- slug collisions
- missing required fields
- official detail URL shape
- official image URL availability
- barcode-like identifier coverage
- model/batch-like identifier coverage
- raw category distribution

## Known Limits

- This is a bounded 100-record spike, not a full EU backfill.
- Some Safety Gate alerts mark brand as unknown; brand pages are generated only when a brand/company is present.
- EU Safety Gate categories are mapped conservatively into existing site buckets. Vehicle, cosmetics, protective equipment, and other non-food categories remain general unless a current site category clearly fits.
- Source text can include product names or descriptions in non-English source language when that is what the official alert exposes.
