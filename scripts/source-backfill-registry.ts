export type SourceBackfillId =
  | 'CPSC'
  | 'FDA'
  | 'FR_RAPPELCONSO'
  | 'CA_RECALLS'
  | 'EU_SAFETY_GATE'
  | 'UK_FSA'
  | 'AU_PRODUCT_SAFETY'
  | 'NZ_PRODUCT_SAFETY'
  | 'HK_CFS'
  | 'FSANZ_FOOD_RECALLS';

export type BackfillStatus = 'ready' | 'partial' | 'needs-investigation' | 'not-applicable';

export type SuggestedBackfillMode =
  | 'latest-pagination'
  | 'date-window'
  | 'detail-refresh'
  | 'official-download'
  | 'manual-source-specific';

export type SourceBackfillRegistryEntry = {
  sourceId: SourceBackfillId;
  outputKey: string;
  label: string;
  currentCount: number;
  rawPath: string;
  processedPath: string;
  existingFetchScript: string;
  existingNormalizeScript: string;
  existingAuditScript: string;
  existingUpdateScript: string;
  backfillStatus: BackfillStatus;
  suggestedBackfillMode: SuggestedBackfillMode[];
  outputDir: string;
  checkpointPath: string;
  endpointOrInput: string;
  currentFetchMode: string;
  paginationStatus: string;
  dateFilterStatus: string;
  detailRefreshStatus: string;
  imageSupport: string;
  updateScriptBehavior: string;
  estimatedRisk: 'low' | 'medium' | 'high';
  riskNotes: string[];
  knownLimitations: string[];
  recommendedNextStep: string;
  deferredWork: string[];
};

