# Korea SafetyKorea API Contract Prep

Phase 36 prepares the SafetyKorea API contract for a future `KR_SAFETYKOREA` source activation. It does not add Korea as active Recall Radar coverage.

## Status

- Live source active: no
- Korea records added: no
- Canonical total after Phase 36: 901
- Current canonical total after Phase 37: 1001
- Source filters changed: no
- Prepared helper: `scripts/korea-safetykorea-api-contract.ts`
- Fixture audit: `npm run audit:korea-safetykorea-contract`
- Debug command: `npm run debug:korea-safetykorea-access`

## Official Document Reviewed

The SafetyKorea Open API interface document was reviewed after Phase 35. The contract describes:

- KC certification information
- Domestic recall information
- Overseas recall information

This phase prepares only the domestic recall contract. MFDS food recall and Korea vehicle recall sources remain separate future candidates.

## Authentication

SafetyKorea separately issues a service ID.

Requests must include this HTTP header:

```text
AuthKey: <issued service ID>
```

Implementation notes:

- Environment variable: `SAFETYKOREA_API_KEY`
- Header name: `AuthKey`
- The service ID is not a query parameter.
- The header key name is case-sensitive.
- Do not commit service IDs or other secrets.
- Debug output masks the key when present.

## Domestic Recall List Endpoint

```text
GET http://www.safetykorea.kr/openapi/api/recall/recallList.json?conditionKey={conditionKey}&conditionValue={conditionValue}
```

Prepared builder:

```ts
buildDomesticRecallListUrl({ conditionKey: 'all', conditionValue: '' })
```

Supported documented `conditionKey` values:

- `all`
- `barcodeNum`
- `recallProductName`
- `recallBrandName`
- `recallModelName`
- `certNum`
- `publishDate`

The documented list API returns up to 1,000 rows per query.

## Domestic Recall Detail Endpoint

```text
GET http://www.safetykorea.kr/openapi/api/recall/recallDetail.json?recallUid={recallUid}
```

Prepared builder:

```ts
buildDomesticRecallDetailUrl('SKR-SAMPLE-0001')
```

## Important Response Fields

The fixture and draft mapper are prepared for these documented fields:

- `recallUid`
- `recallProductName`
- `recallBrandName`
- `recallModelName`
- `recallModelCnt`
- `recallTypeName`
- `recallMeans`
- `barcodeNum`
- `categoryName`
- `certNum`
- `productItemName`
- `recallCmpnyDivName`
- `recallInqryTel`
- `recallCmpnyName`
- `recallFrgnCmpnyName`
- `makerCntryName`
- `makerName`
- `makingCntryName`
- `publishDate`
- `publishRecallVol`
- `recallActionAmt`
- `recallStaDate`
- `recallEndDate`
- `harmDscr`
- `accidentCaseDscr`
- `publishActionDscr`
- `recallFiles`

## Image Behavior

SafetyKorea detail responses may include `recallFiles[]` with:

- `fileDiv`
- `imageUrl`

The draft helper:

- extracts official SafetyKorea image URLs from `recallFiles[].imageUrl`
- accepts `www.safetykorea.kr`, `safetykorea.kr`, and `office.safetykorea.kr`
- filters likely logos, icons, banners, headers, footers, social, tracking, or placeholder images
- keeps `fileDiv` as a caption only when it is meaningful
- suppresses filename-only captions
- does not download, proxy, cache, or transform images

## Draft Mapping

`mapSafetyKoreaDomesticRecallDraft(raw)` returns a future-ready draft object, not a live `NormalizedRecall`.

Draft fields include:

- stable id: `kr-safetykorea-<recallUid>`
- draft source marker: `KR_SAFETYKOREA`
- official detail API URL
- Korean title, product names, and brand/company names
- conservative category
- hazard/reason text
- remedy/action text
- normalized `YYYY-MM-DD` recall date
- affected quantity where available
- identifiers
- official images
- raw payload

The helper intentionally does not import `RecallSource` or add `KR_SAFETYKOREA` to active source types.

## Category Mapping

Draft mapping is conservative:

- children, infant, toy terms: `baby-kids`
- electric/electronic, battery, charger terms: `battery-electronics`
- household goods, furniture, kitchen, chemical goods: `household-appliance`
- unknown or broad categories: `general-consumer-product`
- food-like terms stay `general-consumer-product` with a warning note because Korea MFDS food recall data should be a separate future source

## Korean Text Preservation

Fixtures and contract audit verify that Korean text stays UTF-8 and visible draft fields do not contain raw HTML or mojibake-like text. Do not translate, romanize, or summarize SafetyKorea source records in the activation phase unless a later explicit translation phase approves it.

## Fixture-Based Prep

Fixture file:

```text
data/samples/korea-safetykorea-domestic-recall-samples.json
```

It contains:

- domestic recall list sample with two records
- domestic recall detail sample with `recallFiles[]` images
- minimal auth error sample

The fixture is based on the official document field structure. It is not live fetched data and contains no service key.

## Why Live Source Is Not Active Yet

Phase 35 confirmed that live source activation should wait for official access. Phase 36 prepares the contract after the interface document review, but still does not activate Korea because a SafetyKorea service ID/AuthKey has not been issued in the local environment.

## Steps After Service ID Is Issued

1. Set the key locally only:

```powershell
$env:SAFETYKOREA_API_KEY = "<issued service ID>"
```

1. Run the safe debug probe:

```powershell
npm run debug:korea-safetykorea-access
```

1. Confirm the output reports:

- `hasAuthKey: true`
- `authHeaderName: AuthKey`
- `requestMode: live-with-auth`
- live probe HTTP success
- parseable JSON
- result code/message and sample keys

1. Start a separate future Korea live activation phase. That future phase should add bounded fetch, normalize, audit, source registry, merge, source landing page, docs, and validation.

## Future Activation Outline

A future live activation phase should:

- add `KR_SAFETYKOREA` to source types and source registry
- add bounded `fetch:korea-safetykorea`
- add `normalize:korea-safetykorea`
- add `audit:korea-safetykorea`
- write `data/raw/korea-safetykorea-recalls.json`
- write `data/processed/korea-safetykorea-recalls.json`
- merge canonical data only after audit passes
- keep initial count at 100 records
- add `/korea-product-recalls`
- update source filters and route audits
- preserve Korean text
- avoid translation, backend, proxy, image downloads, and broad backfill

## Deferred Korea Sources

Keep these separate:

- Korea MFDS food recalls
- Korea vehicle recalls
- Korea medical, drug, or device recalls if product scope expands
