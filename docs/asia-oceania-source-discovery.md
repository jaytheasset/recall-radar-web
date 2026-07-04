# Asia/Oceania Source Discovery

## A. Purpose

Phase 31 evaluated official Asia and Oceania recall source candidates for future Recall Radar ingestion. This was planning-only work and did not add records, activate source filters, create UI pages, refresh source data, or change the canonical processed data.

Phase 33 later activated the bounded `AU_PRODUCT_SAFETY` source. Phase 37 later activated the bounded `NZ_PRODUCT_SAFETY` source. The remaining notes in this document are source-discovery context for future expansion, not the current active source list.

The current site remains limited to the active indexed sources already in `src/lib/recall-sources.ts`:

- `CPSC`
- `FDA`
- `FR_RAPPELCONSO`
- `CA_RECALLS`
- `EU_SAFETY_GATE`
- `UK_FSA`
- `AU_PRODUCT_SAFETY`
- `NZ_PRODUCT_SAFETY`

## B. Current Coverage Gap

Recall Radar now has bounded active Oceania coverage for Australia Product Safety and New Zealand Product Safety. The current global foundation covers the United States, France, Canada, the European Union, the United Kingdom, Australia, and New Zealand, but there are still no indexed official notices for Japan, South Korea, Singapore, Hong Kong, or Taiwan.

The gap is mostly source-readiness work, not UI work. Before any country is exposed in filters or source pages, Recall Radar needs a source-specific connector, normalized output, source registry entry, audit script, count policy, detail-page field extraction, and a clear statement of coverage limits.

## C. Candidate Source Matrix

