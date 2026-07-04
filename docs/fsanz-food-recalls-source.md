# Australia/New Zealand FSANZ Food Recalls Source

Phase 39 adds a bounded official FSANZ food recall source for Australia/New Zealand food recall notices.

## Source

- Source id: `FSANZ_FOOD_RECALLS`
- Visible label: `Australia/New Zealand · FSANZ`
- Landing page: `/australia-new-zealand-food-recalls`
- Default bounded count: 100 records
- Official listing: `https://www.foodstandards.gov.au/food-recalls/recall-alert`
- Official RSS: `https://www.foodstandards.gov.au/food-recalls-rss.xml`

The RSS feed is used only as supplemental latest metadata because it exposes fewer than 100 items. The fetch pipeline uses official FSANZ listing pagination plus official detail pages for the bounded 100-record spike.

## Commands

```powershell
npm run debug:fsanz-food-recalls-access
npm run fetch:fsanz-food-recalls
npm run normalize:fsanz-food-recalls
npm run audit:fsanz-food-recalls
```

The explicit refresh workflow is:

```powershell
npm run update:fsanz-food-recalls
```

For local-only validation from the saved raw file:

```powershell
npm run data:fsanz-food-recalls:normalize
npm run data:merge
npm run audit:fsanz-food-recalls
```

## Data Files

- Raw: `data/raw/fsanz-food-recalls.json`
- Processed: `data/processed/fsanz-food-recalls.json`
- Canonical: `data/processed/recalls.json`

## Normalization Notes

- Category mapping is food-first and currently routes FSANZ notices into `food-allergy`, `food`, or conservative general categories based on problem, hazard, product, and date-marking text.
- Official detail pages can expose product name, company/brand, date marking, problem, food safety hazard, consumer action, contact details, PDF recall notice links, and product images.
- Source URLs stay on `https://www.foodstandards.gov.au/food-recalls/recall-alert/...`.
- Official image URLs stay on `https://www.foodstandards.gov.au/sites/default/files/...`.
- Text is preserved in source language and is not translated.
- Some FSANZ notices do not expose batch, barcode, pack, or date identifiers in a consistent structured field; users must verify the official notice and package label.

## Current Counts

- Canonical total: 1201
- `FSANZ_FOOD_RECALLS`: 100

## Deferred

- No full FSANZ backfill.
- No image download, proxy, or CDN.
- No backend or runtime API.
- No translation or multilingual route work.
