# UK FSA Food Alerts Source Spike

Phase 10 adds a bounded United Kingdom Food Standards Agency Food Alerts source spike.

## Official Source Verification

Official pages checked:

- API catalogue: `https://www.api.gov.uk/fsa/food-alerts/`
- API documentation: `https://data.food.gov.uk/food-alerts/ui/reference`
- API model: `https://data.food.gov.uk/food-alerts/ui/model`

The implementation uses the official FSA Food Alerts linked-data API:

- Recent alert list: `https://data.food.gov.uk/food-alerts/id.json?_limit=100&_sort=-created`
- Alert detail: `https://data.food.gov.uk/food-alerts/id/{notation}.json`
- Official notice links from the payload use `https://alerts.food.gov.uk/news-alerts/alert/{notation}` or `https://www.food.gov.uk/news-alerts/alert/{notation}`.

No third-party mirror and no HTML scraping are used.

## Current Scope

- Source id: `UK_FSA`
- Display label: `United Kingdom · FSA Food Alerts`
- Default limit: `UK_FSA_LIMIT=100`
- Current UK FSA records: 100
- Current canonical total: 801
- Product scope: food alerts, allergy alerts, product recall information notices, and food alerts for action
- Static/local-first only: the built site reads `data/processed/recalls.json`
- No runtime browser API calls
- No backend, database, account system, email, product registration, alert backend, LLM feature, or affiliate behavior

## Commands

Fetch the bounded UK FSA spike from the official FSA API:

```powershell
npm run fetch:uk-fsa
```

Rebuild UK FSA processed data from the committed raw file without a network call:

```powershell
npm run normalize:uk-fsa
```

Audit the local UK FSA processed data:

```powershell
npm run audit:uk-fsa
```

Run the explicit UK FSA refresh workflow:

```powershell
npm run update:uk-fsa
```

`update:uk-fsa` performs a network fetch and then runs the UK FSA audit. It is not part of `npm run check` or `npm run build`.

## Operational Update Strategy

UK FSA updates are an explicit maintenance workflow for the existing 100-record static source. They are not part of normal builds, checks, or UI work.

Current defaults and paths:

- Default limit: `UK_FSA_LIMIT=100`
- Raw file: `data/raw/uk-fsa-alerts.json`
- Processed UK FSA file: `data/processed/uk-fsa-alerts.json`
- Canonical merged file: `data/processed/recalls.json`
- Fetch script: `scripts/fetch-uk-fsa-alerts.ts`
- Normalize script: `scripts/normalize-uk-fsa-alerts.ts`
- Merge script: `scripts/merge-recalls.ts`
- Audit script: `scripts/audit-uk-fsa-alerts.ts`

Local-only validation from the committed raw file:

```powershell
npm run data:uk-fsa:normalize
npm run data:merge
npm run audit:uk-fsa
```

Expected counts after the current 100-record spike:

- CPSC: 301
- FDA/openFDA: 100
- France RappelConso: 100
- Canada Recalls and Safety Alerts: 100
- EU Safety Gate: 100
- UK FSA Food Alerts: 100
- Total: 801

Limit controls:

- Default remains `UK_FSA_LIMIT=100`.
- A smaller or same-size refresh can use `npm run fetch:uk-fsa -- --limit=50` or `$env:UK_FSA_LIMIT = "100"`.
- Do not silently pull all FSA Food Alerts records.
- Do not increase the default above 100 in this phase.
- A higher limit or full backfill must be a separate phase with page-count, brand-page growth, raw-size, and build-time review before merge.

## Normalized Mapping

UK FSA records are mapped into `NormalizedRecall`:

