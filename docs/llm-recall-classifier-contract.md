# LLM Recall Classifier Contract

This contract defines the future offline classifier for Recall Taxonomy V2. Phase 41 does not call an LLM and does not classify live records.

## Runtime Boundary

- The classifier runs offline during data generation or a dry-run audit.
- It must not run in the browser.
- It must not run from a runtime API.
- It must not require a database.
- It must not add user-facing AI summaries.
- It must not rewrite official source facts.

## Input Fields

The classifier receives only normalized recall fields already collected from official sources:

```json
{
  "source": "CPSC",
  "title": "Recall title",
  "productNames": ["Product name"],
  "brandNames": ["Brand or company"],
  "rawSourceCategory": "Source category text",
  "hazard": "Hazard or reason text",
  "remedy": "Remedy or action text",
  "description": "Short source-derived description",
  "identifiers": ["model, UPC, lot, date, reference, or batch text"],
  "sourceUrl": "https://official-source.example/notice"
}
```

## Output Rules

The classifier must:

1. Return strict JSON.
2. Use fixed enum choices only.
3. Never invent category, product type, hazard type, domain, audience, method, or evidence values.
4. Include `reason` and `evidenceFields`.
5. Include `confidence`.
6. Set `needsReview` to true when uncertain.
7. Prefer `unknown` over hallucination.
8. Classify, not summarize, judge, or advise.
9. Not rewrite source facts.
10. Not make safety claims.
11. Not assert product safety status or affected/not-affected status.
12. Keep hazard classification separate from product classification.

## Output JSON Shape

```json
{
  "taxonomyVersion": "recall-taxonomy-v2",
  "productFamily": "vehicles-mobility",
  "productType": "golf-cart-utility-vehicle",
  "hazardType": "injury",
  "hazardTags": ["loss of control"],
  "recallDomain": "consumer-product",
  "audience": ["vehicle-users"],
  "confidence": 0.91,
  "needsReview": false,
  "reason": "The product is a golf car or utility vehicle and the source text describes loss of control and injury risk.",
  "evidenceFields": ["title", "productNames", "hazard", "description"]
}
```

## Enum Policy

The classifier must choose from the enum values exported by `src/data/recall-taxonomy-v2.ts`.

- If the top-level family is uncertain, use `unknown`.
- If the product family is known but type is not specific, use the family-specific `*-other` type.
- If the hazard is unclear, use `unknown`.
- If the audience is unclear, use `general` or `unknown` rather than inventing a group.
- `hazardTags` may contain short source-grounded terms, but they must not add facts that are absent from source fields.

## Review Policy

Set `needsReview: true` when:

- confidence is below the future threshold
- product family and source domain appear to conflict
- title/product fields are sparse
- hazard text is missing or vague
- the record is multilingual and the classifier cannot confidently map it
- multiple product families are plausible
- the classifier selected `unknown` or `other`

## Sample Cases

### Yamaha UMAX Bistro Vehicle/Utility Recall

Expected classification:

- `productFamily`: `vehicles-mobility`
- `productType`: `golf-cart-utility-vehicle`
- `hazardType`: `injury` or `crash`
- `recallDomain`: `consumer-product`
- `audience`: `vehicle-users`

Reason: "Bistro" is a product/model name in this case, not food context.

### Undeclared Milk Food Recall

Expected classification:

- `productFamily`: `food-grocery`
- `productType`: `snacks-bakery` or `packaged-food`
- `hazardType`: `allergen`
- `recallDomain`: `food`
- `audience`: `allergy-sensitive-consumers`

### Toy Choking Recall

Expected classification:

- `productFamily`: `baby-kids`
- `productType`: `toy`
- `hazardType`: `choking`
- `recallDomain`: `consumer-product`
- `audience`: `children`

### Power Bank Fire Risk Recall

Expected classification:

- `productFamily`: `electronics-batteries`
- `productType`: `power-bank`
- `hazardType`: `battery-overheat` or `fire`
- `recallDomain`: `consumer-product`

### Household Furniture Tip-Over Recall

Expected classification:

- `productFamily`: `furniture-household`
- `productType`: `furniture`
- `hazardType`: `entrapment`, `fall`, or `injury`
- `recallDomain`: `consumer-product`

### Cosmetics Chemical Exposure Recall

Expected classification:

- `productFamily`: `health-personal-care`
- `productType`: `cosmetic`
- `hazardType`: `chemical-exposure`
- `recallDomain`: `consumer-product` or `chemical`, depending on source context

### Pet Food Contamination Recall

Expected classification:

- `productFamily`: `pet-products`
- `productType`: `pet-food`
- `hazardType`: `contamination-pathogen` or `contamination-chemical`
- `recallDomain`: `food`
- `audience`: `pet-owners`

## Non-Goals

- No LLM call in Phase 41.
- No canonical data regeneration in Phase 41.
- No runtime model inference.
- No translation.
- No AI summary generation.
- No public UI route migration until taxonomy output is reviewed.
