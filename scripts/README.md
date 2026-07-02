# Scripts

This folder contains local-only data preparation scripts.

Current rules:

- The public CPSC recall API is allowed only when a task asks for CPSC refreshes.
- The public openFDA food enforcement API is allowed only when a task asks for FDA/openFDA food recall refreshes.
- The public RappelConso open data endpoint is allowed only when a task asks for France RappelConso refreshes.
- The public Canada Recalls and Safety Alerts open-data feed is allowed only when a task asks for Canada recall refreshes.
- The official EU Safety Gate public API endpoints are allowed only when a task asks for EU Safety Gate refreshes.
- The official UK FSA Food Alerts API endpoints are allowed only when a task asks for UK FSA refreshes.
- UI-only phases should use the existing local `data/processed/recalls.json` file and should not fetch unless a later task explicitly asks for fresh data.
- Do not connect databases.
- Do not write secrets.
- Keep generated data inside `data/processed`.
- Keep raw local files inside `data/raw`.

## CPSC Recall Fetch

```powershell
npm run fetch:cpsc
```

This calls:

`https://www.saferproducts.gov/RestWebServices/Recall`

Default behavior:

- Requests JSON records for the current calendar year.
- Saves the raw response wrapper to `data/raw/cpsc-recalls.json`.
- Saves normalized CPSC-only records to `data/processed/cpsc-recalls.json`.
- Rebuilds the merged canonical file at `data/processed/recalls.json`.
- Adds `fetchedAt` to the raw output.
- Refuses to overwrite output files when the API request fails or returns zero records.

Optional date range:

```powershell
npm run fetch:cpsc -- --start=2026-01-01 --end=2026-12-31
```

To rebuild processed data from the saved raw file:

```powershell
npm run normalize:cpsc
```

## FDA/openFDA Food Recall Fetch

```powershell
npm run fetch:fda-food
```

This calls:

`https://api.fda.gov/food/enforcement.json`

Default behavior:

- Requests up to 100 recent food enforcement records sorted by report date.
- Saves the raw response wrapper to `data/raw/fda-food-recalls.json`.
- Saves normalized FDA-only records to `data/processed/fda-recalls.json`.
- Rebuilds the merged canonical file at `data/processed/recalls.json`.
- Adds `fetchedAt` to the raw output.
- Refuses to overwrite processed output when the API request fails or returns zero records.

Optional limit:

```powershell
npm run fetch:fda-food -- --limit=50
```

To rebuild FDA processed data from the saved raw file:

```powershell
npm run normalize:fda-food
```

## France RappelConso Fetch

```powershell
npm run fetch:rappelconso
```

This calls the RappelConso V2 GTIN-spaced data.economie.gouv.fr records endpoint:

`https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/rappelconso-v2-gtin-espaces/records`

Default behavior:

- Requests the 100 most recent RappelConso records ordered by `date_publication desc`.
- Saves a bounded raw response wrapper to `data/raw/rappelconso-recalls.json`.
- Saves normalized France RappelConso records to `data/processed/rappelconso-recalls.json`.
- Rebuilds the merged canonical file at `data/processed/recalls.json`.
- Adds `fetchedAt` to the raw output.
- Refuses to overwrite processed output when the endpoint returns zero records.

Optional limit:

```powershell
npm run fetch:rappelconso -- --limit=50
```

The default RappelConso limit is 100. It can also be set with an environment variable:

```powershell
$env:RAPPELCONSO_LIMIT = "100"
npm run fetch:rappelconso
Remove-Item Env:RAPPELCONSO_LIMIT
```

To rebuild RappelConso processed data from the saved raw file:

```powershell
npm run normalize:rappelconso
```

To audit the current local RappelConso processed data without making network calls:

```powershell
npm run audit:rappelconso
```

To run the explicit RappelConso refresh workflow, including network fetch and local audit:

```powershell
npm run update:rappelconso
```

For local-only validation from the existing raw file:

```powershell
npm run data:rappelconso:normalize
npm run data:merge
npm run audit:rappelconso
```

The canonical `data/processed/recalls.json` file is the local site source and can contain CPSC, FDA/openFDA, France RappelConso, Canada, EU Safety Gate, and UK FSA records.

