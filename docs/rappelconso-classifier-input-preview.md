# RappelConso Classifier Input Preview

This preview inspects what `FR_RAPPELCONSO` records would send into the LLM before any Gemini classification.

## Purpose

RappelConso records already contain official French source fields such as product category, product subcategory, brand, model/reference text, identification values, risk text, consumer instructions, distribution, and recall dates. The preview compares:

1. the current generic classifier input
2. a RappelConso-specific input built from the parsed official source fields

This phase does not:

- call Gemini or OpenAI
- classify records
- write canonical taxonomy fields
- change `data/processed/recalls.json`
- fetch, normalize, merge, or backfill source data
- change public UI routes or categories

## Parser Boundary

The RappelConso parser should not decide product family, product type, hazard type, audience, or public UI category.

Parser-owned fields are official source evidence only:

- official source URL
- official French source category
- official French source subcategory
- official recall nature
- title
- recall date
- brand names
- product label
- model/reference text
- product identification values such as GTIN, lot, date marking, or reference values
- packaging text
- risk and reason text
- consumer action and compensation text
- distribution and sale-period evidence

Product family, product type, hazard type, audience, and final normalized taxonomy are LLM-owned fields.

## Proposed RappelConso Input Fields

- `id`
- `source`
- `sourceUrl`
- `recallDate`
- `title`
- `sourceLanguage`
- `sourceCategory`
- `sourceSubcategory`
- `sourceRecallNature`
- `productNames`
- `brandNames`
- `modelReferenceText`
- `productIdentificationText`
- `packagingText`
- `riskText`
- `reasonText`
- `actionText`
- `compensationText`
- `distributionText`
- `commercializationDates`
- `recallNumber`
- `identifiers`
- `sourceHints.source = FR_RAPPELCONSO`
- `sourceHints.market = France`
- `sourceHints.sourceLanguage = fr`
- `sourceHints.officialSource = RappelConso`
- `sourceHints.classificationOwner = llm`

## Excluded Fields

The proposed RappelConso input excludes:

- full raw objects
- raw HTML
- image URLs and captions
- PDF URLs
- navigation, footer, search, or social text
- long contact blocks
- generated fallback strings such as `Reason not listed.`
- repeated duplicate strings
- final taxonomy fields such as `productFamily`, `productType`, `hazardType`, and `audience`

## How To Run

```powershell
npm run preview:rappelconso-classifier-input
```

Default sample size is 20. To change it:

```powershell
$env:RAPPELCONSO_CLASSIFIER_INPUT_PREVIEW_LIMIT = "30"
npm run preview:rappelconso-classifier-input
Remove-Item Env:RAPPELCONSO_CLASSIFIER_INPUT_PREVIEW_LIMIT
```

Run the static audit:

```powershell
npm run audit:rappelconso-classifier-input-preview
```

## Output Files

Generated preview outputs are ignored and must not be committed:

- `outputs/llm-classifier/input-preview/rappelconso/rappelconso-input-preview.json`
- `outputs/llm-classifier/input-preview/rappelconso/rappelconso-input-preview.md`
- `outputs/llm-classifier/input-preview/rappelconso/rappelconso-noise-report.json`
- `outputs/llm-classifier/input-preview/rappelconso/rappelconso-token-comparison.json`

Do not commit these files.

## Review Checklist

- Confirm official French source category and subcategory are treated as source evidence only.
- Confirm food, vehicle-like, baby/kids, and electronics examples are visible when present.
- Confirm GTIN, lot, date marking, model/reference, and recall id evidence is passed without over-extracting distributor prose.
- Confirm generated preview output excludes raw payloads, image URLs, PDF URLs, raw HTML, and fallback strings.
- Confirm no canonical data or runtime UI behavior changed.
