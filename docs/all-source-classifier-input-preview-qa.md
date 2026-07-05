# All Source Classifier Input Preview QA

This QA pass verifies that every active Recall Radar source has a source-specific classifier input preview before live Gemini classification.

Run all previews:

```powershell
npm run preview:all-classifier-inputs
```

Run the combined audit:

```powershell
npm run audit:all-classifier-input-previews
```

The combined audit checks:

- all ten active source previews exist
- all ten individual preview audits pass
- each proposed input keeps `genericInput`, `proposedInput`, `tokenComparison`, and `noise`
- each proposed input uses `sourceHints.classificationOwner = "llm"`
- parser previews do not fill final Taxonomy V2 fields such as `productFamily`, `productType`, `hazardType`, or `audience`
- preview scripts do not call Gemini/OpenAI, fetch sources, normalize, merge, backfill, or write canonical data
- generated preview outputs under `outputs/llm-classifier/input-preview/` remain uncommitted
- canonical counts remain unchanged at 1201 total records

This is still a preview/audit phase. It does not classify records and does not write any V2 database or canonical processed data.
