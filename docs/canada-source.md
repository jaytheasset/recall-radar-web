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
- Current canonical total after Phase 10.2 UK FSA: 801

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

## Operational Update Strategy

Canada is currently maintained as a bounded 100-record static source. It is safe to refresh only when the task explicitly asks for Canada data maintenance.

Current paths:

- Raw local file: `data/raw/canada-recalls.json`
- Processed Canada source file: `data/processed/canada-recalls.json`
- Canonical merged processed file: `data/processed/recalls.json`

Default limit:

- `CANADA_RECALLS_LIMIT=100`
- `npm run fetch:canada` also accepts `-- --limit=100`
- The default must remain 100 until a separate full-backfill phase is approved.
- The fetch script clamps limits to a small bounded range and does not silently ingest the full Canada feed.

The normal refresh command is:

```powershell
npm run update:canada
```

`update:canada` runs the explicit maintenance pipeline:

1. Fetch the official Canada JSON feed with the bounded limit.
2. Save `data/raw/canada-recalls.json`.
3. Normalize the bounded Canada records into `data/processed/canada-recalls.json`.
4. Merge all processed source files into `data/processed/recalls.json`.
5. Run `npm run audit:canada`.

For local-only validation without a network request, use the committed raw file:

```powershell
npm run data:canada:normalize
npm run data:merge
npm run audit:canada
```

After the current 100-record spike, expected counts are:

- `CA_RECALLS`: 100
- `FR_RAPPELCONSO`: 100
- `CPSC`: 301
- `FDA`: 100
- Total: 601

If the Canada limit changes, expect these values to change:

- `data/raw/canada-recalls.json` `limit`, `count`, and record list
- `data/processed/canada-recalls.json` `count` and record list
- `data/processed/recalls.json` total count and `countsBySource.CA_RECALLS`
- Generated static page count after `npm run build`

Review diffs before committing:

```powershell
git status --short
git diff --stat
git diff -- data/raw/canada-recalls.json data/processed/canada-recalls.json data/processed/recalls.json
npm run audit:canada
```

Commit strategy for the 100-record spike:

- Commit `data/raw/canada-recalls.json`.
- Commit `data/processed/canada-recalls.json`.
- Commit `data/processed/recalls.json`.
- Commit script or documentation changes in the same maintenance change only when they directly explain or support the refresh.

For a future full Canada backfill:

- Reconsider committing huge raw exports before adding them to git.
- Consider committing a smaller raw fixture while generating larger processed output during explicit maintenance.
- Revisit static build size, page count, and review ergonomics before merging.
- Treat full backfill as a separate phase.

Merge should be blocked or investigated if:

- `CA_RECALLS` count is 0.
- Duplicate ids are found.
- Slug collisions are found.
- Suspicious category mappings are found.
- Source URL, title, or recall date missing counts exceed the audit threshold.
- Official Canada URL shape no longer matches the selected feed.
- Source filter values differ from `all`, `CPSC`, `FDA`, `FR_RAPPELCONSO`, `CA_RECALLS`.
- Total processed count changes unexpectedly without a written explanation.

Known current Canada limitations should not block by themselves:

- No stable image links.
- No structured distribution field in the current 100-record spike.
- No structured UPC/model/lot values in the current 100-record spike.
- Some records lack structured brand/company or action text.

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
- model/item-number-like text
- lot/batch/code/date-like text
- distribution details
- official Canada URL shape
- suspicious category mappings
- source filter values

Current expected counts:

- CPSC: 301
- FDA/openFDA: 100
- France RappelConso: 100
- Canada Recalls and Safety Alerts: 100
- Total: 601

## Phase 8.1 QA

Phase 8.1 re-audited the committed 100-record Canada spike from local files only:

- Raw file: `data/raw/canada-recalls.json`
- Processed source file: `data/processed/canada-recalls.json`
- Canonical merged file: `data/processed/recalls.json`
- Source id: `CA_RECALLS`
- Canada records: 100
- Canonical total: 601

Audit method:

- Ran `npm run audit:canada` without a network fetch.
- Compared Canada processed records against the canonical merged file.
- Verified source counts, duplicate ids, slug collisions, required field presence, official URL shape, category mapping, and identifier availability.

Phase 8.1 audit summary:

- CPSC: 301
- FDA/openFDA: 100
- France RappelConso: 100
- Canada Recalls and Safety Alerts: 100
- Total: 601
- Duplicate ids: 0
- Slug collisions: 0
- Official Canada URL shape: 100 of 100
- Records with images: 0
- Records with UPC/barcode-like values: 0
- Records with model/item-number-like values: 0
- Records with lot/batch/code/date-like values: 0
- Records with structured distribution details: 0

Canada site category distribution after QA:

- `food-allergy`: 14
- `baby-kids`: 10
- `battery-electronics`: 2
- `household-appliance`: 3
- `general-consumer-product`: 71

What changed in Phase 8.1:

- Added a separate Canada audit metric for model/item-number-like values.
- Tightened Canada audit identifier checks to avoid false positives from words such as "experience", "explanation", or "expanded".
- Tightened recall detail identifier extraction so generic text such as "model label" or "item" is not displayed as a model/item number.
- Kept Canada sparse-identification copy generic and source-neutral.
- Kept Canada category mapping conservative, with clear furniture/furnishings terms allowed in the existing household bucket while vehicle and health-product notices remain general for now.

## Known Limitations

- Canada records may include English and/or French text depending on source data.
- The selected English JSON feed does not expose full affected-product tables.
- Not all records have UPC/barcode.
- Not all records have model, lot, or date fields.
- Some records are safety alerts or notifications rather than strict recall notices.
- Some records may lack structured brand/company or action text.
- The selected feed does not include stable image links, so `supportsImages` is false.
- Structured distribution details may be limited; the selected feed does not expose a dedicated distribution field.
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
