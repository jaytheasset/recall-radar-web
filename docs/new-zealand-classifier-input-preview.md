# New Zealand Product Safety Classifier Input Preview

Phase 44E-3 adds a local New Zealand Product Safety-only classifier input preview before any Gemini classification.

## Purpose

The preview shows what the current generic classifier input builder would send for `NZ_PRODUCT_SAFETY` records, then compares it with a proposed New Zealand-specific input view. This catches prompt noise before a live LLM run.

This phase does not:

- call Gemini or OpenAI
- classify records
- write canonical taxonomy fields
- change `data/processed/recalls.json`
- fetch, normalize, merge, or backfill source data
- change public UI routes or categories

## Why New Zealand Needs Its Own Input Shape

Product Safety New Zealand detail pages expose product identifiers, supplier names, responsible agency text, hazards, and action guidance. A generic input can carry too much supplier/contact or sale-window prose, while a source-specific input can keep the evidence that helps classification:

- product identity
- official source categories
- model, SKU, serial, barcode, or product identifier text
- supplier name
- hazard text
- action/remedy text

## Proposed New Zealand Input Fields

- `id`
- `source`
- `sourceUrl`
- `recallDate`
- `title`
- `productNames`
- `brandNames`
- `sourceCategory`
- `sourceCategories`
- `productIdentifiers`
- `supplierName`
- `responsibleAgency`
- `hazardText`
- `actionText`
- `recallNumber`
- `identifiers`
- `sourceHints.source = NZ_PRODUCT_SAFETY`
- `sourceHints.domainHint = consumer-product`

## Excluded Fields

The proposed New Zealand input excludes:

- full raw objects
- raw HTML
- image URLs and captions
- navigation, footer, social, or tracking text
- long contact blocks
- generated fallback strings such as `Review the official Product Safety New Zealand notice for current instructions.`
- repeated duplicate strings
- unrelated agency/contact boilerplate
- long action text when not needed for classification

## How To Run

```powershell
npm run preview:new-zealand-classifier-input
```

Default sample size is 20. To change it:

```powershell
$env:NEW_ZEALAND_CLASSIFIER_INPUT_PREVIEW_LIMIT = "30"
npm run preview:new-zealand-classifier-input
Remove-Item Env:NEW_ZEALAND_CLASSIFIER_INPUT_PREVIEW_LIMIT
```

Run the static audit:

```powershell
npm run audit:new-zealand-classifier-input-preview
```

## Output Files

Generated preview outputs are ignored and must not be committed:

- `outputs/llm-classifier/input-preview/new-zealand/new-zealand-input-preview.json`
- `outputs/llm-classifier/input-preview/new-zealand/new-zealand-input-preview.md`
- `outputs/llm-classifier/input-preview/new-zealand/new-zealand-noise-report.json`
- `outputs/llm-classifier/input-preview/new-zealand/new-zealand-token-comparison.json`

Do not commit these files.

## Review Checklist

- Confirm baby/kids or toy records retain product identity and choking-risk evidence.
- Confirm electronics/battery records retain model, SKU, serial, battery, or charger evidence when present.
- Confirm household/furniture/appliance records are sampled when present.
- Confirm records with sparse and dense identifiers are visible.
- Confirm supplier/contact text does not dominate the proposed input.
- Confirm generated preview output excludes raw payloads, image URLs, raw HTML, and fallback strings.
- Confirm no canonical data or runtime UI behavior changed.
