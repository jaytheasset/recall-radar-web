# Korea SafetyKorea Source Discovery

Phase 35 checked whether Recall Radar can safely add a bounded `KR_SAFETYKOREA` source spike from official Korea SafetyKorea data. The live source was not added in this phase.

Phase 36 reviewed the SafetyKorea Open API interface document and prepared the API contract helper, fixture mapping, and non-network contract audit. Live activation still awaits an issued SafetyKorea service ID/AuthKey.

## Summary

- Proposed source id: `KR_SAFETYKOREA`
- Proposed visible label: `South Korea - Safety Korea`
- Proposed route if later activated: `/korea-product-recalls`
- Records added in Phase 35: no
- Canonical total after Phase 35: 901
- Active source filters changed: no

## Official Sources Reviewed

The diagnostic checked only official Korea SafetyKorea or Korea public-data endpoints:

- SafetyKorea Open API page: `https://www.safetykorea.kr/release/openapi`
- SafetyKorea recall board: `https://www.safetykorea.kr/recall/recallBoard`
- data.go.kr open API metadata: `https://www.data.go.kr/data/15116894/openapi.do`
- data.go.kr schema.org metadata: `https://www.data.go.kr/catalog/15116894/openapi.json`
- data.go.kr DCAT metadata: `https://www.data.go.kr/dcat/metadata/15116894`

The data.go.kr metadata describes the official National Agency for Technology and Standards product safety certification and recall information source. It includes safety certification, domestic recall, and overseas recall information, with fields such as product name, model name, certification number, certification agency, manufacturer/importer, recall reason, action details, and publication date.

## Access Finding

`npm run debug:korea-safetykorea-access` concluded that live ingestion is not currently feasible without additional official access details:

- The data.go.kr detail page is reachable, but it indicates an application/login/service-key flow.
- The structured data.go.kr schema.org and DCAT responses are metadata only, not recall-record payload endpoints.
- The SafetyKorea Open API and recall-board pages did not provide a stable, confirmed machine-readable recall payload during this phase.
- No callable JSON, XML, RSS, CSV, or stable feed endpoint returning recall records was confirmed without credentials.

## Diagnostic Command

```powershell
npm run debug:korea-safetykorea-access
```

The command is non-mutating. It does not write raw Korea records, does not normalize records, does not merge canonical data, and does not add source filters. After Phase 36, it uses the prepared API contract and fixture mapping. If `SAFETYKOREA_API_KEY` is missing, it exits successfully in missing-auth mode. If the key is present, it sends a single live list probe with the official `AuthKey` header.

It reports:

- candidate name and endpoint
- access type
- HTTP status
- content type
- response size
- JSON/XML/RSS parse signals
- sample keys when structured metadata is available
- pagination and detail URL evidence
- `AuthKey` header name
- masked AuthKey when present
- generated list/detail endpoint examples
- fixture mapping preview
- live probe status only when a key is present
- feasibility

If a future phase receives official credentials or access instructions, use the environment variable name `SAFETYKOREA_API_KEY`. The official document requires the service ID in the case-sensitive HTTP header `AuthKey`, not as a query parameter. Do not commit secrets.

## Phase 36 Contract Prep

Prepared files:

- `scripts/korea-safetykorea-api-contract.ts`
- `scripts/audit-korea-safetykorea-contract.ts`
- `data/samples/korea-safetykorea-domestic-recall-samples.json`
- `docs/korea-safetykorea-api-contract.md`

The helper prepares:

- domestic recall list URL builder
- domestic recall detail URL builder
- `AuthKey` header handling
- date normalization
- text sanitization
- `recallFiles[].imageUrl` extraction
- conservative draft category mapping
- future-ready draft recall mapping without importing active `RecallSource`

Run:

```powershell
npm run audit:korea-safetykorea-contract
```

## Why Live Source Was Not Added

The phase required confirmed official data access before adding a live source. That threshold was not met:

