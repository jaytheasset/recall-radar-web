import type { NormalizedRecall, RecallImage } from '../data/recall-types.ts';

const imageSources = new Set<NormalizedRecall['source']>([
  'CPSC', 'FR_RAPPELCONSO', 'CA_RECALLS', 'EU_SAFETY_GATE',
  'AU_PRODUCT_SAFETY', 'NZ_PRODUCT_SAFETY', 'HK_CFS', 'FSANZ_FOOD_RECALLS'
]);

const officialImagePaths = [
  /^https:\/\/www\.cpsc\.gov\//i,
  /^https:\/\/rappel\.conso\.gouv\.fr\/image\//i,
  /^https:\/\/(?:recalls-rappels\.canada\.ca|www\.canada\.ca)\/sites\/default\/files\/(?:styles\/[^/]+\/)?public\/alert\/recall\//i,
  /^https:\/\/ec\.europa\.eu\/safety-gate-alerts\/public\/api\/notification\/(?:image|thumbnail)\//i,
  /^https:\/\/www\.productsafety\.gov\.au\/system\/files\/(?:styles\/[^/]+\/)?(?:public|private)\//i,
  /^https:\/\/www\.productsafety\.govt\.nz\/assets\/uploads\//i,
  /^https:\/\/www\.cfs\.gov\.hk\//i,
  /^https:\/\/www\.foodstandards\.gov\.au\/sites\/default\/files\/(?:styles\/[^/]+\/)?public\//i
];

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function officialRecallImageUrl(value: unknown): string | undefined {
  const address = text(value);
  if (!address) return;
  try {
    const url = new URL(address);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return;
    if (url.hostname === 'cpsc.gov') url.hostname = 'www.cpsc.gov';
    url.hash = '';
    return officialImagePaths.some((pattern) => pattern.test(url.href)) ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export function officialRecallImages(record: NormalizedRecall): RecallImage[] {
  if (!imageSources.has(record.source)) return [];
  const raw = record.raw as { Images?: unknown[] } | undefined;
  const directImages = Array.isArray(record.images) ? record.images : [];
  const rawImages = Array.isArray(raw?.Images) ? raw.Images : [];
  const result = new Map<string, RecallImage>();
  for (const value of [...directImages, ...rawImages]) {
    if (!value || typeof value !== 'object') continue;
    const image = value as Record<string, unknown>;
    const url = officialRecallImageUrl(text(image.url) || image.URL);
    if (!url || result.has(url)) continue;
    const thumbnailUrl = officialRecallImageUrl(text(image.thumbnailUrl) || text(image.thumbnailURL) || image.ThumbnailURL);
    const caption = text(image.caption) || text(image.Caption);
    const alt = text(image.alt) || text(image.AltText) || caption || `${record.title} recall product image`;
    result.set(url, { url, thumbnailUrl, caption: caption || undefined, alt });
  }
  if (!result.size) {
    const url = officialRecallImageUrl(record.primaryImageUrl);
    if (url) result.set(url, {
      url,
      thumbnailUrl: officialRecallImageUrl(record.primaryImageThumbnailUrl),
      alt: record.title
    });
  }
  return [...result.values()];
}
