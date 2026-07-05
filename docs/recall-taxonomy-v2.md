# Recall Taxonomy V2

Phase 41 defines a future breaking schema for Recall Radar classification. It does not migrate live records, regenerate canonical data, change source ids, change routes, or call an LLM.

Phase 43 adds the future Recall Data Schema V2 plan in `docs/recall-data-schema-v2.md` and `src/data/recall-data-schema-v2.ts`. Runtime data is still not migrated; current `category` remains only as a deprecated field until a separate migration phase.

## 1. Why The Old Category Is Deprecated

The current `category` string is deprecated for future data because it mixes several different concepts:

- product type, such as food, toy, appliance, or vehicle-like product
- hazard type, such as allergen, choking, fire, or crash
- recall domain, such as food, consumer product, vehicle, or chemical
- source type, such as FDA food notices or CPSC consumer product notices
- UI landing page grouping, such as Food & Allergy or Batteries & Electronics

That single-field model is too weak for global recall browsing. A non-food CPSC or consumer-product notice can mention restaurant, kitchen, or Bistro and be pulled toward food-like UI, while a food notice can be incorrectly reduced to allergen even when the hazard is Salmonella, glass, or a labeling error.

Old category compatibility is not a long-term requirement. The project is still in a development/test stage, current test data may be regenerated, and the final data model should derive category routes and filters from taxonomy v2.

## 2. Breaking-Change Decision

Recall Taxonomy V2 is a breaking schema direction:

- `category` may remain in current records only until migration.
- Future canonical records should require `classification`.
- The UI should derive public category routes from `classification.productFamily`. `classification.productType` and `classification.hazardType` should support secondary detail tags and optional filters.
- Compatibility with the old category string is not required for the long-term design.
- Data can be regenerated after the classifier is validated.

## 3. Current Category Usage Inventory

Current runtime flows still use the old field and are intentionally not changed in Phase 41.

- Created by source normalizers:
  - `scripts/normalize-cpsc.ts` uses `getCategory(raw.Products)`.
  - `scripts/normalize-fda-food.ts` uses `categoryFor(reason)`.
  - `scripts/normalize-rappelconso.ts` uses `categoryFor(raw)`.
  - `scripts/normalize-eu-safety-gate.ts` writes the Safety Gate category label.
  - `scripts/normalize-canada-recalls.ts`, `scripts/normalize-australia-product-safety.ts`, `scripts/normalize-new-zealand-product-safety.ts`, `scripts/normalize-hong-kong-cfs-food-alerts.ts`, and `scripts/normalize-fsanz-food-recalls.ts` each write a source-specific or mapped `category`.
- Merged by `scripts/merge-recalls.ts` into `data/processed/recalls.json` without changing the category meaning.
- Required by `src/data/recall-types.ts` as `NormalizedRecall.category`.
- Reclassified for site UI by `src/lib/recall-data.ts` in `classifyRecall(record)`, producing `SiteRecall.category`, `rawCategory`, and `categoryLabel`.
- Trusted by category helpers:
  - `getRecallsByCategory(category)`
  - `categoryRoutes`
  - `getSourceLandingProductTypeFilters(page)`
- Used for UI filtering and routing:
  - homepage product type cards
  - `/checker` product type filter and query params
  - `/baby-product-recalls`
  - `/battery-recalls`
  - `/food-allergy-recalls`
  - `/household-product-recalls`
  - source landing product type filters
- Used in search:
  - `src/lib/recall-search.ts` searches `category`, `rawCategory`, and `categoryLabel` as product-type related fields.
  - `src/lib/category-search.ts` and `src/lib/category-page-search.ts` use category-backed card attributes.
- Audited by source and launch audits:
  - global source audit reports category distribution by source
  - source audits report raw/site category distributions and suspicious mappings
  - homepage and multilingual audits use category distribution and category-specific checks

## 4. Taxonomy Axes

Taxonomy V2 separates independent decisions:

- `productFamily`: broad product family for public browsing.
- `productType`: controlled, more specific product type.
- `hazardType`: primary reason the notice matters.
- `hazardTags`: short free-text hazard terms derived from source text.
- `recallDomain`: broad regulatory or recall area.
- `audience`: consumers who should pay special attention.
- classification metadata: method, confidence, reason, evidence, model, and prompt version.
- source-aware identifiers: optional typed identifier arrays in Data Schema V2. Barcode is only one possible identifier and may be missing.

