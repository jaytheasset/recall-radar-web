# Scripts

This folder contains local-only data preparation scripts.

Current rules:

- The public CPSC recall API is allowed only when a task asks for CPSC refreshes.
- The public openFDA food enforcement API is allowed only when a task asks for FDA/openFDA food recall refreshes.
- The public RappelConso open data endpoint is allowed only when a task asks for France RappelConso refreshes.
- The public Canada Recalls and Safety Alerts open-data feed is allowed only when a task asks for Canada recall refreshes.
- The official EU Safety Gate public API endpoints are allowed only when a task asks for EU Safety Gate refreshes.
- The official UK FSA Food Alerts API endpoints are allowed only when a task asks for UK FSA refreshes.
- The official Product Safety Australia recalls page is allowed only when a task asks for Australia Product Safety refreshes.
- The official Product Safety New Zealand recalls page is allowed only when a task asks for New Zealand Product Safety refreshes.
- The official Hong Kong Centre for Food Safety food alerts XML/archive/detail pages are allowed only when a task asks for Hong Kong CFS refreshes.
- The official FSANZ food recall listing, RSS, and detail pages are allowed only when a task asks for FSANZ food recall refreshes.
- The official Korea SafetyKorea/data.go.kr endpoints are currently diagnostic-only through `npm run debug:korea-safetykorea-access`; do not add Korea records until official recall-record access is confirmed.
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

The canonical `data/processed/recalls.json` file is the local site source and can contain CPSC, FDA/openFDA, France RappelConso, Canada Recalls and Safety Alerts, EU Safety Gate, UK FSA Food Alerts, Australia Product Safety, New Zealand Product Safety, Hong Kong CFS, and FSANZ Food Recalls records.

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

## Australia Product Safety Fetch

```powershell
npm run fetch:australia-product-safety
```

This uses the official Product Safety Australia recalls page:

`https://www.productsafety.gov.au/recalls`

The page's RSS link currently redirects to itself, so the fetch script reads the official Drupal AJAX view settings and requests the official `/views/ajax` listing pages. It then fetches official detail pages for the bounded records.

Default behavior:

- Requests the 100 most recent Product Safety Australia recall notices.
- Fetches official detail HTML for each bounded record.
- Saves the bounded raw response wrapper to `data/raw/australia-product-safety-recalls.json`.
- Saves normalized Australia records to `data/processed/australia-product-safety-recalls.json`.
- Rebuilds the merged canonical file at `data/processed/recalls.json`.
- Adds `fetchedAt` to the raw output.
- Refuses to overwrite processed output when the official listing returns zero records.
- Uses official Product Safety Australia image URLs when official detail images are available.

Optional limit:

```powershell
npm run fetch:australia-product-safety -- --limit=50
```

The default Australia limit is 100. It can also be set with an environment variable:

```powershell
$env:AU_PRODUCT_SAFETY_LIMIT = "100"
npm run fetch:australia-product-safety
Remove-Item Env:AU_PRODUCT_SAFETY_LIMIT
```

To rebuild Australia processed data from the saved raw file:

```powershell
npm run normalize:australia-product-safety
```

To audit the current local Australia processed data without making network calls:

```powershell
npm run audit:australia-product-safety
```

The Australia audit checks the 100-record source count, canonical total, source filter values, wrong source ids, duplicate ids/slugs/source URLs, official notice URL shape, invalid dates, official image URL hosts, suspicious image candidates, required field coverage, category distribution, identifier-like text coverage, and raw HTML leakage in visible normalized fields.

To run the explicit Australia refresh workflow, including network fetch and local audit:

```powershell
npm run update:australia-product-safety
```

`update:australia-product-safety` runs `data:australia-product-safety:fetch`, `data:australia-product-safety:normalize`, `data:merge`, and `audit:australia-product-safety` in that order. The fetch step already writes raw, processed, and canonical files; the explicit normalize and merge steps make the final files reproducible from the saved raw payload before audit.

