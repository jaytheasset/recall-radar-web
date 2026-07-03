# FDA food single-record diagnostic

## Tested record

- Recall number: `H-0950-2026`
- API URL: `https://api.fda.gov/food/enforcement.json?search=recall_number%3A%22H-0950-2026%22&limit=1`

## Current pipeline behavior

- `scripts/fetch-fda-food.ts` fetches the latest FDA food enforcement records with `sort=report_date:desc` and a limit of up to 100.
- The default fetch script does not select a specific `recall_number`.
- `extractFdaFoodRecords()` supports `payload.results`, `payload.records`, and direct array payloads.
- `normalizeFdaFoodRecords()` keeps records when generated `title`, generated `id`, and normalized `recallDate` are present.

## Diagnostic result

The single-record URL for `H-0950-2026` returns HTTP 200 with one `results` item. The current extractor returns one raw record, and the current normalizer produces one FDA recall record:

- `id`: `fda-H-0950-2026`
- `recallDate`: `2026-06-09`
- `category`: `food`
- `status`: `Ongoing`

The record is also already present in the current FDA raw and processed 100-record files.

## Root cause

No parser failure was reproduced for `H-0950-2026`. The openFDA response shape, URL encoding, selected fields, extraction, date normalization, title/id generation, category mapping, and final required-field filter all pass.

The confirmed gap was diagnostic support: the project did not have a focused single-record FDA diagnostic command that could prove where a `recall_number` fails or succeeds without mutating canonical data.

## Fix

Added a side-effect-free FDA record diagnostic helper and a debug script:

- `diagnoseFdaFoodRecord(raw)`
- `npm run debug:fda-food-single -- --recall-number=H-0950-2026`

No canonical FDA data was regenerated or changed.

## Deferred

- No FDA image scraping.
- No backend or runtime API.
- No FDA source selection change.
- No new FDA records.
