# Australia Product Safety Classifier Input Preview

This preview checks what `AU_PRODUCT_SAFETY` records would send into the future Taxonomy V2 LLM classifier.

It is a preview and audit step only. It does not call Gemini or OpenAI, does not classify records, and does not write canonical data.

## Commands

```powershell
npm run preview:australia-product-safety-classifier-input
npm run audit:australia-product-safety-classifier-input-preview
```

Optional sample limit:

```powershell
$env:AUSTRALIA_PRODUCT_SAFETY_CLASSIFIER_INPUT_PREVIEW_LIMIT = "20"
npm run preview:australia-product-safety-classifier-input
Remove-Item Env:AUSTRALIA_PRODUCT_SAFETY_CLASSIFIER_INPUT_PREVIEW_LIMIT
```

## Output

The preview writes ignored local files under:

`outputs/llm-classifier/input-preview/australia-product-safety/`

Generated files:

- `australia-product-safety-input-preview.json`
- `australia-product-safety-input-preview.md`
- `australia-product-safety-noise-report.json`
- `australia-product-safety-token-comparison.json`

Do not commit generated preview outputs.

## Proposed Input Shape

The source-specific Australia Product Safety input keeps official source evidence only:

- `id`
- `source`
- `sourceUrl`
- `recallDate`
- `title`
- `productNames`
- `brandNames`
- `sourceCategories`
- `sourcePrimaryCategory`
- `productDescription`
- `supplierName`
- `brandText`
- `defectText`
- `hazardText`
- `actionText`
- `traderText`
- `saleDateText`
- `soldWhereText`
- `manufacturerCountry`
- `recallNumber`
- `identifiers`
- `sourceHints`

`sourceCategories` and `sourcePrimaryCategory` are official Product Safety Australia evidence only. They are not public category assignments.

`defectText`, `hazardText`, and `actionText` preserve the official recall reason, hazard, and consumer action fields without assigning final Taxonomy V2 values.

`identifiers` preserves explicit model, SKU, item, part, serial, batch, lot, barcode, GTIN, UPC, and similar source-derived values when available.

## Exclusions

The preview excludes:

- full raw objects
- image URLs
- raw HTML
- navigation, footer, or social text
- long contact blocks when they do not help classification
- generic fallback strings
- final Taxonomy V2 fields

Final public taxonomy values remain LLM-owned.

## Sampling

The default sample selects up to 20 records and tries to include:

- baby, toddler, or toy records
- button-battery or electronics records
- household, furniture, or appliance records
- vehicle, EV charger, or mobility-like records
- tools or machinery records
- chemical or poison records
- sports or clothing records
- model, SKU, batch, or barcode identifier evidence
- marketplace or trader evidence
- image-backed records
- sparse-identifier records
- long hazard or action text

## Noise Report

The generated noise report checks:

- generic vs proposed token estimates
- repeated strings
- overly long fields
- fallback/generated strings
- raw HTML leakage
- possible boilerplate
- missing product evidence
- missing hazard or defect evidence
- missing action evidence
- identifier over-extraction
- action/contact text dominating input

## Non-Goals

This preview does not:

- call Gemini or OpenAI
- run LLM classification
- fill Taxonomy V2 values
- modify `data/raw`
- modify `data/processed`
- fetch, normalize, merge, or backfill source data
- change UI routes, filters, or pages
