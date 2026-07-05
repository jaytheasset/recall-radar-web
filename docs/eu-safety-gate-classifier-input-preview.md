# EU Safety Gate Classifier Input Preview

This preview checks what `EU_SAFETY_GATE` records would send into the future Taxonomy V2 LLM classifier.

It is a preview and audit step only. It does not call Gemini or OpenAI, does not classify records, and does not write canonical data.

## Commands

```powershell
npm run preview:eu-safety-gate-classifier-input
npm run audit:eu-safety-gate-classifier-input-preview
```

Optional sample limit:

```powershell
$env:EU_SAFETY_GATE_CLASSIFIER_INPUT_PREVIEW_LIMIT = "20"
npm run preview:eu-safety-gate-classifier-input
Remove-Item Env:EU_SAFETY_GATE_CLASSIFIER_INPUT_PREVIEW_LIMIT
```

## Output

The preview writes ignored local files under:

`outputs/llm-classifier/input-preview/eu-safety-gate/`

Generated files:

- `eu-safety-gate-input-preview.json`
- `eu-safety-gate-input-preview.md`
- `eu-safety-gate-noise-report.json`
- `eu-safety-gate-token-comparison.json`

Do not commit generated preview outputs.

## Proposed Input Shape

The source-specific EU Safety Gate input keeps official source evidence only:

- `id`
- `source`
- `sourceUrl`
- `recallDate`
- `title`
- `sourceProductCategory`
- `notificationType`
- `notifyingCountry`
- `countryOfOrigin`
- `countriesConcerned`
- `soldOnline`
- `productNames`
- `brandNames`
- `nameSpecific`
- `productDescription`
- `packageDescription`
- `riskTypes`
- `riskDescription`
- `legalProvision`
- `measures`
- `recallNumber`
- `identifiers`
- `sourceHints`

`sourceProductCategory` and `riskTypes` are official Safety Gate evidence only. They are not public category assignments.

`identifiers` preserves official barcodes, model/type values, batch/serial values, online trader identifiers, and Safety Gate references when available.

## Exclusions

The preview excludes:

- full raw objects
- image URLs
- raw HTML
- web report boilerplate
- internal comments
- generated fallback strings
- final Taxonomy V2 fields

Product family, product type, hazard type, audience, and other final taxonomy values remain LLM-owned.

## Sampling

The default sample selects up to 20 records and tries to include:

- toys
- electrical appliances or fire/electric-shock cases
- motor vehicles or machinery
- childcare or child-risk cases
- chemical products or cosmetics
- barcode identifiers
- model/type identifiers
- batch or serial identifiers
- online sale evidence
- country of origin evidence
- image-backed records
- sparse brand records

## Noise Report

The generated noise report checks:

- generic vs proposed token estimates
- repeated strings
- overly long fields
- fallback/generated strings
- raw HTML leakage
- possible web report boilerplate
- missing product evidence
- missing risk evidence
- missing measure evidence
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
