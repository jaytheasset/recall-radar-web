# New Zealand Product Safety source

Phase 37 adds a bounded New Zealand Product Safety source spike:

- Source id: `NZ_PRODUCT_SAFETY`
- Visible label: `New Zealand - Product Safety`
- Official source page: `https://www.productsafety.govt.nz/recalls`
- Current bounded count: 100 records
- Current canonical total after Phase 38: 1101 records

This is not a full New Zealand backfill and does not imply complete New Zealand recall coverage.

## Official source behavior

`npm run debug:new-zealand-product-safety-access` verifies that the official Product Safety New Zealand recalls page is reachable without an API key.

The official site did not expose a usable JSON or RSS recall feed during Phase 37:

- `/recalls?format=json` and `/recalls.json` returned HTML, not JSON.
- `/recalls/rss` and `/recalls/feed` returned 404.
- The HTML listing exposes official recall detail links, dates, category labels, product images, and `start` pagination.

The fetch script therefore uses official HTML listing pages plus official detail pages. It does not use a proxy, backend, database, image download, CDN, or unofficial mirror.

## Commands

Fetch the bounded latest 100 Product Safety New Zealand recalls:

```powershell
npm run fetch:new-zealand-product-safety
```

To rebuild processed New Zealand data from the saved raw file:

```powershell
npm run normalize:new-zealand-product-safety
```

To audit the current New Zealand source without network calls:

```powershell
npm run audit:new-zealand-product-safety
```

For local-only validation from the existing raw file:

```powershell
npm run data:new-zealand-product-safety:normalize
npm run data:merge
npm run audit:new-zealand-product-safety
```

## Normalization

The normalizer maps official Product Safety New Zealand records into the shared `NormalizedRecall` contract:

- `source: NZ_PRODUCT_SAFETY`
- official Product Safety New Zealand `sourceUrl`
- title
- recall date
- supplier/brand names where present
- product identifiers and product names
- conservative category mapping
- hazard/reason text
- consumer action/remedy text
- official product image URLs
- stable detail slug derived from the official notice path
- raw official listing/detail fields needed for detail pages and audit

Specialist vehicle, NZTA, medical, MedSafe, and pharmaceutical records are excluded from this bounded product-safety source. Future food and vehicle sources should remain separate from `NZ_PRODUCT_SAFETY`.

## Category mapping

Category mapping is intentionally conservative:

- toys, baby, child, nursery, cot, stroller, pram, teether -> `baby-kids`
- battery, charger, power bank, lithium, electrical, electronics, smoke alarm -> `battery-electronics`
- food, allergen, undeclared, milk, egg, wheat, peanut, sesame -> `food-allergy`
- appliance, furniture, household, kitchen, home, night light, heater, washing machine, lamp, towel -> `household-appliance`
- otherwise -> `general-consumer-product`

The mapping should not force unrelated New Zealand records into a product type.

## Images

The fetch and normalize scripts keep official Product Safety New Zealand image URLs only when they use:

```text
https://www.productsafety.govt.nz/assets/uploads/
```

Cards use the official thumbnail where available. Detail pages can progressively use the official full image. The site does not download, proxy, crop aggressively, or replace official images with unrelated images.

## Audit expectations

`npm run audit:new-zealand-product-safety` verifies:

- source count is exactly 100
- canonical total is exactly 1101
- existing source counts remain unchanged
- source id is `NZ_PRODUCT_SAFETY`
- duplicate ids, slugs, and source URLs are absent
- recall dates are valid
- source URLs are official Product Safety New Zealand recall URLs
- image URLs are official Product Safety New Zealand asset URLs
- raw HTML/script/style text does not leak into visible normalized fields
- specialist vehicle/medical records are excluded
- source filter values include `NZ_PRODUCT_SAFETY`

The audit intentionally warns, rather than fails, when affected unit counts are absent because Product Safety New Zealand does not expose affected unit counts in a consistent structured field.

## Known limitations

- The current spike is the latest 100 Product Safety New Zealand notices, not a full historical backfill.
- The official site did not expose a JSON or RSS feed in this phase, so the connector depends on official HTML structure.
- Some records do not expose a clean brand/supplier field.
- Affected unit counts are not consistently structured.
- Cross-source dedupe is not implemented.
- New Zealand MPI food recalls and NZTA vehicle recalls are not included.

## Future work

A full New Zealand backfill remains deferred. Future work should:

- keep `NZ_PRODUCT_SAFETY` bounded until source selectors and pagination remain stable
- add ignored chunk output before any full historical expansion
- keep New Zealand food and vehicle sources separate
- audit source ids, duplicate ids, slug collisions, source URLs, dates, images, raw HTML leakage, and static route growth before canonical merge
