# Taxonomy V2 UI Preview

Phase 44B adds a development-only preview for the future Taxonomy V2 browsing and detail-page structure. It does not classify canonical records, call an LLM, regenerate source files, or change public category behavior.

Preview route:

- `/dev/taxonomy-v2-preview`
- noindex / nofollow
- not linked from the public homepage or primary navigation

## Purpose

The preview helps review the future product menu before Gemini per-source classification. It shows how `productFamily`, `productType`, `hazardType`, `recallDomain`, and `audience` could shape public browsing and detail pages.

## Why The Old Category UI Is Not Enough

The old single `category` field mixes product type, hazard, source, and landing-page grouping. That is too weak for global recall browsing because:

- food notices need separate allergen, contamination, foreign matter, and labeling filters
- vehicle-like consumer products such as Yamaha UMAX Bistro should not be pulled into food-like or household-like groups
- batteries, electronics, appliances, and tools need separate product-family and hazard views
- household products need to split into appliances, furniture, chemicals, and tools where appropriate

## Proposed Top-Level Menu Names

- Food & Grocery
- Baby & Kids
- Electronics & Batteries
- Home Appliances
- Furniture & Household
- Vehicles & Mobility
- Sports & Outdoor
- Tools & Equipment
- Clothing & Accessories
- Health & Personal Care
- Chemicals & Cleaning
- Pet Products
- Industrial & Workplace
- Other
- Needs Review

## Proposed Future Routes

These routes are preview targets only and are not implemented in Phase 44B:

- `/recalls/food-grocery`
- `/recalls/baby-kids`
- `/recalls/electronics-batteries`
- `/recalls/home-appliances`
- `/recalls/furniture-household`
- `/recalls/vehicles-mobility`
- `/recalls/sports-outdoor`
- `/recalls/tools-equipment`
- `/recalls/clothing-accessories`
- `/recalls/health-personal-care`
- `/recalls/chemicals-cleaning`
- `/recalls/pet-products`
- `/recalls/industrial-workplace`
- `/recalls/other`
- `/recalls/needs-review`

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

The Classification section is for development and review visibility. Public launch may hide or minimize classification internals after review.

## Public vs Development Classification Visibility

Development preview can show:

- product family
- product type
- hazard type
- hazard tags
- recall domain
- audience
- confidence
- needs review
- evidence fields
- reason

Public pages should focus on useful consumer browsing labels and official notice verification. Confidence, evidence fields, and model reasoning may remain internal.

## Legacy Replacement Map

Current legacy pages remain in place during Phase 44B.

| Current | Future direction |
| --- | --- |
| `/baby-product-recalls` | `/recalls/baby-kids` |
| `/battery-recalls` | `/recalls/electronics-batteries` |
| `/food-allergy-recalls` | `/recalls/food-grocery` with hazard filters such as `allergen`, `contamination-pathogen`, `contamination-chemical`, and `foreign-matter` |
| `/household-product-recalls` | split into `/recalls/home-appliances`, `/recalls/furniture-household`, `/recalls/chemicals-cleaning`, and `/recalls/tools-equipment` |
| vehicle-like consumer products in mixed legacy groups | `/recalls/vehicles-mobility` |

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

## Product Owner Decision Points

1. Are top-level category names acceptable?
2. Are there too many categories for homepage discovery?
3. Which categories should appear on homepage first?
4. Should Vehicles & Mobility be a top-level public category?
5. Should Industrial & Workplace be public or hidden until enough records exist?
6. Should Classification remain dev-only?
7. Should Food & Grocery replace Food & Allergy publicly?
8. Should hazard filters appear as chips under each category?
