# Scripts

This folder contains local-only data preparation scripts.

Current rules:

- The only external API allowed in phase 2 is the public CPSC recall API.
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
- Saves normalized records to `data/processed/recalls.json`.
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