| Market | Official source | Agency | Scope | Access type | Backfill support | Image/media support | Identifier quality | Language | Complexity | Recommended priority | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Australia | Product Safety Australia / ACCC recalls (`https://www.productsafety.gov.au/recalls`) | ACCC | Consumer products, child products, electronics, household, tools, non-road-vehicle consumer products | Search pages plus RSS by category and saved search (`https://www.productsafety.gov.au/about-us/product-safety-news/subscribe-to-rss-feeds`) | Likely medium through RSS/search pagination; exact historical completeness needs prototype | Product pages show images | Good: product name, category, hazard/remedy, supplier, dates likely available on details | English | Medium | 1 | Best low-risk next source because it is official, English, consumer-product focused, and RSS-supported. |
| Australia | Australian food recall alerts (`https://www.foodstandards.gov.au/food-recalls/recall-alert`) | Food Standards Australia New Zealand | Australian food recalls | HTML list/search; email subscription; API/RSS unknown | Medium if HTML pagination is stable | Images appear on listing/detail pages | Good for food products, allergens, state, dates; lot/barcode varies by notice | English | Medium | 4 | Useful food source, but overlaps partially with product safety experience and needs access prototype. |
| Australia | Vehicle Recalls (`https://www.vehiclerecalls.gov.au/`) | Department of Infrastructure, Transport, Regional Development, Communications, Sport and the Arts | Road vehicles and approved road vehicle components | HTML search/list; API unknown | Medium if browse pages are stable | Limited or unknown | Strong vehicle make/model/year; VIN-specific checks are not suitable for static ingestion | English | Medium | Defer | Vehicle-specific category and VIN-safe UX are needed before activation. |
| New Zealand | Product Safety New Zealand recalls (`https://www.productsafety.govt.nz/recalls`) | MBIE Product Safety | Consumer products; links out to NZTA and MPI for vehicle/food | Official HTML listing/detail pages with `start` pagination; JSON/RSS candidates were not usable in Phase 37 | Partial bounded source is active for the latest 100 notices | Images/details appear on pages | Good product/category/date; model/batch varies | English | Medium-high | Active bounded spike | Active as `NZ_PRODUCT_SAFETY`; full backfill remains deferred. |
| New Zealand | MPI recalled food products (`https://www.mpi.govt.nz/food-safety-home/food-recalls-and-complaints/recalled-food-products`) | Ministry for Primary Industries | Food recalls | HTML list; email subscription; API/RSS unknown | Medium; HTML/date paging needs prototype | Unknown | Good food product and allergen/lot fields where present | English | Medium | 5 | Good food source after product source path is proven. |
| New Zealand | NZTA vehicle safety recalls (`https://www.vehiclerecallsafety.nzta.govt.nz/`) | NZ Transport Agency Waka Kotahi | Vehicle safety recalls | HTML list; API unknown | Limited; site emphasizes current recalls | Unknown | Vehicle make/model high, consumer-product fit low | English | Medium | Defer | Vehicle UX/category work should come first. |
| Japan | Consumer Affairs Agency Recall Information Site (`https://www.recall.caa.go.jp/`) | Consumer Affairs Agency | Food, appliances, housing equipment, toys, vehicles, cosmetics, consumer goods | HTML list/detail with pagination; API/RSS not confirmed | Medium if pagination remains stable; high due language and encoding | Product images on many notices | Good official management number, product, category, date; identifiers vary | Japanese | High | 6 | Broad and valuable, but source-language and scraper quality risk are high. |
| Japan | MLIT vehicle recalls (`https://www.mlit.go.jp/en/jidosha/vehicle_recall.html`) | Ministry of Land, Infrastructure, Transport and Tourism | Vehicle recalls | HTML monthly/year pages; summary links | Medium for vehicle-specific ingestion | Usually PDF/summary links; images not central | Strong make/model/manufacturer/date | English/Japanese | Medium-high | Defer | Vehicle category and detail mapping should be designed separately. |
| Japan | METI product safety recall references (`https://www.meti.go.jp/english/policy/economy/consumer/recall_info.html`) | Ministry of Economy, Trade and Industry | Product safety reference and OECD portal linkage | Informational page; direct recall feed not confirmed | Unknown | Unknown | Unknown | English/Japanese | High | Defer | Useful as authority context, not yet a direct ingestion feed. |
| South Korea | SafetyKorea Open API (`https://www.safetykorea.kr/release/openapi`) and recall board (`https://www.safetykorea.kr/recall/recallBoard`) | Korean Agency for Technology and Standards / Product Safety portal | KC certification, domestic recall, overseas recall, consumer product safety | Official Open API; public data listing says JSON+XML and real-time (`https://www.data.go.kr/data/15116894/openapi.do`) | Likely strong after API access/application confirmation | Recall board has product photos | Good: product name, model, company, recall type, barcode, publication date | Korean | Medium | 2 | Best Asia candidate if API access can be confirmed without manual approval friction. |
| South Korea | MFDS food recall / sales suspension (`https://www.foodsafetykorea.go.kr/portal/fooddanger/suspension.do?menu_grp=MENU_NEW02&menu_no=4408`) | Ministry of Food and Drug Safety | Food recall and sales suspension | Official page mentions RSS; public data listing provides JSON/XML fields including product photo URL (`https://www.data.go.kr/data/15074318/openapi.do`) | Likely strong after API key/access confirmation | Product photo URL appears in public data metadata | Strong: product, reason, company, address, barcode, package, manufacture date, expiration, recall grade | Korean | Medium | 2b | Strong food source; should be separate from SafetyKorea due source scope. |
| South Korea | Automobile Recall Center (`https://www.car.go.kr/`) | Ministry of Land, Infrastructure and Transport / Korea Transportation Safety Authority | Vehicle recalls and VIN checks | Official API requires prior consultation; data.go.kr metadata says JSON and detailed URL provided (`https://www.data.go.kr/data/15089863/openapi.do`) | Medium after permission; CSV/open data alternatives exist | Unknown | Strong vehicle fields | Korean | Medium-high | Defer | Keep separate until vehicle category and API terms are handled. |
| Singapore | Singapore Food Agency newsroom recalls (`https://www.sfa.gov.sg/news-publications/newsroom`) | Singapore Food Agency | Food recalls | HTML media releases/search; API/RSS unknown | Medium; page scrape needed unless data endpoint discovered | Images often present in notices | Good product, importer, country of origin, best-before, allergen/hazard | English | Medium | 7 | Good English food source, but no confirmed machine feed. |
| Singapore | Health Sciences Authority announcements (`https://www.hsa.gov.sg/announcements/`) | HSA | Therapeutic products, medical devices, health product recalls | HTML filtered announcements; API unknown | Medium | Media/attachments vary | Good batch/product fields on detail pages | English | Medium | Defer | Health-product scope requires category and disclaimer review. |
| Singapore | Consumer Product Safety Office alerts (`https://www.consumerproductsafety.gov.sg/`) | CPSO | Consumer product safety alerts and recalls | Isomer/static HTML; API unknown | Medium-high; page paths/category pages need prototype | Images on detail pages likely | Good title/date/hazard; identifiers vary | English | Medium | 8 | Useful but likely HTML-only. |
| Hong Kong | CFS Food Alerts / Allergy Alerts (`https://www.cfs.gov.hk/english/whatsnew/whatsnew_fa/whatsnew_fa.html`) | Centre for Food Safety | Food and allergy alerts | Official XML dataset on DATA.GOV.HK (`https://www.cfs.gov.hk/filemanager/foodalert/english/foodalert_datagovhk.xml`) | Good for latest XML; historical data availability needs check | Usually limited; detail pages may include text links | Moderate: subject, short description, official URL; detail fields vary | English/Traditional Chinese | Low-medium | 5b | Narrow but technically simple due official XML. |
| Hong Kong | EMSD electrical products recalled/prohibited (`https://www.emsd.gov.hk/en/electricity_safety/electrical_products_recalled_prohibited/index.html`) | Electrical and Mechanical Services Department | Household electrical products | HTML page grouped by year; API unknown | Medium; single page may be parseable | Product and label photos appear | Strong for model, brand, supplier, hazard, date | English/Traditional Chinese | Medium | 9 | Good household/electrical fit; likely HTML parsing. |
| Hong Kong | Customs consumer goods safety (`https://www.customs.gov.hk/en/service-enforcement-information/consumer-protection/goods-safety/index.html`) | Customs and Excise Department | Consumer goods safety alerts/enforcement | Press release HTML/search; API unknown | Low-medium | Unknown | Variable | English/Traditional Chinese | High | Defer | More enforcement-alert oriented than a structured recall source. |
| Taiwan | TFDA food safety and consumer alerts (`https://www.fda.gov.tw/eng/` and `https://www.fda.gov.tw/tc/csmnewsContent.aspx`) | Taiwan Food and Drug Administration | Food/drug safety alerts; international food warning "traffic light" pages | HTML/news API possibility; specific recall feed not confirmed | Unknown | Attachments/images vary | Variable; local import status often present | Traditional Chinese/English summaries | High | 10 | Needs deeper API discovery before implementation. |
| Taiwan | BSMI Commodity Safety Information (`https://www.bsmi.gov.tw/SafetyGIP/`) | Bureau of Standards, Metrology and Inspection | Consumer product recall/safety information | HTML listing/detail; API unknown | Medium if list/detail stable | Product images and attachments present | Good: product, brand, model, supplier, period, place sold, hazard, corrective action | Traditional Chinese | Medium-high | 10b | Good product-safety fit but likely HTML-only. |

