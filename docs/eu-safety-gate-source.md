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
- `distributionPattern`: notifying country, country of origin, and countries concerned when available
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
- model/type identifier coverage
- batch/serial identifier coverage
- risk type coverage
- notifying country coverage
- country of origin coverage
- countries concerned or market detail coverage
- raw category distribution
- conservative site category distribution
- suspicious category mappings

## Phase 9.1 QA Notes

Phase 9.1 did not fetch Safety Gate again. The QA pass regenerated normalized EU data from the committed raw file, then audited the committed processed files.

Audit method:

- Read `data/processed/eu-safety-gate-recalls.json`.
- Read canonical `data/processed/recalls.json`.
- Check the source id `EU_SAFETY_GATE` and the unchanged source filter values: `all`, `CPSC`, `FDA`, `FR_RAPPELCONSO`, `CA_RECALLS`, `EU_SAFETY_GATE`.
- Check duplicate ids, slug collisions, required fields, official URL shape, image availability, identifier coverage, country coverage, and suspicious category mappings.

Current audited counts:

- EU Safety Gate records: 100
- Total canonical records: 701
- Source counts: CPSC 301, FDA/openFDA 100, France RappelConso 100, Canada Recalls and Safety Alerts 100, EU Safety Gate 100

Current EU source characteristics from the 100-record spike:

- Official product images: present on all 100 records
- Official alert URL shape: present on all 100 records
- Brand/company present: 69 records
- Barcode-like values: 64 records
- Model/type values: 78 records
- Batch/serial values: 37 records
- Risk type values: 100 records
- Notifying country values: 100 records
- Country of origin values: 100 records
- Countries concerned values: 23 records
- Countries concerned or market details: 100 records

Phase 9.1 fixes:

- Added labeled barcode, model/type, and batch/serial summaries to normalized EU descriptions so search can match important identifiers more reliably.
- Added risk type, notifying country, country of origin, and countries concerned text to normalized EU records where present.
- Kept EU Safety Gate mapped as dangerous non-food product coverage; no EU records should map to food/allergy.
- Made EU category mapping conservative: toys and childcare map to baby/kids; clear electrical appliances and electronics map to batteries/electronics; furniture and lighting chains map to household/appliance; vehicles, machinery, cosmetics, chemicals, jewelry, protective equipment, hobby/sports equipment, laser pointers, lighters, clothing, and construction products remain general consumer product.
- Added detail-page structured fields for Safety Gate risk type, notifying country, country of origin, countries concerned, and identifiers.
- Aligned the Safety Gate placeholder label to `Safety Gate notice`.

Raw/processed size note:

Safety Gate detail payloads are verbose because they include nested product versions, risk versions, traceability, measures, country objects, and photo metadata. The 100-record spike intentionally creates larger raw and processed diffs than CPSC/FDA-only work. A full EU backfill should be a separate phase and should reconsider whether to commit full raw payloads, keep a smaller raw fixture, or commit normalized records only.

Deferred:

- No full EU backfill.
- No higher record limit.
- No new countries.
- No backend, database, registration, email, alert backend, LLM feature, or affiliate behavior.
- No broad UI redesign.

## Known Limits

- This is a bounded 100-record spike, not a full EU backfill.
- Some Safety Gate alerts mark brand as unknown; brand pages are generated only when a brand/company is present.
- EU Safety Gate categories are mapped conservatively into existing site buckets. Vehicle, cosmetics, protective equipment, and other non-food categories remain general unless a current site category clearly fits.
- Source text can include product names or descriptions in non-English source language when that is what the official alert exposes.
