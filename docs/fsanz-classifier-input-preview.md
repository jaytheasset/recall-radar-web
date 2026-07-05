# FSANZ Classifier Input Preview

Phase 44E-2 adds a local FSANZ-only classifier input preview before any Gemini classification.

## Purpose

The preview compares the current generic classifier input builder with a proposed FSANZ-specific input view. FSANZ food recall notices carry source fields that differ from general consumer product recalls, especially:

- problem text
- food safety hazard text
- date marking
- pack size
- batch, lot, code, or barcode evidence when present
- consumer action text
- recalling company and product split

This phase does not:

- call Gemini or OpenAI
- classify records
- write canonical taxonomy fields
- change `data/processed/recalls.json`
- fetch, normalize, merge, or backfill source data
- change public UI routes or categories

## Why FSANZ Needs Its Own Input Shape

The current legacy category may label many FSANZ records as `food-allergy`, but the actual official problem can be allergen, pathogen contamination, chemical contamination, foreign matter, date marking, or another food issue. The proposed input keeps those official fields separate so the future classifier can distinguish non-allergen cases.

## Proposed FSANZ Input Fields

- `id`
- `source`
- `sourceUrl`
- `recallDate`
- `title`
- `productNames`
- `brandNames`
- `sourceCategory`
- `productDescription`
- `problemText`
- `foodSafetyHazardText`
- `actionText`
- `dateMarking`
- `recallNumber`
- `identifiers`
- `sourceHints.source = FSANZ_FOOD_RECALLS`
- `sourceHints.market = Australia / New Zealand`
- `sourceHints.officialSource = Food Standards Australia New Zealand`
- `sourceHints.sourceApi = FSANZ food recall listing/detail pages`
- `sourceHints.domainHint = food`
- `sourceHints.expectedProductFamilyHint = food-grocery`
- `sourceHints.classificationOwner = llm`

## Food Hazard Review Buckets

The preview samples and reports these source-only review buckets:

- allergen
- contamination-pathogen
- contamination-chemical
- foreign-matter
- labeling-date-marking
- unknown

These buckets are audit aids only. They do not migrate canonical taxonomy fields.

## Excluded Fields

The proposed FSANZ input excludes:

- full raw objects
- raw HTML
- image URLs and captions
- contact blocks
- email and phone contact text
- generated fallback strings such as `Review the official FSANZ recall notice`
- repeated duplicate strings
- long availability or distribution prose when it is not needed for classification

## How To Run

```powershell
npm run preview:fsanz-classifier-input
```

Default sample size is 20. To change it:

```powershell
$env:FSANZ_CLASSIFIER_INPUT_PREVIEW_LIMIT = "30"
npm run preview:fsanz-classifier-input
Remove-Item Env:FSANZ_CLASSIFIER_INPUT_PREVIEW_LIMIT
```

Run the static audit:

```powershell
npm run audit:fsanz-classifier-input-preview
```

## Output Files

Generated preview outputs are ignored and must not be committed:

- `outputs/llm-classifier/input-preview/fsanz/fsanz-input-preview.json`
- `outputs/llm-classifier/input-preview/fsanz/fsanz-input-preview.md`
- `outputs/llm-classifier/input-preview/fsanz/fsanz-noise-report.json`
- `outputs/llm-classifier/input-preview/fsanz/fsanz-token-comparison.json`

Do not commit these files.

## Review Checklist

- Confirm allergen records retain allergen evidence.
- Confirm pathogen, chemical contamination, and foreign matter records are not treated as allergen-only cases.
- Confirm non-allergen FSANZ records are visible in the report.
- Confirm date marks, pack sizes, batch or lot codes, and barcodes are captured only when present.
- Confirm generated preview output excludes raw payloads, contact blocks, raw HTML, image URLs, and fallback strings.
- Confirm no canonical data or runtime UI behavior changed.