export const sourceBackfillRegistry: SourceBackfillRegistryEntry[] = [
  {
    sourceId: 'CPSC',
    outputKey: 'cpsc',
    label: 'United States - CPSC',
    currentCount: 301,
    rawPath: 'data/raw/cpsc-recalls.json',
    processedPath: 'data/processed/cpsc-recalls.json',
    existingFetchScript: 'npm run fetch:cpsc',
    existingNormalizeScript: 'npm run normalize:cpsc',
    existingAuditScript: 'npm run audit:sources',
    existingUpdateScript: 'npm run fetch:cpsc',
    backfillStatus: 'partial',
    suggestedBackfillMode: ['date-window'],
    outputDir: 'data/backfill/cpsc',
    checkpointPath: 'data/backfill/cpsc/checkpoints/cpsc-backfill-checkpoint.json',
    endpointOrInput: 'https://www.saferproducts.gov/RestWebServices/Recall',
    currentFetchMode: 'Bounded by RecallDateStart and RecallDateEnd, defaulting to the current year.',
    paginationStatus: 'No explicit pagination in current script; date windows should be used for larger historical pulls.',
    dateFilterStatus: 'Supported by RecallDateStart and RecallDateEnd query parameters.',
    detailRefreshStatus: 'Not implemented separately; current API payload already includes recall detail fields and image URLs.',
    imageSupport: 'CPSC records include official image URLs in the current normalized data.',
    updateScriptBehavior: 'Fetches, normalizes, merges canonical data, and prints counts.',
    estimatedRisk: 'medium',
    riskNotes: [
      'Historical windows may generate many detail and brand pages.',
      'CPSC category mapping is currently conservative and mostly general consumer product.',
      'No source-specific dry-run/chunk/checkpoint pipeline exists yet.'
    ],
    knownLimitations: [
      'No source-specific backfill audit beyond integrated source audit.',
      'No cross-source dedupe.'
    ],
    recommendedNextStep: 'Add a CPSC dry-run backfill script using small date windows, chunked output, and source-specific audit.',
    deferredWork: ['Full CPSC historical backfill.', 'CPSC-specific chunk audit.', 'Launch selection policy.']
  },
  {
    sourceId: 'FDA',
    outputKey: 'fda-food',
    label: 'United States - FDA / openFDA food enforcement',
    currentCount: 100,
    rawPath: 'data/raw/fda-food-recalls.json',
    processedPath: 'data/processed/fda-recalls.json',
    existingFetchScript: 'npm run fetch:fda-food',
    existingNormalizeScript: 'npm run normalize:fda-food',
    existingAuditScript: 'npm run audit:fda-food-backfill',
    existingUpdateScript: 'npm run fetch:fda-food',
    backfillStatus: 'ready',
    suggestedBackfillMode: ['date-window', 'latest-pagination'],
    outputDir: 'data/backfill/fda-food',
    checkpointPath: 'data/backfill/fda-food/checkpoints/fda-food-backfill-checkpoint.json',
    endpointOrInput: 'https://api.fda.gov/food/enforcement.json',
    currentFetchMode: 'Latest 100 by report_date descending in the canonical source fetch.',
    paginationStatus: 'Dry-run pipeline supports bounded limit and skip controls.',
    dateFilterStatus: 'Dry-run pipeline supports report_date windows.',
    detailRefreshStatus: 'Not applicable for current openFDA enforcement JSON path.',
    imageSupport: 'Current openFDA food enforcement JSON does not provide usable product image URLs.',
    updateScriptBehavior: 'Current fetch writes latest 100, normalizes, merges canonical data, and prints counts.',
    estimatedRisk: 'medium',
    riskNotes: [
      'Full openFDA food enforcement history is about 29k records and should not be merged without selection.',
      'Repeated event_id values are normal across multiple recall_number records and require audit.',
      'No FDA image scraping is included.'
    ],
    knownLimitations: [
      'No canonical FDA expansion policy yet.',
      'No FDA product image source in current API path.'
    ],
    recommendedNextStep: 'Use Phase 23 dry-run tooling to select a launch subset before canonical expansion.',
    deferredWork: ['Full FDA food backfill.', 'Canonical FDA expansion.', 'FDA image investigation.']
  },
  {
    sourceId: 'FR_RAPPELCONSO',
    outputKey: 'rappelconso',
    label: 'France - RappelConso',
    currentCount: 100,
    rawPath: 'data/raw/rappelconso-recalls.json',
    processedPath: 'data/processed/rappelconso-recalls.json',
    existingFetchScript: 'npm run fetch:rappelconso',
    existingNormalizeScript: 'npm run normalize:rappelconso',
    existingAuditScript: 'npm run audit:rappelconso',
    existingUpdateScript: 'npm run update:rappelconso',
    backfillStatus: 'partial',
    suggestedBackfillMode: ['latest-pagination', 'date-window'],
    outputDir: 'data/backfill/rappelconso',
    checkpointPath: 'data/backfill/rappelconso/checkpoints/rappelconso-backfill-checkpoint.json',
    endpointOrInput:
      'https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/rappelconso-v2-gtin-espaces/records',
    currentFetchMode: 'Latest bounded slice ordered by date_publication desc.',
    paginationStatus: 'Current script supports limit only; future backfill should add offset/page controls.',
    dateFilterStatus: 'Not implemented in current script; likely possible through source query filters.',
    detailRefreshStatus: 'Not implemented; current records use open-data fields and official notice URLs.',
    imageSupport: 'Some RappelConso records include official image URLs.',
    updateScriptBehavior: 'Fetches bounded source data, normalizes, merges canonical data, and runs source audit.',
    estimatedRisk: 'medium',
    riskNotes: [
      'GTIN-spaced rows can create repeated recall-level entries and require dedupe policy.',
      'French source text remains source-language.',
      'Some records lack remedy/action fields.'
    ],
    knownLimitations: [
      'No source-specific dry-run/chunk/checkpoint pipeline.',
      'No full pagination or date-window support in current script.'
    ],
    recommendedNextStep: 'Add a RappelConso dry-run pipeline with offset/date filters, recall-level dedupe, and chunk audit.',
    deferredWork: ['Full France backfill.', 'Recall-level dedupe policy.', 'Source-language handling policy.']
  },
  {
    sourceId: 'CA_RECALLS',
    outputKey: 'canada',
    label: 'Canada - Recalls and Safety Alerts',
    currentCount: 100,
    rawPath: 'data/raw/canada-recalls.json',
    processedPath: 'data/processed/canada-recalls.json',
    existingFetchScript: 'npm run fetch:canada',
    existingNormalizeScript: 'npm run normalize:canada',
    existingAuditScript: 'npm run audit:canada',
    existingUpdateScript: 'npm run update:canada',
    backfillStatus: 'partial',
    suggestedBackfillMode: ['official-download', 'detail-refresh'],
    outputDir: 'data/backfill/canada',
    checkpointPath: 'data/backfill/canada/checkpoints/canada-backfill-checkpoint.json',
    endpointOrInput: 'https://recalls-rappels.canada.ca/sites/default/files/opendata-donneesouvertes/HCRSAMOpenData.json',
    currentFetchMode: 'Downloads official JSON feed, sorts by Last updated, and keeps bounded latest records.',
    paginationStatus: 'Not applicable to current full-feed JSON download; chunking should happen locally after download.',
    dateFilterStatus: 'Not implemented in current script; future pipeline can filter local feed by Last updated.',
    detailRefreshStatus:
      'Current fetch enriches bounded records by checking official detail pages for images, summary fields, and supported affected-product tables.',
    imageSupport: 'Some records can recover official detail-page images; selected feed itself does not expose stable image links.',
    updateScriptBehavior:
      'Fetches bounded source data, enriches official detail-page images and structured detail fields, normalizes, merges canonical data, and runs source audit.',
    estimatedRisk: 'high',
    riskNotes: [
      'Full feed includes many alert types, sparse fields, and broad categories.',
      'Detail-page enrichment can multiply network calls and may need selector drift monitoring.',
      'Some records are alerts or safety notices rather than strict recall notices.'
    ],
    knownLimitations: [
      'No source-specific dry-run/chunk/checkpoint pipeline.',
      'Affected-product extraction depends on supported official detail-page table markup.',
      'Sparse structured brand, model, lot, and distribution fields.'
    ],
    recommendedNextStep: 'Add a Canada planning/backfill script that downloads the official feed once, filters/chunks locally, and makes detail refresh optional.',
    deferredWork: ['Full Canada backfill.', 'French feed ingestion.', 'Broader detail-page selector coverage audit.']
  },
  {
    sourceId: 'EU_SAFETY_GATE',
    outputKey: 'eu-safety-gate',
    label: 'European Union - Safety Gate',
    currentCount: 100,
    rawPath: 'data/raw/eu-safety-gate-recalls.json',
    processedPath: 'data/processed/eu-safety-gate-recalls.json',
    existingFetchScript: 'npm run fetch:eu-safety-gate',
    existingNormalizeScript: 'npm run normalize:eu-safety-gate',
    existingAuditScript: 'npm run audit:eu-safety-gate',
    existingUpdateScript: 'npm run update:eu-safety-gate',
    backfillStatus: 'partial',
    suggestedBackfillMode: ['latest-pagination', 'detail-refresh', 'manual-source-specific'],
    outputDir: 'data/backfill/eu-safety-gate',
    checkpointPath: 'data/backfill/eu-safety-gate/checkpoints/eu-safety-gate-backfill-checkpoint.json',
    endpointOrInput: 'https://ec.europa.eu/safety-gate-alerts/public/api/notification/mostRecent/?',
    currentFetchMode: 'Most recent summaries plus official detail refresh for bounded records.',
    paginationStatus: 'Current collector paginates mostRecent pages until limit is reached.',
    dateFilterStatus: 'Not implemented; full historical strategy needs source-specific endpoint investigation.',
    detailRefreshStatus: 'Implemented for bounded records and existing record ids.',
    imageSupport: 'Current EU records include official Safety Gate image and thumbnail endpoint URLs.',
    updateScriptBehavior: 'Fetches bounded source data, refreshes details, normalizes, merges canonical data, and runs source audit.',
    estimatedRisk: 'high',
    riskNotes: [
      'Raw Safety Gate detail payloads are verbose.',
      'Full historical API behavior and date filters need investigation.',
      'Image endpoint freshness and mainPicture selection require ongoing audits.'
    ],
    knownLimitations: [
      'No source-specific dry-run/chunk/checkpoint pipeline.',
      'No approved full historical endpoint strategy.',
      'No cross-source dedupe.'
    ],
    recommendedNextStep:
      'Add an EU Safety Gate dry-run planner that samples pages without replacing the current 100 ids, then separately design historical windows.',
    deferredWork: ['Full EU backfill.', 'Historical endpoint strategy.', 'Build-size review for verbose raw payloads.']
  },
  {
    sourceId: 'UK_FSA',
    outputKey: 'uk-fsa',
    label: 'United Kingdom - FSA Food Alerts',
    currentCount: 100,
    rawPath: 'data/raw/uk-fsa-alerts.json',
    processedPath: 'data/processed/uk-fsa-alerts.json',
    existingFetchScript: 'npm run fetch:uk-fsa',
    existingNormalizeScript: 'npm run normalize:uk-fsa',
    existingAuditScript: 'npm run audit:uk-fsa',
    existingUpdateScript: 'npm run update:uk-fsa',
    backfillStatus: 'partial',
    suggestedBackfillMode: ['latest-pagination', 'detail-refresh', 'date-window'],
    outputDir: 'data/backfill/uk-fsa',
    checkpointPath: 'data/backfill/uk-fsa/checkpoints/uk-fsa-backfill-checkpoint.json',
    endpointOrInput: 'https://data.food.gov.uk/food-alerts/id.json',
    currentFetchMode: 'Latest bounded list sorted by created date, then detail fetch per alert notation.',
    paginationStatus: 'Current script supports _limit only; future backfill should add paging controls.',
    dateFilterStatus: 'Not implemented in current script; possible future linked-data query/filter work.',
    detailRefreshStatus: 'Implemented for bounded alert notation records.',
    imageSupport: 'Current normalized product-card images are absent; raw related media may exist.',
    updateScriptBehavior: 'Fetches bounded list/details, normalizes, merges canonical data, and runs source audit.',
    estimatedRisk: 'medium',
    riskNotes: [
      'Some alerts include multiple affected products.',
      'Raw/detail payloads can be verbose.',
      'UK FSA is food-alert coverage, not all UK product recalls.'
    ],
    knownLimitations: [
      'No source-specific dry-run/chunk/checkpoint pipeline.',
      'No normalized product image support.',
      'No full pagination/date-window implementation.'
    ],
    recommendedNextStep: 'Add a UK FSA dry-run pipeline with pagination, detail refresh controls, and source-specific chunk audit.',
    deferredWork: ['Full UK FSA backfill.', 'FSA pagination/date-window strategy.', 'Related media/image policy.']
  },
  {
    sourceId: 'AU_PRODUCT_SAFETY',
    outputKey: 'australia-product-safety',
    label: 'Australia - Product Safety Australia',
    currentCount: 100,
    rawPath: 'data/raw/australia-product-safety-recalls.json',
    processedPath: 'data/processed/australia-product-safety-recalls.json',
    existingFetchScript: 'npm run fetch:australia-product-safety',
    existingNormalizeScript: 'npm run normalize:australia-product-safety',
    existingAuditScript: 'npm run audit:australia-product-safety',
    existingUpdateScript: 'npm run update:australia-product-safety',
    backfillStatus: 'partial',
    suggestedBackfillMode: ['latest-pagination', 'detail-refresh', 'manual-source-specific'],
    outputDir: 'data/backfill/australia-product-safety',
    checkpointPath:
      'data/backfill/australia-product-safety/checkpoints/australia-product-safety-backfill-checkpoint.json',
    endpointOrInput: 'https://www.productsafety.gov.au/recalls',
    currentFetchMode:
      'Bounded official recalls listing via Drupal AJAX view, followed by official detail page extraction for the latest 100 records.',
    paginationStatus:
      'The source listing supports page/items_per_page AJAX controls; full historical pagination is not enabled in canonical data.',
    dateFilterStatus: 'Not implemented in current script; date-filter behavior should be investigated before full backfill.',
    detailRefreshStatus: 'Implemented for the bounded latest 100 records during fetch.',
    imageSupport: 'Current records can include official Product Safety Australia product image and thumbnail URLs.',
    updateScriptBehavior: 'Fetches bounded source data, normalizes, merges canonical data, and runs the Australia audit.',
    estimatedRisk: 'medium',
    riskNotes: [
      'Official RSS link currently redirects to itself; the implemented source path uses the official Drupal AJAX view instead.',
      'Full source has thousands of records and should not be merged without selection, chunking, route-count review, and build-size review.',
      'Detail pages are HTML, so selector drift should be monitored with the source-specific audit.'
    ],
    knownLimitations: [
      'No full Australia backfill.',
      'No specialist Australia food or vehicle source ingestion.',
      'No cross-source dedupe.'
    ],
    recommendedNextStep:
      'Add a dry-run Australia backfill planner that pages the official AJAX view into ignored chunks before any canonical expansion.',
    deferredWork: [
      'Full Australia backfill.',
      'Date-window strategy.',
      'Australia food/vehicle specialist sources.',
      'Cross-source dedupe.'
    ]
  },
  {
    sourceId: 'NZ_PRODUCT_SAFETY',
    outputKey: 'new-zealand-product-safety',
    label: 'New Zealand - Product Safety',
    currentCount: 100,
    rawPath: 'data/raw/new-zealand-product-safety-recalls.json',
    processedPath: 'data/processed/new-zealand-product-safety-recalls.json',
    existingFetchScript: 'npm run fetch:new-zealand-product-safety',
    existingNormalizeScript: 'npm run normalize:new-zealand-product-safety',
    existingAuditScript: 'npm run audit:new-zealand-product-safety',
    existingUpdateScript: 'npm run update:new-zealand-product-safety',
    backfillStatus: 'partial',
    suggestedBackfillMode: ['latest-pagination', 'detail-refresh', 'manual-source-specific'],
    outputDir: 'data/backfill/new-zealand-product-safety',
    checkpointPath:
      'data/backfill/new-zealand-product-safety/checkpoints/new-zealand-product-safety-backfill-checkpoint.json',
    endpointOrInput: 'https://www.productsafety.govt.nz/recalls',
    currentFetchMode:
      'Bounded official recalled-products listing pages with start pagination, followed by official detail page extraction for the latest 100 eligible product-safety records.',
    paginationStatus:
      'The source listing supports start pagination in 12-record pages; full historical pagination is not enabled in canonical data.',
    dateFilterStatus: 'Not implemented in current script; date-filter behavior should be investigated before full backfill.',
    detailRefreshStatus: 'Implemented for the bounded latest 100 records during fetch.',
    imageSupport: 'Current records can include official Product Safety New Zealand product image and thumbnail URLs.',
    updateScriptBehavior: 'Fetches bounded source data, normalizes, merges canonical data, and runs the New Zealand audit.',
    estimatedRisk: 'medium',
    riskNotes: [
      'No official JSON or RSS feed was confirmed; the current spike uses official HTML list/detail pages.',
      'Vehicle/NZTA and MedSafe-style specialist records are excluded from this product-safety source.',
      'Full source has more than a thousand records and should not be merged without selection, chunking, route-count review, and build-size review.'
    ],
    knownLimitations: [
      'No full New Zealand backfill.',
      'No specialist New Zealand food or vehicle source ingestion.',
      'No cross-source dedupe.'
    ],
    recommendedNextStep:
      'Add a dry-run New Zealand backfill planner that pages official listing results into ignored chunks before any canonical expansion.',
    deferredWork: [
      'Full New Zealand backfill.',
      'Date-window strategy.',
      'New Zealand MPI food and NZTA vehicle sources.',
      'Cross-source dedupe.'
    ]
  },
  {
    sourceId: 'HK_CFS',
    outputKey: 'hong-kong-cfs',
    label: 'Hong Kong - Centre for Food Safety',
    currentCount: 100,
    rawPath: 'data/raw/hong-kong-cfs-food-alerts.json',
    processedPath: 'data/processed/hong-kong-cfs-food-alerts.json',
    existingFetchScript: 'npm run fetch:hong-kong-cfs',
    existingNormalizeScript: 'npm run normalize:hong-kong-cfs',
    existingAuditScript: 'npm run audit:hong-kong-cfs',
    existingUpdateScript: 'npm run update:hong-kong-cfs',
    backfillStatus: 'partial',
    suggestedBackfillMode: ['latest-pagination', 'detail-refresh', 'manual-source-specific'],
    outputDir: 'data/backfill/hong-kong-cfs',
    checkpointPath: 'data/backfill/hong-kong-cfs/checkpoints/hong-kong-cfs-backfill-checkpoint.json',
    endpointOrInput: 'https://www.cfs.gov.hk/filemanager/foodalert/english/foodalert_datagovhk.xml',
    currentFetchMode:
      'Bounded latest-100 records from the official CFS DATA.GOV.HK XML feed plus annual HTML archive/detail pages.',
    paginationStatus:
      'The current spike follows official annual archive pages; a full historical backfill should chunk by year before canonical expansion.',
    dateFilterStatus: 'Not implemented in current script; official annual archive pages provide year grouping.',
    detailRefreshStatus: 'Implemented for the bounded latest 100 records during fetch.',
    imageSupport: 'The bounded CFS food alert sample does not consistently expose official product image URLs.',
    updateScriptBehavior: 'Fetches bounded source data, normalizes, merges canonical data, and runs the Hong Kong CFS audit.',
    estimatedRisk: 'medium',
    riskNotes: [
      'The official XML feed only exposes the latest small set, so the 100-record spike also uses official HTML archive/detail pages.',
      'Food alert detail fields vary by notice and may omit brand, barcode, or affected quantity.',
      'Hong Kong CFS is food-alert coverage, not all Hong Kong consumer product recalls.'
    ],
    knownLimitations: [
      'No full Hong Kong backfill.',
      'No EMSD electrical or Customs consumer goods source ingestion.',
      'No cross-source dedupe.'
    ],
    recommendedNextStep:
      'Add a dry-run Hong Kong CFS backfill planner that chunks official annual archive pages before any canonical expansion.',
    deferredWork: [
      'Full Hong Kong CFS backfill.',
      'Hong Kong EMSD electrical products source.',
      'Hong Kong Customs consumer goods source.',
      'Cross-source dedupe.'
    ]
  },
  {
    sourceId: 'FSANZ_FOOD_RECALLS',
    outputKey: 'fsanz-food-recalls',
    label: 'Australia/New Zealand - FSANZ food recalls',
    currentCount: 100,
    rawPath: 'data/raw/fsanz-food-recalls.json',
    processedPath: 'data/processed/fsanz-food-recalls.json',
    existingFetchScript: 'npm run fetch:fsanz-food-recalls',
    existingNormalizeScript: 'npm run normalize:fsanz-food-recalls',
    existingAuditScript: 'npm run audit:fsanz-food-recalls',
    existingUpdateScript: 'npm run update:fsanz-food-recalls',
    backfillStatus: 'partial',
    suggestedBackfillMode: ['latest-pagination', 'detail-refresh', 'manual-source-specific'],
    outputDir: 'data/backfill/fsanz-food-recalls',
    checkpointPath: 'data/backfill/fsanz-food-recalls/checkpoints/fsanz-food-recalls-backfill-checkpoint.json',
    endpointOrInput: 'https://www.foodstandards.gov.au/food-recalls/recall-alert',
    currentFetchMode:
      'Bounded latest-100 records from the official FSANZ food recall listing pages plus official detail pages; RSS is used as supplemental latest metadata.',
    paginationStatus:
      'The official listing supports page pagination in 25-record pages; full historical pagination is not enabled in canonical data.',
    dateFilterStatus: 'Not implemented in current script; date/filter behavior should be investigated before full backfill.',
    detailRefreshStatus: 'Implemented for the bounded latest 100 records during fetch.',
    imageSupport: 'Current records can include official foodstandards.gov.au product image and thumbnail URLs.',
    updateScriptBehavior: 'Fetches bounded source data, normalizes, merges canonical data, and runs the FSANZ audit.',
    estimatedRisk: 'medium',
    riskNotes: [
      'The RSS feed exposes only a small latest set, so the bounded spike uses official HTML pagination.',
      'Food recall detail fields vary by notice and may omit barcode, batch, or pack details.',
      'FSANZ is food recall coverage, not all Australia or New Zealand product recalls.'
    ],
    knownLimitations: [
      'No full FSANZ backfill.',
      'No Australia FSANZ non-food source because FSANZ is food-specific.',
      'No cross-source dedupe.'
    ],
    recommendedNextStep:
      'Add a dry-run FSANZ backfill planner that chunks official listing pages before any canonical expansion.',
    deferredWork: [
      'Full FSANZ backfill.',
      'Date-window strategy.',
      'Cross-source dedupe.'
    ]
  }
];

export function getSourceBackfillEntry(sourceId: string): SourceBackfillRegistryEntry | undefined {
  return sourceBackfillRegistry.find((entry) => entry.sourceId === sourceId);
}
