# Canada Recalls Source

## Source

- Source name: Canada Recalls and Safety Alerts
- Source id: `CA_RECALLS`
- Market: Canada
- Official site: `https://recalls-rappels.canada.ca/en`
- Official alerts listing: `https://recalls-rappels.canada.ca/en/recalls-alerts`
- Official open-data dataset: `https://open.canada.ca/data/en/dataset/d38de914-c94c-429b-8ab1-8776c31643e3`
- Selected JSON feed: `https://recalls-rappels.canada.ca/sites/default/files/opendata-donneesouvertes/HCRSAMOpenData.json`

The Canada homepage links to the Open Government data feed and describes the recall and alert data as available in CSV and JSON formats, updated daily.

## Current Bounded Spike

Phase 8 adds a bounded Canada source spike, not a full Canada backfill.

- Default limit: `CANADA_RECALLS_LIMIT=100`
- Raw file: `data/raw/canada-recalls.json`
- Processed source file: `data/processed/canada-recalls.json`
- Canonical merged file: `data/processed/recalls.json`
- Current Canada records: 100
- Current canonical total: 601

The selected JSON feed returns the broader open-data file. The fetch script sorts records by `Last updated` newest first and writes only the bounded first 100 records into the local raw file.

## Commands

Fetch the bounded Canada spike from the official JSON feed:

```powershell
npm run fetch:canada
```

Fetch with an explicit limit:

```powershell
npm run fetch:canada -- --limit=100
```

Or use the environment variable:

```powershell
$env:CANADA_RECALLS_LIMIT = "100"
npm run fetch:canada
Remove-Item Env:CANADA_RECALLS_LIMIT
```

Rebuild Canada processed data from the committed raw file without a network call:

```powershell
npm run normalize:canada
```

Run the local audit:

```powershell
npm run audit:canada
```

The explicit update workflow is:

```powershell
npm run update:canada
```

`update:canada` performs a network fetch and then runs the Canada audit. It is not part of `npm run check` or `npm run build`.

## Field Mapping

The selected Canada JSON feed currently exposes summary fields:

- `NID`
- `Title`
- `URL`
- `Organization`
- `Product`
- `Issue`
- `What you should do`
- `Category`
- `Recall class`
- `Last updated`
- `Archived`

Recall Radar maps these into `NormalizedRecall` as follows:

- `id`: `ca-recalls-${NID}`
- `source`: `CA_RECALLS`
- `sourceUrl`: `URL`
- `title`: `Title`
- `recallDate`: `Last updated`
- `category`: official `Category`
- `productNames`: `Product`, with explicit identifiers if present in text
- `brandNames`: obvious title patterns such as "`X` brand"; left empty when not obvious
- `hazard` / `reason`: `Issue`
- `remedy`: `What you should do`
- `description`: source organization, category, product, issue, identifiers, and action text
- `recallNumber`: `NID`
- `classification`: `Recall class`
- `status`: `Archived` mapped to active or archived status
- `raw`: original Canada record

## Category Mapping

Canada category mapping is conservative:

- CFIA records and food/allergen/microbial terms map to `food-allergy`
- Baby, child, infant, toy, nursery, and kids terms map to `baby-kids`
- Battery, charger, electronics, power bank, and lithium terms map to `battery-electronics`
- Household, appliance, kitchenware, tableware, air conditioner, and heat pump terms map to `household-appliance`
- Vehicle, health product, medical device, cannabis, and ambiguous records remain `general-consumer-product`

No new category pages were added in Phase 8.

## Identifier Availability

The selected open-data JSON feed is summary-oriented. It does not consistently expose structured UPC/barcode, lot, model, DIN, NPN, distribution, or affected-product table fields.

The normalizer only extracts identifier-like text when it is explicit in the summary fields. It does not invent missing identifiers.

## Audit

`npm run audit:canada` checks:

- `CA_RECALLS` count
- total canonical count
- per-source counts
- duplicate ids
- slug collisions
- missing source URLs, titles, and dates
- missing product, brand, reason, action, and raw payload fields
- category distribution
- image availability
- UPC/barcode-like text
- lot/batch/code/date-like text
- distribution details
- official Canada URL shape
- suspicious category mappings

Current expected counts:

- CPSC: 301
- FDA/openFDA: 100
- France RappelConso: 100
- Canada Recalls and Safety Alerts: 100
- Total: 601

## Known Limitations

- Canada records may include English/French text depending on source.
- The selected English JSON feed does not expose full affected-product tables.
- Not all records have UPC/barcode.
- Not all records have lot/date/model fields.
- Some records may be safety alerts rather than strict product recalls.
- The selected feed does not include stable image links, so `supportsImages` is false.
- The selected feed does not include structured distribution details, so `supportsDistributionDetails` is false.
- Brand/company is inferred only when obvious from the title.
- No cross-source dedupe exists yet.
- Static processed data only; no runtime freshness.
- No full Canada backfill yet.

## Deferred

- Full Canada backfill
- French feed ingestion
- Detailed official notice page extraction
- Structured affected products table parsing
- Cross-source dedupe
- Vehicle-specific category support
- Health-product-specific category support