## D. Australia Assessment

Australia is the best low-risk expansion candidate. Product Safety Australia is an official ACCC consumer-product recall source, provides searchable recall listings, and explicitly supports category RSS feeds plus saved-search RSS. It is English, consumer-product focused, and likely maps well to existing Recall Radar fields such as title, product names, brand/company, hazard, remedy, recall date, category, affected units, official URL, and images.

Recommended next action:

- Prototype `AU_PRODUCT_SAFETY` as a bounded latest RSS/search ingestion.
- Confirm whether detail pages provide stable product images, supplier, hazard, remedy, SKU/model/batch, affected units, and recall publication date.
- Keep FSANZ food and Vehicle Recalls as separate future sources instead of mixing them into one Australia source id.

Risks:

- RSS item payload may be summary-only, requiring detail-page fetch.
- Search-result RSS may be easier than full historical backfill.
- Vehicle recalls should not be merged into general product categories until vehicle-specific browsing is designed.

## E. New Zealand Assessment

New Zealand has a strong official product-safety site through MBIE Product Safety. The recall page exposes categories, counts, sorting, date filters, resolved-recall inclusion, and links to NZTA and MPI for vehicle and food coverage. Phase 37 confirmed official HTML listing/detail access and activated a bounded latest-100 `NZ_PRODUCT_SAFETY` spike; no usable API or RSS feed was confirmed.

