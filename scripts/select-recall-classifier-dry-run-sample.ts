import type { NormalizedRecall } from '../src/data/recall-types.ts';

export type DryRunSampleSelection = {
  records: NormalizedRecall[];
  forcedIds: string[];
  notes: string[];
};

const sourceOrder = [
  'CPSC',
  'FDA',
  'FR_RAPPELCONSO',
  'CA_RECALLS',
  'EU_SAFETY_GATE',
  'UK_FSA',
  'AU_PRODUCT_SAFETY',
  'NZ_PRODUCT_SAFETY',
  'HK_CFS',
  'FSANZ_FOOD_RECALLS'
] as const;

function normalize(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

function searchText(record: NormalizedRecall): string {
  return normalize([
    record.source,
    record.title,
    record.category,
    record.hazard,
    record.reason ?? '',
    record.remedy,
    record.description,
    record.distributionPattern ?? '',
    record.productQuantity ?? '',
    ...record.productNames,
    ...record.brandNames
  ].join(' '));
}

function hasImage(record: NormalizedRecall): boolean {
  return Boolean(record.primaryImageUrl || record.primaryImageThumbnailUrl || (Array.isArray(record.images) && record.images.length > 0));
}

function pushUnique(target: NormalizedRecall[], record: NormalizedRecall | undefined, forcedIds: string[] = []): void {
  if (!record || target.some((item) => item.id === record.id)) {
    return;
  }
  target.push(record);
  forcedIds.push(record.id);
}

function findByText(records: NormalizedRecall[], terms: string[]): NormalizedRecall | undefined {
  return records.find((record) => {
    const text = searchText(record);
    return terms.some((term) => text.includes(term));
  });
}

function findKnownSuspiciousVehicleCase(records: NormalizedRecall[]): NormalizedRecall | undefined {
  return (
    records.find((record) => {
      const text = searchText(record);
      return text.includes('yamaha') && (text.includes('umax') || text.includes('bistro'));
    }) ??
    records.find((record) => {
      const text = searchText(record);
      return (text.includes('umax') || text.includes('bistro')) && (text.includes('golf') || text.includes('utility'));
    }) ??
    findByText(records, ['yamaha umax', 'umax bistro', 'bistro deluxe', 'golf cart', 'golf car', 'utility vehicle'])
  );
}

function addRoundRobinBySource(target: NormalizedRecall[], records: NormalizedRecall[], limit: number): void {
  let index = 0;
  while (target.length < limit) {
    let added = false;
    for (const source of sourceOrder) {
      const sourceRecords = records.filter((record) => record.source === source);
      const candidate = sourceRecords[index];
      if (candidate && !target.some((record) => record.id === candidate.id)) {
        target.push(candidate);
        added = true;
        if (target.length >= limit) {
          return;
        }
      }
    }
    if (!added) {
      break;
    }
    index += 1;
  }

  for (const record of records) {
    if (target.length >= limit) {
      return;
    }
    if (!target.some((item) => item.id === record.id)) {
      target.push(record);
    }
  }
}

export function selectRecallClassifierDryRunSample(records: NormalizedRecall[], limit = 100): DryRunSampleSelection {
  const selected: NormalizedRecall[] = [];
  const forcedIds: string[] = [];
  const notes: string[] = [];
  const cappedLimit = Math.max(1, Math.min(limit, records.length));

  pushUnique(selected, findKnownSuspiciousVehicleCase(records), forcedIds);
  if (forcedIds.length) {
    notes.push('Forced at least one Yamaha/UMAX/Bistro/golf/utility vehicle suspicious case.');
  } else {
    notes.push('No Yamaha/UMAX/Bistro/golf/utility vehicle suspicious case found in current data.');
  }

  for (const source of sourceOrder) {
    pushUnique(selected, records.find((record) => record.source === source), forcedIds);
  }
  notes.push('Forced source coverage for all available active sources.');

  const categories = [...new Set(records.map((record) => record.category).filter(Boolean))];
  for (const category of categories) {
    if (selected.length >= cappedLimit) {
      break;
    }
    pushUnique(selected, records.find((record) => record.category === category), forcedIds);
  }
  notes.push(`Attempted legacy category coverage across ${categories.length} raw category values.`);

  const foodSources = ['FDA', 'UK_FSA', 'HK_CFS', 'FSANZ_FOOD_RECALLS'];
  for (const source of foodSources) {
    pushUnique(selected, records.find((record) => record.source === source), forcedIds);
    pushUnique(
      selected,
      records.find((record) => record.source === source && /salmonella|listeria|e coli|foreign|glass|metal|ethylene oxide|mercury|contamination/i.test(searchText(record))),
      forcedIds
    );
  }
  notes.push('Forced food source records plus contamination or foreign-matter examples when available.');

  for (const source of ['CPSC', 'AU_PRODUCT_SAFETY', 'NZ_PRODUCT_SAFETY', 'EU_SAFETY_GATE', 'CA_RECALLS', 'FR_RAPPELCONSO']) {
    pushUnique(selected, records.find((record) => record.source === source), forcedIds);
  }
  notes.push('Forced general product source records.');

  pushUnique(selected, records.find((record) => hasImage(record)), forcedIds);
  pushUnique(selected, records.find((record) => !hasImage(record)), forcedIds);
  notes.push('Forced image-backed and image-less examples when available.');

  const edgeMatchers = [
    ['food-allergy', 'cpsc'],
    ['food-allergy'],
    ['kitchen'],
    ['bistro'],
    ['restaurant'],
    ['home'],
    ['utility'],
    ['choking'],
    ['power bank'],
    ['battery overheat'],
    ['tip over', 'tip-over'],
    ['chemical exposure']
  ];
  for (const terms of edgeMatchers) {
    if (selected.length >= cappedLimit) {
      break;
    }
    pushUnique(
      selected,
      records.find((record) => {
        const text = searchText(record);
        return terms.every((term) => text.includes(term));
      }),
      forcedIds
    );
  }
  notes.push('Forced ambiguous words and legacy edge cases for review sampling only.');

  if (selected.length > cappedLimit) {
    selected.length = cappedLimit;
  }

  addRoundRobinBySource(selected, records, cappedLimit);

  return {
    records: selected.slice(0, cappedLimit),
    forcedIds: [...new Set(forcedIds)].filter((id) => selected.some((record) => record.id === id)),
    notes
  };
}
