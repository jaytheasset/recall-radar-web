export type BalancedRecentRecallCandidate = {
  id: string;
  source: string;
  recallDate: string;
  category: string;
  primaryImageUrl?: string;
  primaryImageThumbnailUrl?: string;
  images?: Array<{
    url?: string;
    thumbnailUrl?: string;
  }>;
};

type BalancedRecentOptions = {
  limit?: number;
  firstPassSourceCap?: number;
  fillSourceCap?: number;
  imagePreferenceWindow?: number;
};

function sortByDateDescending<T extends BalancedRecentRecallCandidate>(left: T, right: T): number {
  const dateDifference = right.recallDate.localeCompare(left.recallDate);
  return dateDifference === 0 ? left.id.localeCompare(right.id) : dateDifference;
}

export function hasBalancedRecentImage(recall: BalancedRecentRecallCandidate): boolean {
  return Boolean(
    recall.primaryImageUrl ||
      recall.primaryImageThumbnailUrl ||
      recall.images?.some((image) => image.url || image.thumbnailUrl)
  );
}

function rankSourceCandidates<T extends BalancedRecentRecallCandidate>(
  candidates: T[],
  imagePreferenceWindow: number
): T[] {
  const sorted = [...candidates].sort(sortByDateDescending);
  const recentWindow = sorted.slice(0, imagePreferenceWindow);
  const remaining = sorted.slice(imagePreferenceWindow);
  const withImages = recentWindow.filter(hasBalancedRecentImage);
  const withoutImages = recentWindow.filter((recall) => !hasBalancedRecentImage(recall));

  return [...withImages, ...withoutImages, ...remaining];
}

function sourceCounts<T extends BalancedRecentRecallCandidate>(recalls: T[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const recall of recalls) {
    counts.set(recall.source, (counts.get(recall.source) ?? 0) + 1);
  }

  return counts;
}

export function getBalancedRecentRecalls<T extends BalancedRecentRecallCandidate>(
  recalls: T[],
  options: BalancedRecentOptions = {}
): T[] {
  const limit = options.limit ?? 12;
  if (limit <= 0) {
    return [];
  }

  const firstPassSourceCap = options.firstPassSourceCap ?? 2;
  const fillSourceCap = options.fillSourceCap ?? 3;
  const imagePreferenceWindow = options.imagePreferenceWindow ?? 8;
  const sorted = [...recalls].sort(sortByDateDescending);
  const groupedBySource = new Map<string, T[]>();

  for (const recall of sorted) {
    const sourceGroup = groupedBySource.get(recall.source) ?? [];
    sourceGroup.push(recall);
    groupedBySource.set(recall.source, sourceGroup);
  }

  const sourceOrder = [...groupedBySource.keys()].sort((leftSource, rightSource) => {
    const leftLatest = groupedBySource.get(leftSource)?.[0];
    const rightLatest = groupedBySource.get(rightSource)?.[0];

    if (!leftLatest || !rightLatest) {
      return leftSource.localeCompare(rightSource);
    }

    return sortByDateDescending(leftLatest, rightLatest);
  });
  const rankedGroups = new Map(
    [...groupedBySource.entries()].map(([source, group]) => [
      source,
      rankSourceCandidates(group, imagePreferenceWindow)
    ])
  );
  const selected: T[] = [];
  const selectedIds = new Set<string>();

  function addCandidate(candidate: T | undefined): void {
    if (!candidate || selected.length >= limit || selectedIds.has(candidate.id)) {
      return;
    }

    selected.push(candidate);
    selectedIds.add(candidate.id);
  }

  for (let sourceSlot = 0; sourceSlot < firstPassSourceCap && selected.length < limit; sourceSlot += 1) {
    for (const source of sourceOrder) {
      addCandidate(rankedGroups.get(source)?.[sourceSlot]);

      if (selected.length >= limit) {
        break;
      }
    }
  }

  function fillBySourceCap(cap: number): void {
    for (const candidate of sorted) {
      if (selected.length >= limit) {
        break;
      }

      const counts = sourceCounts(selected);
      if ((counts.get(candidate.source) ?? 0) < cap) {
        addCandidate(candidate);
      }
    }
  }

  fillBySourceCap(fillSourceCap);

  for (const candidate of sorted) {
    addCandidate(candidate);

    if (selected.length >= limit) {
      break;
    }
  }

  return selected.sort(sortByDateDescending).slice(0, limit);
}