Recommended next action:

- Keep `NZ_PRODUCT_SAFETY` as a bounded active source until a separate reviewed full-backfill phase exists.
- Use official HTML list/detail extraction only while no official feed is found.
- Keep `NZ_MPI_FOOD` and `NZTA_VEHICLE_RECALLS` separate because food and vehicle sources have different field quality and UX needs.

Risks:

- HTML-only ingestion has higher maintenance risk.
- NZTA appears focused on current vehicle recalls and VIN/vehicle management rather than broad static product browsing.

## F. Japan Assessment

Japan has broad recall coverage through the Consumer Affairs Agency Recall Information Site. The CAA English policy page confirms the recall site covers cars, housing equipment, household appliances, sports/leisure, toys, commodity goods, cosmetics, and food. The live recall site exposes Japanese list and detail pages with category, image, publication date, product title, management number, product details, and reference links.

Recommended next action:

- Do not start Japan first unless source-language handling and HTML scraper maintenance are prioritized.
- If implemented, begin with a bounded CAA latest-record prototype and preserve Japanese source text.
- Keep MLIT vehicle recalls separate from CAA because vehicle pages have their own table/list structure and summaries.

Risks:

- Japanese-only source text.
- HTML pagination/detail parsing and encoding must be handled carefully.
- Food records may link to separate MHLW/food systems; source provenance needs strict handling.

## G. Korea Assessment

Korea has the strongest confirmed API signals in Asia. SafetyKorea provides an official Open API for KC certification information, domestic recall information, and overseas recall information. The Korean public data portal lists the SafetyKorea product safety and recall API as JSON+XML, free, and real-time. The visible recall board includes product name, model, company, recall type, barcode number, publication date, and product photos.

MFDS food recall/sales-suspension data is also promising. The public data portal describes fields including product name, recall reason, manufacturer, address, phone, barcode number, package unit, manufacture date, recall method, expiration date, food category, product photo URL, item code, registration date, recall/sales-suspension serial number, and recall grade. FoodSafetyKorea also presents a public recall/sales-suspension page and mentions RSS.

Recommended next action:

- If Asia implementation is the product priority, verify SafetyKorea API access first and then build `KR_SAFETYKOREA`.
- Build `KR_MFDS` separately for food because it has better food-specific fields and likely a different update cadence.
- Defer `KR_CAR_RECALLS` until vehicle categories and API consultation requirements are addressed.

Risks:

- API access may require registration, service key, or prior approval.
- Source text is Korean.
- The official data may include domestic and overseas recall concepts that need separate source-scope labels.

## H. Singapore / Hong Kong / Taiwan Assessment

Singapore has English official sources but no confirmed easy feed in this pass. SFA food recall notices are detailed media releases and include product, importer, country of origin, best-before and allergen/hazard fields. HSA announcements include product recalls for therapeutic/health products. CPSO has consumer product alerts and recalls, but likely as static HTML.

Hong Kong has one technically attractive source: CFS Food Alerts / Allergy Alerts has an official DATA.GOV.HK XML resource for English alerts. That makes it a good narrow food/allergy source candidate. EMSD electrical recalls are strong for household/electrical product details and images, but appear HTML-only. Customs consumer goods safety is useful authority context, but less structured as a recall feed.