For local-only validation from the existing raw file:

```powershell
npm run data:australia-product-safety:normalize
npm run data:merge
npm run audit:australia-product-safety
```

Do not wire Australia fetches into `npm run check`, `npm run build`, or UI tests.

For the current 100-record Australia spike, commit the raw Australia file, processed Australia file, and merged canonical processed file together only after the Australia audit passes. Any future full Australia backfill should use ignored chunks and source-specific audit before canonical expansion.

Do not increase `AU_PRODUCT_SAFETY_LIMIT` above the current bounded 100-record spike without a separate source expansion or backfill phase. Keep vehicle recalls separate from `AU_PRODUCT_SAFETY`; FSANZ food recalls are handled by the separate `FSANZ_FOOD_RECALLS` source.

The canonical `data/processed/recalls.json` file is the local site source and can contain CPSC, FDA/openFDA, France RappelConso, Canada Recalls and Safety Alerts, EU Safety Gate, UK FSA Food Alerts, Australia Product Safety, New Zealand Product Safety, Hong Kong CFS, and FSANZ Food Recalls records.

## New Zealand Product Safety Fetch

```powershell
npm run fetch:new-zealand-product-safety
```

This uses the official Product Safety New Zealand recalls page:

`https://www.productsafety.govt.nz/recalls`

The JSON and RSS candidates checked during Phase 37 did not expose a usable feed. The fetch script reads official HTML listing pages with `start` pagination and then fetches official detail pages for the bounded records.

Default behavior:

- Requests the 100 most recent Product Safety New Zealand recall notices.
- Fetches official detail HTML for each bounded record.
- Saves the bounded raw response wrapper to `data/raw/new-zealand-product-safety-recalls.json`.
- Saves normalized New Zealand records to `data/processed/new-zealand-product-safety-recalls.json`.
- Rebuilds the merged canonical file at `data/processed/recalls.json`.
- Adds `fetchedAt` to the raw output.
- Refuses to overwrite processed output when the official listing returns zero records.
- Uses official Product Safety New Zealand image URLs when official detail images are available.

Optional limit:

```powershell
npm run fetch:new-zealand-product-safety -- --limit=50
```

The default New Zealand limit is 100. It can also be set with an environment variable:

```powershell
$env:NZ_PRODUCT_SAFETY_LIMIT = "100"
npm run fetch:new-zealand-product-safety
Remove-Item Env:NZ_PRODUCT_SAFETY_LIMIT
```

To rebuild New Zealand processed data from the saved raw file:

```powershell
npm run normalize:new-zealand-product-safety
```

To audit the current local New Zealand processed data without making network calls:

```powershell
npm run audit:new-zealand-product-safety
```

The New Zealand audit checks the 100-record source count, canonical total, source filter values, wrong source ids, duplicate ids/slugs/source URLs, official notice URL shape, invalid dates, official image URL hosts, specialist-source exclusions, required field coverage, category distribution, identifier-like text coverage, and raw HTML leakage in visible normalized fields.

To run the explicit New Zealand Product Safety refresh workflow, including network fetch and local audit:

```powershell
npm run update:new-zealand-product-safety
```

`update:new-zealand-product-safety` runs `data:new-zealand-product-safety:fetch`, `data:new-zealand-product-safety:normalize`, `data:merge`, and `audit:new-zealand-product-safety` in that order. The fetch step already writes raw, processed, and canonical files; the explicit normalize and merge steps make the final files reproducible from the saved raw payload before audit.

For local-only validation from the existing raw file:

```powershell
npm run data:new-zealand-product-safety:normalize
npm run data:merge
npm run audit:new-zealand-product-safety
```

Do not wire New Zealand fetches into `npm run check`, `npm run build`, or UI tests.

For the current 100-record New Zealand spike, commit the raw New Zealand file, processed New Zealand file, and merged canonical processed file together only after the New Zealand audit passes. Any future full New Zealand backfill should use ignored chunks and source-specific audit before canonical expansion.

