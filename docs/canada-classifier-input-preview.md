# Canada Recalls Classifier Input Preview

This preview inspects what `CA_RECALLS` records would send into the LLM before any Gemini classification.

## Purpose

Canada records now include official detail-page extraction such as summary fields, brand names, affected product rows, part numbers, UPCs, and images. The preview compares:

1. the current generic classifier input
2. a Canada-specific input built from the parsed official source fields

This phase does not:

- call Gemini or OpenAI
- classify records
- write canonical taxonomy fields
- change `data/processed/recalls.json`
- fetch, normalize, merge, or backfill source data
- change public UI routes or categories

## Parser Boundary

The Canada parser should not decide product family, product type, hazard type, audience, or public UI category.

Parser-owned fields are official source evidence only:

- official source URL
- official recall type
- official category
- official recall class
- title
- last updated date
- brand names from the page
- summary product
- summary issue
- summary action
- affected product table rows
- part numbers
- UPCs
- image metadata

Product family, product type, hazard type, audience, and final normalized taxonomy are LLM-owned fields.

## Proposed Canada Input Fields

- `id`
- `source`
- `sourceUrl`
- `recallDate`
- `title`
- `sourceRecallType`
- `sourceCategory`
- `sourceRecallClass`
- `productNames`
- `brandNames`
- `summaryProduct`
- `issueText`
- `actionText`
- `affectedProductsHeader`
- `affectedProducts`
- `recallNumber`
- `identifiers`
- `sourceHints.source = CA_RECALLS`
- `sourceHints.market = Canada`
- `sourceHints.officialSource = Government of Canada recalls and safety alerts`
- `sourceHints.classificationOwner = llm`

## Excluded Fields

The proposed Canada input excludes:

- full raw objects
- raw HTML
- image URLs and captions
- navigation, footer, search, or social text
- long contact blocks
- generated fallback strings such as `Review the official Government of Canada notice for current instructions.`
- repeated duplicate strings
- final taxonomy fields such as `productFamily`, `productType`, `hazardType`, and `audience`

## How To Run

```powershell
npm run preview:canada-classifier-input
```

Default sample size is 20. To change it:

```powershell
$env:CANADA_CLASSIFIER_INPUT_PREVIEW_LIMIT = "30"
npm run preview:canada-classifier-input
Remove-Item Env:CANADA_CLASSIFIER_INPUT_PREVIEW_LIMIT
```

Run the static audit:

```powershell
npm run audit:canada-classifier-input-preview
```

## Output Files

Generated preview outputs are ignored and must not be committed:

- `outputs/llm-classifier/input-preview/canada/canada-input-preview.json`
- `outputs/llm-classifier/input-preview/canada/canada-input-preview.md`
- `outputs/llm-classifier/input-preview/canada/canada-noise-report.json`
- `outputs/llm-classifier/input-preview/canada/canada-token-comparison.json`

Do not commit these files.

## Review Checklist

- Confirm IPEX affected product rows include product, part number, and UPC evidence.
- Confirm Canada source categories are treated as source evidence only.
- Confirm health/medical records are not pre-classified by parser logic.
- Confirm records with sparse and dense identifiers are visible.
- Confirm generated preview output excludes raw payloads, image URLs, raw HTML, and fallback strings.
- Confirm no canonical data or runtime UI behavior changed.
