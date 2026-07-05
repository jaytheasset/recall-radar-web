# Hong Kong CFS Classifier Input Preview

Phase 44E-4 adds a local Hong Kong Centre for Food Safety-only classifier input preview before any Gemini classification.

## Purpose

The preview shows what the current generic classifier input builder would send for `HK_CFS` records, then compares it with a proposed Hong Kong CFS-specific food alert input view. This catches prompt noise before a live LLM run.

This phase does not:

- call Gemini or OpenAI
- classify records
- write canonical taxonomy fields
- change `data/processed/recalls.json`
- fetch, normalize, merge, or backfill source data
- change public UI routes or categories

## Why Hong Kong CFS Needs Its Own Input Shape

Hong Kong CFS food alerts expose structured table rows for product description, source of information, reason for issuing alert, consumer or trade advice, origin, importer, retailer, pack size, batch, date, and barcode/JAN-like identifiers. A generic input can carry too much government footer, hotline, press release, and follow-up boilerplate, while a source-specific input can keep the food safety evidence that helps classification:

- product identity
- brand, importer, and retailer where useful
- official reason/risk text
- consumer/trade action text
- pack, batch, date, barcode, JAN, GTIN, UPC, and source id identifiers
- food-domain source hints

## Proposed Hong Kong CFS Input Fields

- `id`
- `source`
- `sourceUrl`
- `recallDate`
- `title`
- `productNames`
- `brandNames`
- `sourceCategory`
- `productDescription`
- `riskText`
- `hazardText`
- `actionText`
- `foodAlertType`
- `origin`
- `importer`
- `retailer`
- `packSize`
- `batch`
- `expiry`
- `bestBefore`
- `useBy`
- `recallNumber`
- `identifiers`
- `sourceHints.source = HK_CFS`
- `sourceHints.market = Hong Kong`
- `sourceHints.officialSource = Centre for Food Safety`
- `sourceHints.sourceApi = Hong Kong CFS food alerts XML/detail pages`
- `sourceHints.domainHint = food`
- `sourceHints.expectedProductFamilyHint = food-grocery`
- `sourceHints.classificationOwner = llm`

## Excluded Fields

The proposed Hong Kong CFS input excludes:

- full raw objects
- raw HTML
- image URLs and captions
- navigation, footer, social, or tracking text
- government boilerplate
- hotline/contact blocks unless they identify importer or retailer
- generated fallback strings such as `Review the official Centre for Food Safety notice for current instructions.`
- repeated duplicate strings
- long unrelated distribution or investigation prose

## How To Run

```powershell
npm run preview:hong-kong-cfs-classifier-input
```

Default sample size is 20. To change it:

```powershell
$env:HONG_KONG_CFS_CLASSIFIER_INPUT_PREVIEW_LIMIT = "30"
npm run preview:hong-kong-cfs-classifier-input
Remove-Item Env:HONG_KONG_CFS_CLASSIFIER_INPUT_PREVIEW_LIMIT
```

Run the static audit:

```powershell
npm run audit:hong-kong-cfs-classifier-input-preview
```

## Output Files

Generated preview outputs are ignored and must not be committed:

- `outputs/llm-classifier/input-preview/hong-kong-cfs/hong-kong-cfs-input-preview.json`
- `outputs/llm-classifier/input-preview/hong-kong-cfs/hong-kong-cfs-input-preview.md`
- `outputs/llm-classifier/input-preview/hong-kong-cfs/hong-kong-cfs-noise-report.json`
- `outputs/llm-classifier/input-preview/hong-kong-cfs/hong-kong-cfs-token-comparison.json`

Do not commit these files.

## Review Checklist

- Confirm allergen and undeclared allergen records keep allergen evidence.
- Confirm contamination, toxin, pathogen, and foreign matter records keep risk evidence.
- Confirm date, batch, pack, barcode, JAN, importer, and retailer values are visible when present.
- Confirm sparse and dense identifier records are included.
- Confirm government footer, hotline, press release, and navigation text do not dominate the proposed input.
- Confirm generated preview output excludes raw payloads, image URLs, raw HTML, and fallback strings.
- Confirm no canonical data or runtime UI behavior changed.