Do not increase `NZ_PRODUCT_SAFETY_LIMIT` above the current bounded 100-record spike without a separate source expansion or backfill phase. Keep New Zealand MPI food recalls and NZTA vehicle recalls as separate future source candidates instead of mixing them into `NZ_PRODUCT_SAFETY`.

The canonical `data/processed/recalls.json` file is the local site source and can contain CPSC, FDA/openFDA, France RappelConso, Canada Recalls and Safety Alerts, EU Safety Gate, UK FSA Food Alerts, Australia Product Safety, New Zealand Product Safety, and Hong Kong CFS records.

## Hong Kong CFS Food Alerts Fetch

```powershell
npm run fetch:hong-kong-cfs
```

This uses the official Hong Kong Centre for Food Safety food alerts sources:

`https://www.cfs.gov.hk/filemanager/foodalert/english/foodalert_datagovhk.xml`

and official archive/detail pages under:

`https://www.cfs.gov.hk/english/whatsnew/whatsnew_fa/`

Default behavior:

- Checks the official XML feed and archive/detail pages.
- Requests the bounded 100 most recent Hong Kong CFS food and allergy alerts.
- Saves the bounded raw response wrapper to `data/raw/hong-kong-cfs-food-alerts.json`.
- Saves normalized Hong Kong CFS records to `data/processed/hong-kong-cfs-food-alerts.json`.
- Rebuilds the merged canonical file at `data/processed/recalls.json`.
- Adds `fetchedAt` to the raw output.
- Refuses to overwrite processed output when the official source returns zero records.
- Uses official CFS image URLs when official detail images are available.

Optional limit:

```powershell
npm run fetch:hong-kong-cfs -- --limit=50
```

The default Hong Kong CFS limit is 100. It can also be set with an environment variable:

```powershell
$env:HK_CFS_LIMIT = "100"
npm run fetch:hong-kong-cfs
Remove-Item Env:HK_CFS_LIMIT
```

To rebuild Hong Kong CFS processed data from the saved raw file:

```powershell
npm run normalize:hong-kong-cfs
```

To audit the current local Hong Kong CFS processed data without making network calls:

```powershell
npm run audit:hong-kong-cfs
```

The Hong Kong CFS audit checks the 100-record source count, canonical total, source filter values, wrong source ids, duplicate ids/slugs/source URLs, official notice URL shape, invalid dates, official image URL hosts, suspicious image candidates, required field coverage, food/allergy category mapping, identifier-like text coverage, and raw HTML leakage in visible normalized fields.

To run the explicit Hong Kong CFS refresh workflow, including network fetch and local audit:

```powershell
npm run update:hong-kong-cfs
```

`update:hong-kong-cfs` runs `data:hong-kong-cfs:fetch`, `data:hong-kong-cfs:normalize`, `data:merge`, and `audit:hong-kong-cfs` in that order. The fetch step already writes raw, processed, and canonical files; the explicit normalize and merge steps make the final files reproducible from the saved raw payload before audit.

For local-only validation from the existing raw file:

```powershell
npm run data:hong-kong-cfs:normalize
npm run data:merge
npm run audit:hong-kong-cfs
```

Do not wire Hong Kong CFS fetches into `npm run check`, `npm run build`, or UI tests.

For the current 100-record Hong Kong CFS spike, commit the raw Hong Kong CFS file, processed Hong Kong CFS file, and merged canonical processed file together only after the Hong Kong CFS audit passes. Any future full Hong Kong CFS backfill should use ignored chunks and source-specific audit before canonical expansion.

Do not increase `HK_CFS_LIMIT` above the current bounded 100-record spike without a separate source expansion or backfill phase. Keep Hong Kong EMSD electrical recalls separate from `HK_CFS`.

## Australia/New Zealand FSANZ Food Recalls Fetch

```powershell
npm run fetch:fsanz-food-recalls
```

This uses official Food Standards Australia New Zealand sources:

`https://www.foodstandards.gov.au/food-recalls/recall-alert`

