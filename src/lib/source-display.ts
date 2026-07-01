export type RecallSourceDisplay = {
  source: string;
  market: string;
  agency: string;
  label: string;
  productType: string;
};

const SOURCE_DISPLAYS: Record<string, RecallSourceDisplay> = {
  CPSC: {
    source: 'CPSC',
    market: 'United States',
    agency: 'CPSC',
    label: 'United States · CPSC',
    productType: 'Consumer products'
  },
  FDA: {
    source: 'FDA',
    market: 'United States',
    agency: 'FDA / openFDA',
    label: 'United States · FDA / openFDA',
    productType: 'Food and enforcement notices'
  },
  Mock: {
    source: 'Mock',
    market: 'Demo',
    agency: 'Sample notices',
    label: 'Demo source',
    productType: 'Sample notices'
  }
};

export function sourceDisplayForSource(source: string): RecallSourceDisplay {
  return (
    SOURCE_DISPLAYS[source] ?? {
      source,
      market: 'Source',
      agency: source,
      label: source,
      productType: 'Recall notices'
    }
  );
}

export function sourceLabelForSource(source: string): string {
  return sourceDisplayForSource(source).label;
}

export function sourceOptionLabelForSource(source: string): string {
  const display = sourceDisplayForSource(source);
  return `${display.market} · ${display.agency}`;
}

export function officialNoticeLinkLabel(): string {
  return 'View official notice';
}
