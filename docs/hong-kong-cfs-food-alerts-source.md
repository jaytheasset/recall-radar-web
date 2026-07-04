# Hong Kong CFS Food Alerts source

Phase 38 adds a bounded Hong Kong Centre for Food Safety food/allergy source spike:

- Source id: `HK_CFS`
- Visible label: `Hong Kong - Centre for Food Safety`
- Current bounded count: 100 records
- Canonical total after Phase 39: 1201 records

This is not a full Hong Kong historical backfill and does not imply complete Hong Kong recall coverage.

## Official Access

`npm run debug:hong-kong-cfs-access` verifies that the official Centre for Food Safety listing page, English food-alert XML dataset, annual archive pages, and detail pages are reachable without an API key.

The current source uses:

- Listing/archive root: `https://www.cfs.gov.hk/english/whatsnew/whatsnew_fa/whatsnew_fa.html`
- English XML dataset: `https://www.cfs.gov.hk/filemanager/foodalert/english/foodalert_datagovhk.xml`
- Detail pages under `https://www.cfs.gov.hk/english/whatsnew/whatsnew_fa/`

Traditional Chinese and alternate RSS/JSON candidates checked during access discovery did not expose the selected English bounded source payload for this phase.

## Commands

Fetch the bounded latest 100 Hong Kong CFS food/allergy alerts:

```powershell
npm run fetch:hong-kong-cfs
```

Rebuild processed Hong Kong CFS data from the saved raw file:

```powershell
npm run normalize:hong-kong-cfs
```

Audit the current Hong Kong CFS source without making network calls:

```powershell
npm run audit:hong-kong-cfs
```

Run the explicit refresh workflow:

```powershell
npm run update:hong-kong-cfs
```

## Normalization

The normalizer maps official CFS records into the shared `NormalizedRecall` contract:

- `source: HK_CFS`
- official CFS `sourceUrl`
- stable source-prefixed id such as `hk-cfs-2026-619`
- title, product names, brand/company names where available
- `category: food-allergy`
- reason/hazard and action/remedy fields from official detail rows
- recall date from the official issue date, metadata, XML date, or detail page date
- official CFS image URLs when available
- raw XML, archive, and detail fields preserved for source-specific detail extraction

The normalizer preserves official English source text. It does not translate, summarize with an LLM, or rewrite official notice text as verified facts beyond field normalization.

## Image Behavior

Hong Kong CFS images are URL references only. The pipeline does not download, proxy, cache, or copy images.

The audit allows image URLs only from:

- `https://www.cfs.gov.hk/...`

Some notices do not expose a usable product image. Those records remain image-sparse and rely on the existing site image fallback behavior.

## Known Missing Fields

Hong Kong CFS detail pages do not expose every field consistently. The audit warns, rather than fails, when batch, pack, or date identifiers are sparse because the official notices vary by alert.

Known limitations:

- Some records have no brand/company field.
- Some records have no official image.
- Identifier fields are often embedded in free-text product or action details.
- The current spike is limited to 100 records.
- Full archive backfill is deferred.

## QA Expectations

Before committing a Hong Kong CFS refresh, verify:

- `npm run debug:hong-kong-cfs-access`
- `npm run audit:hong-kong-cfs`
- `npm run audit:sources`
- `npm run check`
- `npm run build`
- `npm run validate:launch`

Block or investigate if:

- `HK_CFS` count is not exactly 100 for the current bounded spike.
- Canonical total is not 1201.
- Source URLs are not official CFS detail URLs.
- Image URLs are off-host.
- Raw HTML leaks into visible normalized fields.
- Source filter values change unexpectedly.
- Duplicate ids, slug collisions, or duplicate source URLs appear.

## Deferred

- Full Hong Kong CFS historical backfill.
- Hong Kong EMSD electrical recall source.
- Hong Kong Customs consumer goods safety source.
- Traditional Chinese UI or record translation.
- Image download, proxy, CDN, or backend storage.