- Official metadata exists, but the directly reachable structured responses are metadata, not recall records.
- The data.go.kr page points to SafetyKorea access and shows an application/service-key style flow.
- The official SafetyKorea page access was not stable enough from this environment to justify a scraper.
- HTML-only access was not accepted as a live source because selectors, pagination, detail pages, and image fields were not validated.

Because of that, Phase 35 intentionally did not add:

- `KR_SAFETYKOREA` to `src/data/recall-types.ts`
- `KR_SAFETYKOREA` to `src/lib/recall-sources.ts`
- Korea fetch, normalize, audit, merge, or landing-page code
- Korea raw or processed data files
- Korea source filters or homepage source cards

## Future Activation Requirements

Before activating `KR_SAFETYKOREA`, a future phase should confirm one of:

- Official SafetyKorea/data.go.kr API endpoint documentation with callable recall-record URLs
- Official service key access and query examples for domestic and overseas recall records
- A stable official JSON, XML, RSS, CSV, or download endpoint
- If no structured endpoint exists, an explicitly approved bounded official HTML ingestion design with validated selectors, pagination, detail URLs, and image handling

The future source spike should remain bounded to 100 records until a separate backfill phase approves expansion.

## Future Normalization Plan

If official access is confirmed later, normalize into the existing `NormalizedRecall` contract:

- `id`: stable `kr-safetykorea-*` source id
- `source`: `KR_SAFETYKOREA`
- `sourceUrl`: official SafetyKorea notice/detail URL
- `title`: official Korean title or product name
- `brandNames`: manufacturer, importer, distributor, or business name where available
- `productNames`: product name and model name where available
- `category`: conservative mapping into existing site categories
- `hazard` / `reason`: official recall reason or risk text
- `remedy`: official action or measure text
- `recallDate`: official publication or recall date
- `affectedUnits`: affected quantity only when provided
- `description`: sanitized official text for search/detail context
- `recallNumber`: official recall, notice, announcement, certification, or case number where available
- `images`: official product image URLs only, if available
- `raw`: preserved official raw payload

## Korean Text Preservation

Future ingestion must preserve Korean source text as UTF-8. Do not translate, romanize, or summarize official records unless a later explicit translation phase is approved. Visible normalized fields must not leak raw HTML, script, style, or entity noise.

## Image and Media Policy

If the official source provides product images:

- Use only official SafetyKorea image URLs.
- Validate image host and URL shape.
- Do not download images into the repo.
- Do not proxy, cache, or route images through a backend/CDN.
- Do not use government logos, UI icons, banners, or social images as product images.

If images are unavailable from the official source, leave image fields empty and rely on existing site fallback behavior.

## Category Mapping Notes

Future Korea category mapping should stay conservative:

- children or infant products: `baby-kids`
- electrical products, batteries, chargers, appliances: `battery-electronics` or `household-appliance`
- household goods and daily-use products: `household-appliance` or `general-consumer-product`
- chemical or hygiene products: `household-appliance` or `general-consumer-product`
- food should not be forced into SafetyKorea; Korea MFDS food recalls are a separate future source

Unknown or broad source categories should remain general rather than overclassified.

## Identifier Candidates

Future ingestion should preserve identifiers only when explicitly present:

- product name
- model name
- manufacturer/importer
- business/operator name
- certification number
- recall number
- announcement number
- barcode
- serial number
- lot number
- manufacture date
- sale period
- hazard/risk content
- action/remedy content

Do not infer identifiers from generic descriptive text.

## Known Limitations

- No live Korea records were added.
- No official recall-record API endpoint was confirmed without credentials.
- SafetyKorea page access was not stable enough for an HTML scraper in this phase.
- No Korea images were validated.
- No Korea source landing page or checker filter exists.

## Related Future Korea Sources

Keep these as separate future candidates:

- MFDS food recall and sales-suspension data
- Korea vehicle recall source
- Medical, drug, or device recall sources if later product scope expands
