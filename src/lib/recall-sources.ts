export type RecallSourceId = 'CPSC' | 'FDA' | 'Mock';
export type CurrentCoverageSourceId = Exclude<RecallSourceId, 'Mock'>;

export type RecallSourceOption = {
  value: CurrentCoverageSourceId;
  label: string;
};

export type RecallSourceConfig = {
  id: RecallSourceId;
  marketCode: string;
  marketLabel: string;
  agencyLabel: string;
  displayLabel: string;
  noticeTypeLabel: string;
  productScopeLabel: string;
  officialSourceLabel: string;
  placeholderLabel: string;
  reasonLabel: string;
  actionLabel: string;
  defaultActionFallback: string;
};

const DEFAULT_ACTION_FALLBACK = 'Review the official notice for current instructions.';

const sourceConfigs: Record<RecallSourceId, RecallSourceConfig> = {
  CPSC: {
    id: 'CPSC',
    marketCode: 'US',
    marketLabel: 'United States',
    agencyLabel: 'CPSC',
    displayLabel: 'United States · CPSC',
    noticeTypeLabel: 'Consumer product notice',
    productScopeLabel: 'Consumer products',
    officialSourceLabel: 'Source: United States · CPSC',
    placeholderLabel: 'Recall notice',
    reasonLabel: 'Hazard',
    actionLabel: 'Action',
    defaultActionFallback: DEFAULT_ACTION_FALLBACK
  },
  FDA: {
    id: 'FDA',
    marketCode: 'US',
    marketLabel: 'United States',
    agencyLabel: 'FDA / openFDA',
    displayLabel: 'United States · FDA / openFDA',
    noticeTypeLabel: 'Food enforcement notice',
    productScopeLabel: 'Food and enforcement',
    officialSourceLabel: 'Source: United States · FDA / openFDA',
    placeholderLabel: 'FDA food notice',
    reasonLabel: 'Reason',
    actionLabel: 'Action',
    defaultActionFallback: DEFAULT_ACTION_FALLBACK
  },
  Mock: {
    id: 'Mock',
    marketCode: '',
    marketLabel: '',
    agencyLabel: '',
    displayLabel: 'Sample notice',
    noticeTypeLabel: 'Sample notice',
    productScopeLabel: 'Sample products',
    officialSourceLabel: 'Source: Sample notice',
    placeholderLabel: 'Recall notice',
    reasonLabel: 'Reason',
    actionLabel: 'Action',
    defaultActionFallback: DEFAULT_ACTION_FALLBACK
  }
};

const currentCoverageSources: CurrentCoverageSourceId[] = ['CPSC', 'FDA'];

function normalizeSourceId(source: string): RecallSourceId {
  return source === 'CPSC' || source === 'FDA' || source === 'Mock' ? source : 'Mock';
}

export function getRecallSourceConfig(source: string): RecallSourceConfig {
  return sourceConfigs[normalizeSourceId(source)];
}

export function getRecallSourceLabel(source: string): string {
  return getRecallSourceConfig(source).displayLabel;
}

export function getRecallSourcePlaceholder(source: string): string {
  return getRecallSourceConfig(source).placeholderLabel;
}

export function getRecallReasonLabel(source: string): string {
  return getRecallSourceConfig(source).reasonLabel;
}

export function getRecallActionLabel(source: string): string {
  return getRecallSourceConfig(source).actionLabel;
}

export function getRecallDefaultActionFallback(source: string): string {
  return getRecallSourceConfig(source).defaultActionFallback;
}

export function getOfficialSourceLabel(source: string): string {
  return getRecallSourceConfig(source).officialSourceLabel;
}

export function getSourceOptionsForCurrentCoverage(): RecallSourceOption[] {
  return currentCoverageSources.map((source) => ({
    value: source,
    label: getRecallSourceLabel(source)
  }));
}
