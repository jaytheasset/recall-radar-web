export type BalancedRecentRecallCandidate = {
  id: string;
  source: string;
  recallDate: string;
  category: string;
  taxonomyProductFamily?: string;
  primaryImageUrl?: string;
  primaryImageThumbnailUrl?: string;
  images?: Array<{
    url?: string;
    thumbnailUrl?: string;
  }>;
  raw?: unknown;
};

type BalancedRecentOptions = {
  limit?: number;
  imageSourceCap?: number;
  imageSoftSourceCap?: number;
  imageProductFamilyCap?: number;
  imageSoftProductFamilyCap?: number;
};

function sortByDateDescending<T extends BalancedRecentRecallCandidate>(left: T, right: T): number {
  const dateDifference = right.recallDate.localeCompare(left.recallDate);
  return dateDifference === 0 ? left.id.localeCompare(right.id) : dateDifference;
}

export function hasBalancedRecentImage(recall: BalancedRecentRecallCandidate): boolean {
  return Boolean(
    recall.primaryImageUrl ||
      recall.primaryImageThumbnailUrl ||
      recall.images?.some((image) => image.url || image.thumbnailUrl) ||
      extractRawImages(recall.raw).some((image) => image.url || image.thumbnailUrl)
  );
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function safeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function extractRawImages(raw: unknown): Array<{ url?: string; thumbnailUrl?: string }> {
  if (!isObject(raw) || !Array.isArray(raw.Images)) {
    return [];
  }

  return raw.Images.filter(isObject).map((image) => {
    const url = safeText(image.url) || safeText(image.URL);
    const thumbnailUrl = safeText(image.thumbnailUrl) || safeText(image.thumbnailURL) || safeText(image.ThumbnailURL);

    return {
      ...(url ? { url } : {}),
      ...(thumbnailUrl ? { thumbnailUrl } : {})
    };
  });
}

function sourceCounts<T extends BalancedRecentRecallCandidate>(recalls: T[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const recall of recalls) {
    counts.set(recall.source, (counts.get(recall.source) ?? 0) + 1);
  }

  return counts;
}

function productFamilyFor(recall: BalancedRecentRecallCandidate): string {
  return recall.taxonomyProductFamily || recall.category || 'Uncategorized';
}

function productFamilyCounts<T extends BalancedRecentRecallCandidate>(recalls: T[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const recall of recalls) {
    const family = productFamilyFor(recall);
    counts.set(family, (counts.get(family) ?? 0) + 1);
  }

  return counts;
}

function fillFromCandidates<T extends BalancedRecentRecallCandidate>(
  selected: T[],
  selectedIds: Set<string>,
  candidates: T[],
  limit: number,
  sourceCap?: number,
  productFamilyCap?: number
): void {
  for (const candidate of candidates) {
    if (selected.length >= limit) {
      break;
    }

    if (selectedIds.has(candidate.id)) {
      continue;
    }

    if (sourceCap !== undefined) {
      const counts = sourceCounts(selected);
      if ((counts.get(candidate.source) ?? 0) >= sourceCap) {
        continue;
      }
    }

    if (productFamilyCap !== undefined) {
      const counts = productFamilyCounts(selected);
      if ((counts.get(productFamilyFor(candidate)) ?? 0) >= productFamilyCap) {
        continue;
      }
    }

    selected.push(candidate);
    selectedIds.add(candidate.id);
  }
}

export function getBalancedRecentRecalls<T extends BalancedRecentRecallCandidate>(
  recalls: T[],
  options: BalancedRecentOptions = {}
): T[] {
  const limit = options.limit ?? 12;
  if (limit <= 0) {
    return [];
  }

  const imageSourceCap = options.imageSourceCap ?? 3;
  const imageSoftSourceCap = options.imageSoftSourceCap ?? 5;
  const imageProductFamilyCap = options.imageProductFamilyCap ?? 3;
  const imageSoftProductFamilyCap = options.imageSoftProductFamilyCap ?? 5;
  const sorted = [...recalls].sort(sortByDateDescending);
  const imageBacked = sorted.filter(hasBalancedRecentImage);
  const imageLess = sorted.filter((recall) => !hasBalancedRecentImage(recall));
  const selected: T[] = [];
  const selectedIds = new Set<string>();

  fillFromCandidates(selected, selectedIds, imageBacked, limit, imageSourceCap, imageProductFamilyCap);
  fillFromCandidates(selected, selectedIds, imageBacked, limit, imageSoftSourceCap, imageSoftProductFamilyCap);
  fillFromCandidates(selected, selectedIds, imageBacked, limit);
  fillFromCandidates(selected, selectedIds, imageLess, limit);

  return selected.sort(sortByDateDescending).slice(0, limit);
}
