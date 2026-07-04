# Recall DB Schema V2

Recall Radar remains a static JSON site today. This document defines the future database shape only. Phase 43 does not implement a database, backend, API, migrations, or persistence layer.

## Strategy

Use a main `recalls` table first. Store `classification` as JSONB initially so the taxonomy can evolve without repeated table migrations. Add generated or materialized indexed columns later after the classification schema stabilizes.

## Draft Table

```sql
create table recalls (
  id text primary key,
  source text not null,
  source_record_id text,
  source_url text not null,
  source_label text,
  market text,
  agency text,
  title text not null,
  product_names text[] not null default '{}',
  brand_names text[] not null default '{}',
  recall_date date,
  last_updated timestamptz,
  description text,
  hazard text,
  remedy text,
  affected_units text,
  identifiers jsonb not null default '[]'::jsonb,
  images jsonb not null default '[]'::jsonb,
  classification jsonb not null,
  raw jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

## Generated Or Indexed Columns Later

After the classifier is stable, add generated columns or denormalized maintained fields:

- `product_family text`
- `product_type text`
- `hazard_type text`
- `recall_domain text`
- `needs_review boolean`
- `confidence numeric`

These should mirror values inside `classification`.

## Recommended Indexes

```sql
create index recalls_source_idx on recalls (source);
create index recalls_recall_date_idx on recalls (recall_date desc);
create index recalls_product_family_idx on recalls (product_family);
create index recalls_product_type_idx on recalls (product_type);
create index recalls_hazard_type_idx on recalls (hazard_type);
create index recalls_recall_domain_idx on recalls (recall_domain);
create index recalls_needs_review_idx on recalls (needs_review);
create index recalls_classification_gin_idx on recalls using gin (classification);
create index recalls_identifiers_gin_idx on recalls using gin (identifiers);
```

Future full-text search index:

```sql
create index recalls_search_idx on recalls using gin (
  to_tsvector(
    'simple',
    coalesce(title, '') || ' ' ||
    array_to_string(product_names, ' ') || ' ' ||
    array_to_string(brand_names, ' ') || ' ' ||
    coalesce(description, '')
  )
);
```

## Validation Before Insert

Before classified records move into a database:

- required V2 fields must exist
- `classification` must validate against Recall Taxonomy V2
- source ids must match the active source registry
- source counts must be preserved for migration batches
- `raw` must remain available for audit traceability
- user-facing copy must not be generated directly from `raw`

## Deferred DB Work

- no DB implementation in Phase 43
- no migrations
- no database client
- no runtime API
- no auth/accounts
- no write path from browser
- no canonical data migration
