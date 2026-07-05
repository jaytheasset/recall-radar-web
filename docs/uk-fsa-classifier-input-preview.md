# UK FSA Classifier Input Preview

This preview checks what `UK_FSA` records would send into the future Taxonomy V2 LLM classifier.

It is a preview and audit step only. It does not call Gemini or OpenAI, does not classify records, and does not write canonical data.

## Commands

```powershell
npm run preview:uk-fsa-classifier-input
npm run audit:uk-fsa-classifier-input-preview
```

Optional sample limit:

```powershell
$env:UK_FSA_CLASSIFIER_INPUT_PREVIEW_LIMIT = "20"
npm run preview:uk-fsa-classifier-input
Remove-Item Env:UK_FSA_CLASSIFIER_INPUT_PREVIEW_LIMIT
```

## Output

The preview writes ignored local files under:

`outputs/llm-classifier/input-preview/uk-fsa/`

Generated files:

- `uk-fsa-input-preview.json`
- `uk-fsa-input-preview.md`
- `uk-fsa-noise-report.json`
- `uk-fsa-token-comparison.json`

Do not commit generated preview outputs.

## Proposed Input Shape

The source-specific UK FSA input keeps official source evidence only:

- `id`
- `source`
- `sourceUrl`
- `recallDate`
- `title`
- `sourceAlertType`
- `sourceStatus`
- `alertNotation`
- `productNames`
- `brandNames`
- `shortTitle`
- `descriptionText`
- `problemText`
- `allergenRiskLabels`
- `pathogenRiskLabels`
- `hazardCategoryLabels`
- `actionText`
- `productDetails`
- `relatedMediaTitles`
- `recallNumber`
- `identifiers`
- `sourceHints`

`sourceAlertType` is the official FSA alert type, such as `Allergy Alert`, `Product Recall Information Notice`, or `Food Alert For Action`. It is evidence only.

`productDetails` preserves official product names, pack sizes, batch codes, best-before dates, and use-by dates when available.

## Exclusions

The preview excludes:

- full raw objects
- image URLs
- media URLs
- social/SMS text
- raw HTML
- long contact or boilerplate text
- fallback strings
- final Taxonomy V2 fields

Product family, product type, hazard type, audience, and other final taxonomy values remain LLM-owned.

## Sampling

The default sample selects up to 20 records and tries to include:

- Allergy Alert records
- Product Recall Information Notice records
- Food Alert For Action records
- allergen or undeclared ingredient cases
- pathogen contamination cases
- foreign matter cases
- batch, best-before, or use-by evidence
- product detail rows
- related media notice titles
- sparse identifier cases
- long risk or action text cases

## Noise Report

The generated noise report checks:

- generic vs proposed token estimates
- repeated strings
- overly long fields
- fallback/generated strings
- raw HTML leakage
- possible social/contact boilerplate
- missing product evidence
- missing problem/risk evidence
- missing action evidence
- identifier over-extraction

## Non-Goals

This preview does not:

- call Gemini or OpenAI
- run LLM classification
- fill Taxonomy V2 values
- modify `data/raw`
- modify `data/processed`
- fetch, normalize, merge, or backfill source data
- change UI routes, filters, or pages