`https://www.foodstandards.gov.au/food-recalls-rss.xml`

and official recall detail pages under:

`https://www.foodstandards.gov.au/food-recalls/recall-alert/`

Default behavior:

- Checks the official listing pagination, RSS feed, and detail pages.
- Requests the bounded 100 most recent FSANZ food recall notices.
- Saves the bounded raw response wrapper to `data/raw/fsanz-food-recalls.json`.
- Saves normalized FSANZ records to `data/processed/fsanz-food-recalls.json`.
- Rebuilds the merged canonical file at `data/processed/recalls.json`.
- Adds `fetchedAt` to the raw output.
- Refuses to overwrite processed output when the official source returns zero records.
- Uses official FSANZ image URLs when official detail images are available.

Optional limit:

```powershell
npm run fetch:fsanz-food-recalls -- --limit=50
```

The default FSANZ limit is 100. It can also be set with an environment variable:

```powershell
$env:FSANZ_FOOD_RECALLS_LIMIT = "100"
npm run fetch:fsanz-food-recalls
Remove-Item Env:FSANZ_FOOD_RECALLS_LIMIT
```

To rebuild FSANZ processed data from the saved raw file:

```powershell
npm run normalize:fsanz-food-recalls
```

To audit the current local FSANZ processed data without making network calls:

```powershell
npm run audit:fsanz-food-recalls
```

The FSANZ audit checks the 100-record source count, canonical total, source filter values, wrong source ids, duplicate ids/slugs/source URLs, official notice URL shape, invalid dates, official image URL hosts, suspicious image candidates, required field coverage, food category mapping, identifier-like text coverage, and raw HTML leakage in visible normalized fields.

To run the explicit FSANZ refresh workflow, including network fetch and local audit:

```powershell
npm run update:fsanz-food-recalls
```

For local-only validation from the existing raw file:

```powershell
npm run data:fsanz-food-recalls:normalize
npm run data:merge
npm run audit:fsanz-food-recalls
```

Do not wire FSANZ fetches into `npm run check`, `npm run build`, or UI tests.

For the current 100-record FSANZ spike, commit the raw FSANZ file, processed FSANZ file, and merged canonical processed file together only after the FSANZ audit passes. Any future full FSANZ backfill should use ignored chunks and source-specific audit before canonical expansion.

Do not increase `FSANZ_FOOD_RECALLS_LIMIT` above the current bounded 100-record spike without a separate source expansion or backfill phase.

## Korea SafetyKorea Access Diagnostic

```powershell
npm run debug:korea-safetykorea-access
```

This command is non-mutating. It checks the prepared SafetyKorea contract and fixture mapping. If `SAFETYKOREA_API_KEY` is missing, it exits successfully in missing-auth mode and does not send a live SafetyKorea request. If the key is present, it sends one bounded domestic recall list probe using the official `AuthKey` header.

Phase 35 did not add `KR_SAFETYKOREA` as a live source. The official data.go.kr SafetyKorea metadata is reachable, but it indicates an application/login/service-key flow and the reachable structured metadata is not a recall-record payload endpoint. SafetyKorea page access was not stable enough in this environment to justify an official HTML scraper.

Phase 36 prepared the official domestic recall API contract after the SafetyKorea interface document review:

- Auth header name: `AuthKey`
- env var: `SAFETYKOREA_API_KEY`
- list endpoint: `http://www.safetykorea.kr/openapi/api/recall/recallList.json`
- detail endpoint: `http://www.safetykorea.kr/openapi/api/recall/recallDetail.json`
- helper: `scripts/korea-safetykorea-api-contract.ts`
- fixture: `data/samples/korea-safetykorea-domestic-recall-samples.json`

Run the non-network contract audit:

```powershell
npm run audit:korea-safetykorea-contract
```

Do not add Korea fetch, normalize, live audit, merge, landing-page, or source-filter code until a future phase confirms a working SafetyKorea AuthKey/service ID. If credentials are later required, use `SAFETYKOREA_API_KEY` as an environment variable and never commit secrets.