- `id`: `uk-fsa-{notation}`
- `source`: `UK_FSA`
- `sourceUrl`: official FSA alert notice URL from `alertURL`
- `title`: official FSA alert title
- `brandNames`: `reportingBusiness.commonName` and `otherBusiness.commonName` when present
- `productNames`: product names plus pack, batch, lot, best-before, and use-by details when present
- `category`: alert type, such as Allergy Alert, Product Recall Information Notice, or Food Alert For Action
- `hazard` / `reason`: FSA problem risk statement or allergen/pathogen labels
- `remedy`: consumer advice and action taken
- `recallDate`: alert `created` date
- `classification`: alert type
- `recallNumber`: FSA notation, such as `FSA-AA-34-2026`
- `distributionPattern`: United Kingdom
- `raw`: original FSA detail payload

## Audit Expectations

The UK FSA audit checks:

- UK FSA record count
- canonical source counts
- source filter values
- duplicate ids
- slug collisions
- missing required fields
- official notice URL shape
- batch/date detail coverage
- pack size coverage
- allergen or risk label coverage
- retailer, store, distribution, or food-business detail coverage
- image and related-media availability
- alert type distribution
- classification distribution
- conservative food/allergy site category mapping
- suspicious category mappings

Current audited characteristics:

- UK FSA records: 100
- Total canonical records: 801
- Official notice URL shape: 100 records
- Batch/date-like details: 34 records
- Pack size values: 95 records
- Allergen or risk labels: 85 records
- Retailer, store, distribution, or food-business details: 98 records
- Images normalized for product cards: 0 records
- Related media notices in raw payloads: 96 records
- Site category mapping: 100 records mapped to food/allergy
- Classification distribution: 52 Allergy Alert, 46 Product Recall Information Notice, 2 Food Alert For Action

## Phase 10.1 QA

Phase 10.1 used the committed local files only:

- `data/raw/uk-fsa-alerts.json`
- `data/processed/uk-fsa-alerts.json`
- `data/processed/recalls.json`

The QA method was:

1. Re-run the UK FSA audit against processed data.
2. Inspect representative Allergy Alert, Product Recall Information Notice, and Food Alert For Action records.
3. Regenerate processed UK FSA data from the committed raw file after mapping fixes.
4. Re-run UK FSA, EU Safety Gate, Canada, and RappelConso audits plus Astro check/build.

Phase 10.1 fixes:

- Hardened the UK FSA audit to report pack size, related media, image availability, retailer/distribution-like details, alert type distribution, and suspicious category mappings.
- Kept all 100 UK FSA records conservatively mapped to `food-allergy`.
- Corrected Food Alert For Action brand/company mapping so generic instructions such as "Food businesses selling these products..." are not displayed as a brand or company.
- Added title-based supplier/manufacturer extraction for Food Alert For Action notices when the source title clearly names the responsible business.
- Adjusted UK FSA detail intro copy so food alerts do not read like non-food consumer-product notices.

Phase 10.1 audited distribution summary:

- Alert types: 52 Allergy Alert, 46 Product Recall Information Notice, 2 Food Alert For Action
- Site category: 100 food/allergy
- Batch/date-like details: 34 records
- Pack size values: 95 records
- Allergen or ingredient/risk labels: 85 records
- Retailer, store, distribution, or food-business details: 98 records
- Product-card images: 0 records
- Related media notices: 96 records

## Known Limits

- UK FSA Food Alerts are food/allergy-focused and do not cover all UK product recalls.
- This is a bounded 100-record spike, not a full UK FSA backfill.
- Some FSA records do not expose batch, lot, best-before, or use-by details in structured fields.
- Some alerts may include multiple affected products.
- Some records have sparse brand/company or action text.
- Some records use `alerts.food.gov.uk`; older or current records may use `www.food.gov.uk`.
- No official product image normalization is included for UK FSA records in this phase.
- UK FSA raw/detail payloads can be verbose. The 100-record spike already creates sizeable raw and processed diffs.
- Full backfill should be a separate phase and should reconsider raw-file commit strategy.
- Future optimization may store a smaller raw fixture or only normalized processed records.
- There is no cross-source dedupe yet.
- The site reads static processed data only.
- There is no runtime freshness; updates require an explicit maintenance workflow.