Do not add source-specific keyword exceptions as the long-term fix. The classifier should use source text and fixed enum choices.

## 5. productFamily

Top-level families should stay broad enough for global recall sources:

| Value | Scope |
| --- | --- |
| `food-grocery` | Human food, grocery items, beverages, ingredients, infant food, and food-like supplements. |
| `baby-kids` | Toys, nursery products, cribs, strollers, child furniture, child clothing, and school products. |
| `electronics-batteries` | Batteries, chargers, power banks, electrical accessories, and consumer electronics. |
| `home-appliances` | Kitchen appliances, laundry appliances, heaters, fans, air conditioners, and home fixtures. |
| `furniture-household` | Furniture, bedding, cookware, tableware, and non-electrical household products. |
| `vehicles-mobility` | Passenger vehicles, golf carts, utility vehicles, bicycles, scooters, mobility devices, trailers, and vehicle accessories. |
| `sports-outdoor` | Exercise equipment, outdoor/camping gear, pool/water products, and protective sports gear. |
| `clothing-accessories` | Clothing, footwear, jewelry, bags, luggage, and fashion accessories. |
| `tools-equipment` | Power tools, hand tools, ladders, and machinery/equipment. |
| `health-personal-care` | Cosmetics, personal care, hygiene products, and consumer medical devices. |
| `chemicals-cleaning` | Cleaning products, detergents, pesticides, and chemical products. |
| `pet-products` | Pet food, pet toys, and pet equipment. |
| `industrial-workplace` | Workplace-only equipment and industrial products. |
| `other` | Known product that does not fit a listed family. |
| `unknown` | Product family cannot be determined from available source text. The public label is Need Review. |

Examples:

- Yamaha UMAX Bistro, golf cart, or utility vehicle: `vehicles-mobility`.
- Undeclared milk in cookies: `food-grocery`.
- Toy choking hazard: `baby-kids`.
- Power bank overheating: `electronics-batteries`.

## 6. productType Strategy

`productType` is controlled but extensible. The classifier must choose from enum values only. It must not invent arbitrary product types. If a record is uncertain, use a family-specific `*-other` type or `unknown`.

Initial values:

- Food: `packaged-food`, `beverage`, `dairy`, `meat-seafood`, `snacks-bakery`, `infant-food`, `supplement-like-food`, `food-other`
- Baby/Kids: `toy`, `stroller-pram`, `nursery-gear`, `child-furniture`, `child-clothing`, `school-product`, `baby-kids-other`
- Electronics/Batteries: `battery`, `charger`, `power-bank`, `appliance-electrical`, `lighting`, `electronic-accessory`, `electronics-other`
- Home/Appliances: `kitchen-appliance`, `laundry-appliance`, `heater`, `air-conditioner-fan`, `home-fixture`, `home-appliance-other`
- Furniture/Household: `furniture`, `bedding`, `cookware`, `tableware`, `household-product`, `household-other`
- Vehicles/Mobility: `passenger-vehicle`, `golf-cart-utility-vehicle`, `atv-off-road`, `bicycle`, `scooter`, `mobility-device`, `trailer`, `vehicle-accessory`, `vehicles-other`
- Sports/Outdoor: `exercise-equipment`, `camping-outdoor`, `pool-water-sports`, `helmet-protective-gear`, `sports-other`
- Tools/Equipment: `power-tool`, `hand-tool`, `ladder`, `machinery-equipment`, `tools-other`
- Clothing/Accessories: `clothing`, `footwear`, `jewelry-accessory`, `bag-luggage`, `clothing-accessory-other`
- Health/Personal Care: `cosmetic`, `personal-care-product`, `medical-device-consumer`, `hygiene-product`, `health-personal-care-other`
- Chemicals/Cleaning: `cleaning-product`, `detergent`, `pesticide`, `chemical-product`, `chemicals-cleaning-other`
- Pet: `pet-food`, `pet-toy`, `pet-equipment`, `pet-product-other`
- Other: `other`, `unknown`

## 7. hazardType

`hazardType` is separate from product family. Food recalls should not all be `allergen`.

Values:

- `allergen`
- `contamination-pathogen`
- `contamination-chemical`
- `foreign-matter`
- `choking`
- `suffocation`
- `strangulation`
- `fire`
- `burn`
- `electric-shock`
- `battery-overheat`
- `injury`
- `fall`
- `laceration`
- `entrapment`
- `poisoning`
- `chemical-exposure`
- `crash`
- `drowning`
- `labeling-error`
- `regulatory-noncompliance`
- `quality-defect`
- `unknown`

Examples:

- undeclared milk: `allergen`
- Salmonella: `contamination-pathogen`
- glass pieces: `foreign-matter`
- wrong label: `labeling-error`
- overheating power bank: `battery-overheat` or `fire`
- toy small parts: `choking`
- golf cart crash/injury risk: `injury` or `crash`

## 8. recallDomain

`recallDomain` is a broad regulatory or recall area. It helps source grouping, but it does not replace `productFamily`.

Values:

- `consumer-product`
- `food`
- `vehicle`
- `medical-health`
- `chemical`
- `workplace-industrial`
- `unknown`

Examples:

- FSANZ, Hong Kong CFS, and UK FSA food notices: `food`.
- CPSC toy recall: `consumer-product`.
- Yamaha golf cart or utility vehicle from CPSC: `recallDomain = consumer-product`, `productFamily = vehicles-mobility`, `hazardType = injury` or `crash`.

Do not assume every vehicle-like product is an official automotive recall domain. Source context matters.

## 9. audience

`audience` is an array. Do not overuse it; assign a specific audience only when source text or product type clearly supports it.

Values:

- `general`
- `children`
- `infants`
- `allergy-sensitive-consumers`
- `elderly`
- `pregnant-people`
- `pet-owners`
- `workers`
- `outdoor-users`
- `vehicle-users`
- `unknown`

Examples:

- child's toy: `children`
- infant formula or baby food: `infants`
- undeclared allergen: `allergy-sensitive-consumers`
- pet food: `pet-owners`
- industrial equipment: `workers`

## 10. Classification Metadata

Every future taxonomy v2 record should include:

- `taxonomyVersion`
- `method`
- `model`
- `promptVersion`
- `confidence`
- `needsReview`
- `reason`
- `evidenceFields`

Allowed methods:

- `llm`
- `manual`
- `rule`
- `source`
- `unknown`

Allowed evidence fields:

- `title`
- `productNames`
- `brandNames`
- `category`
- `hazard`
- `remedy`
- `description`
- `rawSourceCategory`
- `source`
- `sourceUrl`
- `identifiers`

## 11. Future NormalizedRecallV2 Shape

This is the intended future breaking schema, not a runtime schema in Phase 41:

```json
{
  "id": "example-id",
  "source": "CPSC",
  "sourceUrl": "https://example.test/notice",
  "title": "Yamaha UMAX Bistro golf cars recalled due to injury hazard",
  "productNames": ["Yamaha UMAX Bistro golf car"],
  "brandNames": ["Yamaha"],
  "recallDate": "2026-01-01",
  "hazard": "The vehicle can lose steering control.",
  "remedy": "Stop use and contact the dealer.",
  "description": "Golf cars and utility vehicles are affected.",
  "images": [],
  "classification": {
    "taxonomyVersion": "recall-taxonomy-v2",
    "method": "llm",
    "model": "cheap-classifier-model",
    "promptVersion": "recall-classifier-v2",
    "productFamily": "vehicles-mobility",
    "productType": "golf-cart-utility-vehicle",
    "hazardType": "injury",
    "hazardTags": ["loss of control"],
    "recallDomain": "consumer-product",
    "audience": ["vehicle-users"],
    "confidence": 0.91,
    "needsReview": false,
    "reason": "The recalled product is a Yamaha golf car or utility vehicle and the notice describes an injury hazard.",
    "evidenceFields": ["title", "productNames", "description", "hazard"]
  },
  "raw": {}
}
```

The old `category` field should not be required in final v2 runtime data. Public category pages should derive groupings from `classification.productFamily`; product type and hazard type should appear as secondary detail tags and optional filters.

## 12. Future UI Category Model

Phase 44C locks the full product-family list as the future public category model. Do not reduce the public category model to a small subset, and do not use hazard-first browsing as the main navigation model.

Approved future public product-family routes:

- `/recalls/food-grocery` - Food & Grocery Recalls
- `/recalls/baby-kids` - Baby & Kids Recalls
- `/recalls/electronics-batteries` - Electronics & Batteries Recalls
- `/recalls/home-appliances` - Home Appliances Recalls
- `/recalls/furniture-household` - Furniture & Household Recalls
- `/recalls/vehicles-mobility` - Vehicles & Mobility Recalls
- `/recalls/sports-outdoor` - Sports & Outdoor Recalls
- `/recalls/clothing-accessories` - Clothing & Accessories Recalls
- `/recalls/tools-equipment` - Tools & Equipment Recalls
- `/recalls/health-personal-care` - Health & Personal Care Recalls
- `/recalls/chemicals-cleaning` - Chemicals & Cleaning Recalls
- `/recalls/pet-products` - Pet Products Recalls
- `/recalls/industrial-workplace` - Industrial & Workplace Recalls
- `/recalls/other` - Other Recalls
- `/recalls/need-review` - Need Review

Do not implement these routes in Phase 41. Do not implement these routes until a separate public UI migration phase.

Issue tags derived from `hazardType` are secondary metadata. They may appear on result/detail cards and support optional filters later:

- Food & Grocery: All, Allergens, Contamination, Foreign matter, Labeling issues
- Electronics & Battery: All, Battery overheating, Fire, Electric shock
- Baby & Kids: All, Toys, Choking, Suffocation, Nursery gear
- Vehicles & Mobility: All, Golf carts / utility vehicles, Bicycles, Scooters, Crash / injury

## 13. SEO And Route Implications

Taxonomy v2 should make public routes clearer and less source-specific:

- Product-family routes should be stable and global.
- Source landing pages should remain source/market entry points.
- Issue tags should refine category pages or detail cards, not become the primary homepage navigation or create every possible route.
- Do not add multilingual routes, `hreflang`, or translated slugs as part of taxonomy migration.
- Avoid "all recalls" and complete-coverage claims. Continue using indexed-notice language.

## 14. Migration Plan

1. Keep Phase 41 docs, fixtures, types, and audit as the contract.
2. Add an offline classifier dry run that reads records and writes a non-canonical report.
3. Estimate cost and review low-confidence output before changing data.
4. Add a generated sidecar file for trial classification, still non-canonical.
5. Review examples across all 10 sources, especially vehicle-like, food, child-product, chemical, pet, and industrial records.
6. Update source audits to validate taxonomy v2 fields.
7. Regenerate canonical data with `classification`.
8. Replace current category pages with taxonomy-derived routes.
9. Remove old category as a required runtime field after the new UI is stable.

## 15. LLM Classifier Plan

The classifier should run offline during data generation. It should be cheap, bounded, and deterministic enough for repeatable backfills.

Classifier input may include identifiers, but source coverage varies. Do not assume a barcode exists. Treat model numbers, lot or batch codes, date marks, pack sizes, certification numbers, recall numbers, alert numbers, and source-specific product details as possible evidence when present.

Classifier requirements:

- strict JSON output
- enum-only output for product family, product type, hazard type, recall domain, audience, method, and evidence fields
- no arbitrary invented product types
- confidence score
- `needsReview = true` when uncertain
- short reason grounded in source fields
- evidence field list
- prefer `unknown` over hallucination
- no source fact rewriting
- no safety claims

See `docs/llm-recall-classifier-contract.md` for the classifier contract.

## 16. Human Review Plan

Human review should focus on:

- low confidence records
- `unknown` or `other` assignments
- product/hazard mismatch
- source categories known to be broad or multilingual
- vehicle-like products in consumer-product sources
- food recalls where hazard is not allergen
- source records with sparse product names or sparse hazard text

Review decisions should become manual classification overrides or fixture cases, not one-off keyword patches in runtime UI.

## 17. Known Risks

- LLM output can drift unless enum-only JSON is enforced.
- Some official source records have sparse or multilingual fields.
- Product family and recall domain can differ, especially vehicle-like products in consumer-product sources.
- Food recalls include allergen, pathogen, chemical, foreign matter, and labeling hazards.
- Category counts will change after migration because old UI buckets are not preserved.
- Existing category routes may need redirects or deprecation planning when replaced.
- Human review is required for low-confidence records before public UI migration.