## Canada Recalls and Safety Alerts Fetch

```powershell
npm run fetch:canada
```

This calls the official Canada Recalls and Safety Alerts open-data JSON feed:

`https://recalls-rappels.canada.ca/sites/default/files/opendata-donneesouvertes/HCRSAMOpenData.json`

Default behavior:

- Downloads the official open-data JSON feed.
- Sorts records by `Last updated` newest first.
- Saves only the bounded 100-record spike to `data/raw/canada-recalls.json`.
- Saves normalized Canada records to `data/processed/canada-recalls.json`.
- Rebuilds the merged canonical file at `data/processed/recalls.json`.
- Adds `fetchedAt` to the raw output.
- Refuses to overwrite processed output when the feed returns zero records.

Optional limit:

```powershell
npm run fetch:canada -- --limit=50
```

The default Canada limit is 100. It can also be set with an environment variable:

```powershell
$env:CANADA_RECALLS_LIMIT = "100"
npm run fetch:canada
Remove-Item Env:CANADA_RECALLS_LIMIT
```

To rebuild Canada processed data from the saved raw file:

```powershell
npm run normalize:canada
```

To audit the current local Canada processed data without making network calls:

```powershell
npm run audit:canada
```

The Canada audit reports source counts, duplicate ids, slug collisions, missing required fields, category distribution, official URL shape, image availability, UPC/barcode-like text, model/item-number-like text, lot/batch/code/date-like text, distribution detail availability, and suspicious category mappings.

To run the explicit Canada refresh workflow, including network fetch and local audit:

```powershell
npm run update:canada
```

`update:canada` is the intended maintenance command for the current 100-record Canada spike. It runs `data:canada:fetch`, and the fetch script saves raw data, normalizes Canada records, rebuilds the canonical merged file, and then `update:canada` runs `audit:canada`.

For local-only validation from the existing raw file:

```powershell
npm run data:canada:normalize
npm run data:merge
npm run audit:canada
```

Use the local-only sequence for validation phases that should not call the Canada endpoint. Do not wire Canada fetches into `npm run check`, `npm run build`, or UI tests.

## EU Safety Gate Fetch

```powershell
npm run fetch:eu-safety-gate
```

This calls official EU Safety Gate endpoints exposed by the Safety Gate web app:

`https://ec.europa.eu/safety-gate-alerts/public/api/notification/mostRecent/?`

and detail records at:

`https://ec.europa.eu/safety-gate-alerts/public/api/notification/{id}?language=en`

Default behavior:

- Requests the 100 most recent EU Safety Gate notifications.
- Fetches official structured detail JSON for each bounded notification.
- Saves the bounded raw response wrapper to `data/raw/eu-safety-gate-recalls.json`.
- Saves normalized EU Safety Gate records to `data/processed/eu-safety-gate-recalls.json`.
- Rebuilds the merged canonical file at `data/processed/recalls.json`.
- Adds `fetchedAt` to the raw output.
- Refuses to overwrite processed output when the API returns zero records.
- Uses official Safety Gate image URLs when official photo ids are present.

Optional limit:

```powershell
npm run fetch:eu-safety-gate -- --limit=50
```

The default EU Safety Gate limit is 100. It can also be set with an environment variable:

```powershell
$env:EU_SAFETY_GATE_LIMIT = "100"
npm run fetch:eu-safety-gate
Remove-Item Env:EU_SAFETY_GATE_LIMIT
```

To rebuild EU Safety Gate processed data from the saved raw file:

```powershell
npm run normalize:eu-safety-gate
```

To audit the current local EU Safety Gate processed data without making network calls:

```powershell
npm run audit:eu-safety-gate
```

The EU audit reports source counts, duplicate ids, slug collisions, missing required fields, raw and site category distribution, official URL shape, image availability, barcode-like text, model/type text, batch/serial text, risk type coverage, notifying country, country of origin, countries concerned or market details, and suspicious category mappings.

To run the explicit EU Safety Gate refresh workflow, including network fetch and local audit:

```powershell
npm run update:eu-safety-gate
```

