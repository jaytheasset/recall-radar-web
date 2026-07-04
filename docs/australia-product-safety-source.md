# Australia Product Safety source

## Scope

Recall Radar includes a bounded Australia Product Safety source spike:

- Source id: `AU_PRODUCT_SAFETY`
- Visible label: `Australia - Product Safety Australia`
- Official source page: `https://www.productsafety.gov.au/recalls`
- Current count: 100 indexed notices
- Canonical total after Phase 33: 901 records
- Current canonical total after Phase 37: 1001 records

This is not a full Australia backfill and does not imply complete Australia recall coverage.

## Official source behavior

`npm run fetch:australia-product-safety` uses the official Product Safety Australia recalls page.

The RSS endpoint documented during source discovery currently self-redirects instead of returning a usable recall feed for this spike:

```text
https://www.productsafety.gov.au/rss/feed.xml/psa_recall
```

Because of that, the fetch script reads the official Drupal AJAX view settings from the recalls page and requests the official `/views/ajax` listing endpoint. It then fetches the official detail page for each bounded listing record.

The current fetch mode is intentionally bounded:

- Default limit: 100
- Maximum limit in the script: 100
- Records selected: latest listing records from the official page
- Detail enrichment: official detail HTML for each selected notice
- No ignored backfill chunks are produced by the current fetch command

Do not expand beyond 100 records without a separate backfill phase.

## Files written by refresh

The refresh command writes:

- `data/raw/australia-product-safety-recalls.json`
- `data/processed/australia-product-safety-recalls.json`
- merged `data/processed/recalls.json`

The raw file preserves the official detail snapshot fields used by normalization. The processed file keeps normalized fields and the raw payload for detail-page review.

## Normalization

Normalized records use:

- `source: AU_PRODUCT_SAFETY`
- official Product Safety Australia `sourceUrl`
- title
- brand/company and supplier names
- product names and product description
- source category
- reason, hazard, and consumer action
- recall date
- sale/trader/location details where present
- official Product Safety Australia product image and thumbnail URLs
- stable `au-product-safety-*` ids
- stable detail slugs derived from the title and source id
- raw official snapshot for review

Category mapping is conservative:

- baby, toddler, child, toy, dummy, or pram records -> `baby-kids`
- battery, charger, lithium, electronics, electrical records -> `battery-electronics`
- food, grocery, allergen, undeclared ingredient records -> `food-allergy`
- home, garden, appliance, furniture, gas, chemical, poison records -> `household-appliance`
- other records -> `general-consumer-product`

## Image and media policy

Australia images are source-traceable only when they use the official Product Safety Australia host:

```text
https://www.productsafety.gov.au/system/files/...
```

The normalizer keeps official detail images and official thumbnail derivatives when available. It does not download images, proxy images, build a CDN, or replace source images with unrelated placeholders.

The audit rejects malformed image URLs and non-official image hosts. It also reports suspicious image candidates such as logos, icons, headers, footers, tracking assets, or placeholders so a future refresh can be reviewed before merge.

## Identifier extraction

The normalizer and audit look for identifier-like values already present in the official text, including:

- model number
- item number
- product number
- barcode, GTIN, or UPC
- batch or lot code
- SKU
- serial number
- campaign or recall number
- long barcode-like numeric values

The current source does not guarantee structured identifiers for every notice. Missing identifier-like text is not a blocker by itself.

## Audit command

Use:

```powershell
npm run audit:australia-product-safety
```

The Australia audit verifies:

- source count is exactly 100
- canonical total is exactly 1001
- existing source counts remain unchanged
- source filter values remain unchanged
- source id is `AU_PRODUCT_SAFETY`
- duplicate ids, slugs, and source URLs are absent
- required fields are not severely missing
- recall dates are valid `YYYY-MM-DD` dates
- source URLs are official Product Safety Australia notice URLs
- image URLs are valid official Product Safety Australia file URLs
- raw HTML, script, or style markup does not leak into visible normalized fields
- category distribution is reported
- image host distribution is reported
- supplier/brand, product, hazard/reason, remedy/action, distribution, and identifier coverage are reported

The audit intentionally warns, rather than fails, when affected unit counts are absent because Product Safety Australia does not expose affected units in a consistent structured field.

## Local validation sequence

For a no-network QA phase, use existing committed data:

```powershell
npm run audit:australia-product-safety
npm run audit:sources
npm run audit:images
npm run check
npm run build
npm run validate:launch
```

For a bounded live image check, use:

```powershell
npm run audit:images:live
```

Do not add live image checks to `npm run check` or `npm run build`.

## Explicit update workflow

Only run the Australia network refresh when a task explicitly asks for a source refresh:

```powershell
npm run update:australia-product-safety
```

That command fetches the bounded official listing, normalizes from the saved raw file, rebuilds the merged canonical file, and runs the Australia audit.

After a refresh, commit the raw Australia file, processed Australia file, and canonical merged file together only if all source audits and launch validation pass.

## Future backfill strategy

A full Australia Product Safety backfill remains deferred. Future backfill work should:

- write ignored chunks under `data/backfill/australia-product-safety/`
- keep raw chunks, processed chunks, checkpoints, and manifests out of normal commits unless a tiny fixture is intentionally reviewed
- add paging controls that do not replace the current 100-record spike accidentally
- audit source id stability, duplicate ids, slug collisions, source URLs, dates, images, raw HTML leakage, and static route growth before canonical merge
- measure canonical data size, detail page count, brand page growth, build time, and output size
- keep source-specific food and vehicle sources separate instead of mixing them into `AU_PRODUCT_SAFETY`

## Known limitations

- The current spike is the latest 100 Product Safety Australia notices, not a full historical backfill.
- The RSS path investigated during Phase 33 was not usable for this spike.
- Affected unit counts are not consistently exposed in a structured field.
- Food Standards Australia New Zealand food recalls are not included.
- Vehicle recalls are not included.
- No translation, AI summaries, backend, database, image proxy, image download, or CDN is used.
