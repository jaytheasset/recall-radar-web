# Australia Product Safety source

## Scope

Recall Radar includes a bounded Australia Product Safety source spike:

- Source id: `AU_PRODUCT_SAFETY`
- Visible label: `Australia · Product Safety Australia`
- Official source page: `https://www.productsafety.gov.au/recalls`
- Current count: 100 indexed notices
- Canonical total after Phase 33: 901 records

This is not a full Australia backfill and does not imply complete Australia recall coverage.

## Fetch behavior

`npm run fetch:australia-product-safety` uses the official Product Safety Australia recalls page. The visible RSS link currently redirects to itself, so the script reads the page's Drupal AJAX view settings and requests the official `/views/ajax` listing pages. It then fetches the official detail page for each bounded record.

The script writes:

- `data/raw/australia-product-safety-recalls.json`
- `data/processed/australia-product-safety-recalls.json`
- merged `data/processed/recalls.json`

The default limit is 100. Do not expand beyond that without a separate backfill phase.

## Normalization

Normalized records use:

- `source: AU_PRODUCT_SAFETY`
- official `sourceUrl`
- title, brand/company, product name, category, reason/hazard, action, recall date
- sale/trader/manufacturer details where present
- official Product Safety Australia image and thumbnail URLs
- raw official snapshot for review

Category mapping is conservative:

- baby/toddler/toy records -> `baby-kids`
- electronics, button battery, charger, and electrical records -> `battery-electronics`
- food/grocery/allergen records -> `food-allergy`
- home/garden/appliance/furniture/gas/chemical records -> `household-appliance`
- other records -> `general-consumer-product`

## Validation

Use:

```powershell
npm run audit:australia-product-safety
npm run audit:sources
npm run audit:images
npm run check
npm run build
npm run validate:launch
```

Expected counts:

- Total: 901
- AU_PRODUCT_SAFETY: 100
- Existing sources unchanged

## Deferred

- No full Australia backfill
- No Australia food or vehicle specialist source
- No image download, proxy, cache, or CDN
- No backend
- No translation