`update:eu-safety-gate` runs `data:eu-safety-gate:fetch` and then `audit:eu-safety-gate`. The fetch script saves the bounded raw response, normalizes EU records, rebuilds `data/processed/recalls.json`, and refuses to overwrite data when the endpoint returns zero records.

For local-only validation from the existing raw file:

```powershell
npm run data:eu-safety-gate:normalize
npm run data:merge
npm run audit:eu-safety-gate
```

Do not wire EU Safety Gate fetches into `npm run check`, `npm run build`, or UI tests.

For the current 100-record EU spike, commit the raw EU file, processed EU file, and merged canonical processed file together only after the EU audit passes. For larger future EU pulls, reconsider the raw commit strategy because Safety Gate detail payloads are verbose.

## UK FSA Food Alerts Fetch

```powershell
npm run fetch:uk-fsa
```

This calls the official UK FSA Food Alerts linked-data API:

`https://data.food.gov.uk/food-alerts/id.json?_limit=100&_sort=-created`

and detail records at:

`https://data.food.gov.uk/food-alerts/id/{notation}.json`

Default behavior:

- Requests the 100 most recent UK FSA Food Alerts records.
- Fetches official structured detail JSON for each bounded alert.
- Saves the bounded raw response wrapper to `data/raw/uk-fsa-alerts.json`.
- Saves normalized UK FSA records to `data/processed/uk-fsa-alerts.json`.
- Rebuilds the merged canonical file at `data/processed/recalls.json`.
- Adds `fetchedAt` to the raw output.
- Refuses to overwrite processed output when the API returns zero records.

Optional limit:

```powershell
npm run fetch:uk-fsa -- --limit=50
```

The default UK FSA limit is 100. It can also be set with an environment variable:

```powershell
$env:UK_FSA_LIMIT = "100"
npm run fetch:uk-fsa
Remove-Item Env:UK_FSA_LIMIT
```

To rebuild UK FSA processed data from the saved raw file:

```powershell
npm run normalize:uk-fsa
```

To audit the current local UK FSA processed data without making network calls:

```powershell
npm run audit:uk-fsa
```

The UK FSA audit reports source counts, duplicate ids, slug collisions, missing required fields, alert type distribution, official URL shape, batch/date detail coverage, pack size coverage, allergen or risk label coverage, retailer/distribution-like detail coverage, image and related-media availability, source filter values, suspicious category mappings, and food/allergy category mapping.

To run the explicit UK FSA refresh workflow, including network fetch and local audit:

```powershell
npm run update:uk-fsa
```

`update:uk-fsa` runs `data:uk-fsa:fetch`, `data:uk-fsa:normalize`, `data:merge`, and `audit:uk-fsa` in that order. The fetch step already writes raw, processed, and canonical files; the explicit normalize and merge steps make the final files reproducible from the saved raw payload before audit.

For local-only validation from the existing raw file:

```powershell
npm run data:uk-fsa:normalize
npm run data:merge
npm run audit:uk-fsa
```

Do not wire UK FSA fetches into `npm run check`, `npm run build`, or UI tests.

For the current 100-record UK FSA spike, commit the raw UK FSA file, processed UK FSA file, and merged canonical processed file together only after the UK FSA audit passes. UK FSA detail payloads can be verbose, so any future full backfill should reconsider whether to commit full raw detail payloads, a smaller fixture, or only normalized processed records.

The canonical `data/processed/recalls.json` file is the local site source and can contain CPSC, FDA/openFDA, France RappelConso, Canada Recalls and Safety Alerts, EU Safety Gate, and UK FSA Food Alerts records.

## Integrated Source Audit

```powershell
npm run audit:sources
```

This is a local-only launch-readiness audit for the canonical merged file. It reads `data/processed/recalls.json`, checks the six active source ids and expected counts, verifies the active source registry matches the canonical data, reports duplicate ids, reports sparse fields by source, and summarizes category distribution by source.

Expected current counts:

- CPSC: 301
- FDA/openFDA: 100
- France RappelConso: 100
- Canada Recalls and Safety Alerts: 100
- EU Safety Gate: 100
- UK FSA Food Alerts: 100
- Total: 801
