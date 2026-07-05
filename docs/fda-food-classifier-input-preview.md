# FDA Food Classifier Input Preview

This preview inspects what `FDA` / openFDA food enforcement records would send into the LLM before any Gemini classification.

## Purpose

FDA food records come from the structured openFDA food enforcement API. The source already provides fields such as product description, recall reason, code information, product quantity, classification, status, distribution, recall number, and event id. The preview compares:

1. the current generic classifier input
2. an FDA-specific input built from the parsed official API fields

This phase does not:

- call Gemini or OpenAI
- classify records
- write canonical taxonomy fields
- change `data/processed/recalls.json`
- fetch, normalize, merge, or backfill source data
- change public UI routes or categories

## Parser Boundary

The FDA parser should not decide product family, product type, hazard type, audience, or public UI category.

Parser-owned fields are official source evidence only:

- official source URL
- official openFDA product type
- FDA classification
- FDA enforcement status
- voluntary or mandated recall type
- initial firm notification method
- product description
- recalling firm
- reason for recall
- code information
- product quantity
- distribution pattern
- recall number
- event id
- report and classification dates
- firm city/state/country

Product family, product type, hazard type, audience, and final normalized taxonomy are LLM-owned fields.

## Proposed FDA Food Input Fields

- `id`
- `source`
- `sourceUrl`
- `recallDate`
- `title`
- `sourceProductType`
- `sourceClassification`
- `sourceStatus`
- `voluntaryMandated`
- `initialFirmNotification`
- `productNames`
- `brandNames`
- `productDescription`
- `reasonText`
- `codeInfo`
- `productQuantity`
- `distributionText`
- `recallNumber`
- `eventId`
- `reportDate`
- `centerClassificationDate`
- `terminationDate`
- `firmLocation`
- `identifiers`
- `sourceHints.source = FDA`
- `sourceHints.market = United States`
- `sourceHints.officialSource = FDA / openFDA food enforcement`
- `sourceHints.sourceApi = openFDA food enforcement`
- `sourceHints.domainHint = food`
- `sourceHints.classificationOwner = llm`

## Excluded Fields

The proposed FDA food input excludes:

- full raw objects
- raw HTML
- street addresses and postal codes
- image URLs and captions
- generated fallback strings such as `FDA food recall`
- repeated duplicate strings
- final taxonomy fields such as `productFamily`, `productType`, `hazardType`, and `audience`

## How To Run

```powershell
npm run preview:fda-food-classifier-input
```

Default sample size is 20. To change it:

```powershell
$env:FDA_FOOD_CLASSIFIER_INPUT_PREVIEW_LIMIT = "30"
npm run preview:fda-food-classifier-input
Remove-Item Env:FDA_FOOD_CLASSIFIER_INPUT_PREVIEW_LIMIT
```

Run the static audit:

```powershell
npm run audit:fda-food-classifier-input-preview
```

## Output Files

Generated preview outputs are ignored and must not be committed:

- `outputs/llm-classifier/input-preview/fda-food/fda-food-input-preview.json`
- `outputs/llm-classifier/input-preview/fda-food/fda-food-input-preview.md`
- `outputs/llm-classifier/input-preview/fda-food/fda-food-noise-report.json`
- `outputs/llm-classifier/input-preview/fda-food/fda-food-token-comparison.json`

Do not commit these files.

## Review Checklist

- Confirm allergen, pathogen, foreign matter, labeling/storage, and FDA class examples are visible when present.
- Confirm FDA classification and status are treated as source evidence only.
- Confirm UPC, lot, batch, date marking, ASIN, SKU, and FNSKU values are visible as identifiers.
- Confirm generated preview output excludes raw payloads, street addresses, image URLs, raw HTML, and fallback strings.
- Confirm no canonical data or runtime UI behavior changed.