## Integrated Source Audit

```powershell
npm run audit:sources
```

This is a local-only launch-readiness audit for the canonical merged file. It reads `data/processed/recalls.json`, checks the ten active source ids and expected counts, verifies the active source registry matches the canonical data, reports duplicate ids, reports sparse fields by source, and summarizes category distribution by source.

Expected current counts:

- CPSC: 301
- FDA/openFDA: 100
- France RappelConso: 100
- Canada Recalls and Safety Alerts: 100
- EU Safety Gate: 100
- UK FSA Food Alerts: 100
- Australia Product Safety: 100
- New Zealand Product Safety: 100
- Hong Kong CFS: 100
- FSANZ Food Recalls: 100
- Total: 1201

## Image Audit

```powershell
npm run audit:images
```

This command is local-only by default. It reads the processed recall files, reports image URL availability by source, host/domain distribution, detectable file extensions or API-style image URLs, duplicate URL references, and suspicious URL shapes.

For a bounded live image check, run:

```powershell
npm run audit:images:live
```

The live mode checks at most 20 image URLs per source with short timeouts. Do not add live image checks to `npm run check` or `npm run build`.

## Launch Validation

```powershell
npm run validate:launch
```

This command is local-only. It runs:

1. `npm run audit:sources`
2. `npm run audit:fsanz-food-recalls`
3. `npm run audit:hong-kong-cfs`
4. `npm run audit:new-zealand-product-safety`
5. `npm run audit:australia-product-safety`
6. `npm run audit:uk-fsa`
7. `npm run audit:eu-safety-gate`
8. `npm run audit:canada`
9. `npm run audit:rappelconso`
10. `npm run check`
11. `npm run build`

It does not run fetch, update, or data-refresh scripts. Use it before launch, staging deployment, or final merge to `main`.

## Recall Taxonomy V2 Design Audit

```powershell
npm run audit:recall-taxonomy-v2-design
```

This command is static and non-network. It validates the Phase 41 taxonomy v2 design contract, draft enum/type file, artificial classification fixtures, and LLM classifier contract. It does not call an LLM, fetch sources, normalize records, merge data, change `data/processed/recalls.json`, or migrate runtime UI.

## Recall Taxonomy V2 Classifier Dry Run

```powershell
npm run classify:recalls:taxonomy-v2:dry-run
```

This command reads the current canonical processed recalls, selects a balanced sample, builds compact classifier inputs, and writes ignored local dry-run outputs under `outputs/llm-classifier/`. Default mode is deterministic `mock` and requires no network or API key.

Optional live-provider modes are key-gated:

```powershell
$env:RECALL_CLASSIFIER_PROVIDER = "gemini"
$env:GEMINI_API_KEY = "<set outside git>"
npm run classify:recalls:taxonomy-v2:dry-run
Remove-Item Env:RECALL_CLASSIFIER_PROVIDER
```

or:

```powershell
$env:RECALL_CLASSIFIER_PROVIDER = "openai"
$env:OPENAI_API_KEY = "<set outside git>"
npm run classify:recalls:taxonomy-v2:dry-run
Remove-Item Env:RECALL_CLASSIFIER_PROVIDER
```

Audit the dry-run wiring and local output:

```powershell
npm run audit:llm-classifier-dry-run
```

Phase 42 dry runs do not fetch, normalize, merge, backfill, edit canonical data, activate Korea, change source ids/counts, or modify runtime pages and filters. Keep generated `outputs/llm-classifier/` files uncommitted.

## Recall Data Schema V2 Readiness Audit

```powershell
npm run audit:recall-data-schema-v2-readiness
```

This command is static and non-network. It validates the Phase 43 schema docs, type-only V2 schema draft, future DB planning doc, and Phase 44 per-source LLM classification plan. It does not call an LLM, fetch sources, normalize records, merge data, change canonical processed files, create a database, or modify runtime pages.