Taiwan has relevant official sources but needs deeper source discovery before implementation. TFDA publishes food/drug safety alert content and consumer "traffic light" warning pages, while BSMI's Commodity Safety Information site publishes consumer product recall details. BSMI is likely the best Taiwan product-safety candidate, but API/feed availability was not confirmed.

Recommended next action:

- Consider `HK_CFS` as a small low-risk XML food source after Australia/Korea.
- Keep Singapore and Taiwan candidates as follow-up source-specific discovery/prototype phases.

Risks:

- Several sources are HTML-only.
- Some sources are media-release streams, not clean recall feeds.
- Health/drug/medical sources need category and copy guardrails before activation.

## I. Recommended Implementation Order

1. `AU_PRODUCT_SAFETY` - best next overall candidate. Official, English, consumer-product focused, RSS-supported, and close to existing CPSC/Canada consumer recall UX.
2. `KR_SAFETYKOREA` - best next Asia candidate if API access can be confirmed. Strong official API signal and useful product identifiers.
3. `KR_MFDS` - strong food recall source with official JSON/XML metadata and product photo URL fields.
4. `HK_CFS` - narrow but promising official XML food/allergy feed.
5. `NZ_MPI_FOOD` - official New Zealand food recalls, separate from `NZ_PRODUCT_SAFETY`.
6. `AU_FSANZ` - official English food recall source, likely HTML/detail work.
7. `JP_CAA` - broad coverage but high source-language and HTML-maintenance risk.
8. `SG_SFA` - useful English food recall pages, but feed/API not confirmed.
9. `HK_EMSD` - valuable electrical/household recall pages, likely HTML-only.
10. `TW_BSMI` / `TW_TFDA` - relevant official sources, but require deeper access discovery.

Best next source candidate:

- Overall: continue with active `AU_PRODUCT_SAFETY` and `NZ_PRODUCT_SAFETY` maintenance before adding another Oceania source.
- Asia-specific: `KR_SAFETYKOREA`, after confirming API access, required key/approval flow, field schema, and allowed traffic.

## J. Source ID Proposals

Planning-only source id proposals:

- `AU_FSANZ`
- `AU_VEHICLE_RECALLS`
- `NZ_MPI_FOOD`
- `NZTA_VEHICLE_RECALLS`
- `JP_CAA`
- `JP_MLIT_VEHICLE`
- `KR_SAFETYKOREA`
- `KR_MFDS`
- `KR_CAR_RECALLS`
- `SG_SFA`
- `SG_HSA`
- `SG_CPSO`
- `HK_CFS`
- `HK_EMSD`
- `HK_CUSTOMS`
- `TW_TFDA`
- `TW_BSMI`

These ids are not active source ids and must not be added to `src/data/recall-types.ts`, `src/lib/recall-sources.ts`, source filters, or processed data until a future ingestion phase explicitly implements and validates one source. `AU_PRODUCT_SAFETY` and `NZ_PRODUCT_SAFETY` are already active bounded source ids and should be managed through their source-specific docs instead.

## K. Known Risks

- API access may require registration, manual approval, or service keys, especially for Korean APIs and vehicle sources.
- HTML-only sources can break when government sites redesign pages.
- Some sources publish media releases rather than structured recall records.
- Food, vehicle, health product, and general consumer product sources should remain separate because their identifier fields and consumer actions differ.
- Source-language text should remain source-traceable and should not be automatically translated as official notice truth.
- Static page count and brand page count must be reviewed before adding large source backfills.
- Image hotlinking, image permissions, and official media URL stability must be checked source by source.
- Cross-source dedupe remains deferred.

## L. Deferred Items

- No Asia/Oceania records added.
- No active source filters added.
- No source config activation.
- No homepage/source page UI changes.
- No country/source landing pages.
- No backfill.
- No source refresh.
- No canonical data changes.
- No translation.
- No LLM summarization.
- No backend.
- No database.
