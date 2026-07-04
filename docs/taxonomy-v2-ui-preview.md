# Taxonomy V2 UI Preview

Phase 44C locks the product-owner-approved public product-family category list for future Taxonomy V2 browsing. It does not classify canonical records, call an LLM, regenerate source files, or change current public category behavior.

Preview route:

- `/dev/taxonomy-v2-preview`
- noindex / nofollow
- not linked from the public homepage or primary navigation

## Public Category Decision

Use the full Taxonomy V2 product family list as public categories. Do not reduce the future public category model to a small subset. Do not hide the approved category list behind an overflow bucket as the main information architecture.

Approved public product-family labels, in order:

1. Food & Grocery
2. Baby & Kids
3. Electronics & Batteries
4. Home Appliances
5. Furniture & Household
6. Vehicles & Mobility
7. Sports & Outdoor
8. Clothing & Accessories
9. Tools & Equipment
10. Health & Personal Care
11. Chemicals & Cleaning
12. Pet Products
13. Industrial & Workplace
14. Other
15. Need Review

`Need Review` is the public label for records requiring manual review before final classification. It should be handled carefully in launch UI, but the label is part of the approved public category list.

## Browse Hierarchy

The future public browsing hierarchy is:

1. Search first
2. Product family categories
3. Source / country
4. Date, source, issue, and other filters later

Users usually know the product, brand, model, barcode, ingredient, or source market before they know the hazard. Hazard types are therefore secondary issue tags, not primary public browsing categories.

## Secondary Issue Tags

`hazardType` remains part of Taxonomy V2. It should support:

- result and detail tags
- optional secondary filtering later
- internal classification review
- clearer explanation of why a notice matters

It should not replace product-family categories as the main homepage or public navigation model.

## Proposed Future Routes

These routes are future targets only and are not implemented in Phase 44C:

- `/recalls/food-grocery`
- `/recalls/baby-kids`
- `/recalls/electronics-batteries`
- `/recalls/home-appliances`
- `/recalls/furniture-household`
- `/recalls/vehicles-mobility`
- `/recalls/sports-outdoor`
- `/recalls/clothing-accessories`
- `/recalls/tools-equipment`
- `/recalls/health-personal-care`
- `/recalls/chemicals-cleaning`
- `/recalls/pet-products`
- `/recalls/industrial-workplace`
- `/recalls/other`
- `/recalls/need-review`

## Proposed Detail Page Sections

Future detail pages can be structured around:

1. Recall Summary
2. Product Details
3. Hazard & Risk
4. Remedy / What to Do
5. Affected Identifiers
6. Images
7. Source Notice
8. Classification

The Classification section is for development and review visibility. Public pages may show simplified product family, product type, and issue tags. Confidence, evidence fields, prompt version, and model should not be public by default.

## Legacy Replacement Map

Current legacy pages remain in place during Phase 44C.

| Current | Future direction |
| --- | --- |
| `/baby-product-recalls` | `/recalls/baby-kids` |
| `/battery-recalls` | `/recalls/electronics-batteries` |
| `/food-allergy-recalls` | `/recalls/food-grocery` with secondary issue tags such as `allergen`, `contamination-pathogen`, `contamination-chemical`, and `foreign-matter` |
| `/household-product-recalls` | split into `/recalls/home-appliances`, `/recalls/furniture-household`, `/recalls/chemicals-cleaning`, and `/recalls/tools-equipment` |
| vehicle-like consumer products in mixed legacy groups | `/recalls/vehicles-mobility` |

Existing routes must not be removed until a separate public UI migration phase.

## What Is Not Implemented Yet

- no per-source Gemini classification
- no canonical taxonomy migration
- no public UI category migration
- no homepage category replacement
- no new source routes
- no source refresh
- no backfill
- no Korea SafetyKorea activation
- no backend
- no translation

## Next Product Review Points

1. How should all 15 public categories be presented on the homepage after migration?
2. Which category card layout works best across desktop and mobile?
3. How should `Need Review` be handled in public launch UI?
4. Which issue tags should be visible on result cards?
5. Which classification internals should remain dev-only?
