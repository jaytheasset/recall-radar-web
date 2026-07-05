import {
  extractCanadaDetailPage,
  isOfficialCanadaImageUrl,
  isSuspectedCanadaChromeImage
} from './canada-detail-images.ts';

const sampleUrl =
  'https://recalls-rappels.canada.ca/en/alert-recall/ipex-cement-and-primer-products-recalled-due-improper-labelling-and-lack-child';

function assert(condition: boolean, message: string, blockers: string[]): void {
  if (!condition) {
    blockers.push(message);
  }
}

async function fetchSampleHtml(): Promise<{ status: number; html: string }> {
  const response = await fetch(sampleUrl, {
    headers: {
      accept: 'text/html,*/*',
      'user-agent': 'Recall Radar Canada detail parser audit'
    }
  });
  const html = await response.text();

  if (!response.ok) {
    throw new Error(`Canada detail parser sample returned HTTP ${response.status} ${response.statusText}.`);
  }

  if (!html.trim()) {
    throw new Error('Canada detail parser sample returned an empty body.');
  }

  return { status: response.status, html };
}

async function runAudit(): Promise<void> {
  const blockers: string[] = [];
  const { status, html } = await fetchSampleHtml();
  const detail = extractCanadaDetailPage(html, sampleUrl);
  const products = detail.affectedProducts;
  const imageUrls = detail.images.flatMap((image) => [image.url, image.thumbnailUrl].filter(Boolean) as string[]);

  assert(detail.sourceUrl === sampleUrl, 'Detail parser should preserve the source URL.', blockers);
  assert(detail.title?.startsWith('IPEX cement and primer products') === true, 'Detail parser should extract the IPEX title.', blockers);
  assert(detail.recallType === 'Consumer product recall', 'Detail parser should extract recall type.', blockers);
  assert(detail.lastUpdated === '2026-06-30', 'Detail parser should extract last updated date.', blockers);
  assert(detail.brandNames.includes('IPEX'), 'Detail parser should extract IPEX brand.', blockers);
  assert(detail.summary.product === 'IPEX chemical products', 'Detail parser should extract summary product.', blockers);
  assert(
    detail.summary.issue === 'Consumer products - Labelling and packaging',
    'Detail parser should extract summary issue.',
    blockers
  );
  assert(
    detail.summary.action?.startsWith('Immediately stop using the recalled products') === true,
    'Detail parser should extract summary action.',
    blockers
  );
  assert(detail.affectedProductsHeader?.includes('IPEX cement and primer products') === true, 'Detail parser should extract affected-products intro.', blockers);
  assert(detail.affectedProductsCaption === 'The following products are affected:', 'Detail parser should extract table caption.', blockers);
  assert(products.length === 15, `Detail parser should extract 15 affected product rows, found ${products.length}.`, blockers);
  assert(
    products.some(
      (product) =>
        product.product === 'ABS DWV Cement Medium Bodied Yellow 946ml' &&
        product.partNumber === '074180' &&
        product.upc === '622454741805'
    ),
    'Detail parser should extract product, part number, and UPC from the affected products table.',
    blockers
  );
  assert(detail.images.length >= 12, `Detail parser should extract at least 12 official product images, found ${detail.images.length}.`, blockers);
  assert(imageUrls.every(isOfficialCanadaImageUrl), 'Detail parser should keep only official Canada product image URLs.', blockers);
  assert(!imageUrls.some(isSuspectedCanadaChromeImage), 'Detail parser should not include Canada page chrome/logo images.', blockers);

  const passed = blockers.length === 0;
  console.log(
    JSON.stringify(
      {
        passed,
        blockers,
        sampleUrl,
        httpStatus: status,
        parsed: {
          title: detail.title,
          recallType: detail.recallType,
          lastUpdated: detail.lastUpdated,
          brandNames: detail.brandNames,
          summary: detail.summary,
          affectedProductsHeader: detail.affectedProductsHeader,
          affectedProductsCaption: detail.affectedProductsCaption,
          affectedProductRows: products.length,
          images: detail.images.length,
          sampleAffectedProducts: products.slice(0, 5),
          sampleImage: detail.images[0] ?? null
        }
      },
      null,
      2
    )
  );

  if (!passed) {
    process.exitCode = 1;
  }
}

runAudit().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
