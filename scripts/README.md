# Scripts

This folder contains local-only data preparation scripts.

Current rules:

- The public CPSC recall API is allowed only when a task asks for CPSC refreshes.
- The public openFDA food enforcement API is allowed only when a task asks for FDA/openFDA food recall refreshes.
- The public RappelConso open data endpoint is allowed only when a task asks for France RappelConso refreshes.
- The public Canada Recalls and Safety Alerts open-data feed is allowed only when a task asks for Canada recall refreshes.
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

The canonical `data/processed/recalls.json` file is the local site source and can contain CPSC, FDA/openFDA, France RappelConso, and Canada records.

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

To run the explicit Canada refresh workflow, including network fetch and local audit:

```powershell
npm run update:canada
```

For local-only validation from the existing raw file:

```powershell
npm run data:canada:normalize
npm run data:merge
npm run audit:canada
```

The canonical `data/processed/recalls.json` file is the local site source and can contain CPSC, FDA/openFDA, France RappelConso, and Canada Recalls and Safety Alerts records.
