import { readFile } from 'node:fs/promises';
import { canonicalProcessedPath, mergeProcessedRecalls } from './merge-recalls.ts';
import { enrichCanadaRecordsWithDetailImages } from './canada-detail-images.ts';
import {
  defaultCanadaProcessedPath,
  defaultRawCanadaRecallsPath,
  extractCanadaRecallRecords,
  writeNormalizedCanadaRecalls
} from './normalize-canada-recalls.ts';
import { writeJsonAtomic } from './normalize-cpsc.ts';

type RawCanadaFile = {
  fetchedAt?: unknown;
  source?: unknown;
  endpoint?: unknown;
  limit?: unknown;
  totalAvailable?: unknown;
  count?: unknown;
  records?: unknown;
};

async function run(): Promise<void> {
  const rawText = await readFile(defaultRawCanadaRecallsPath, 'utf8');
  const rawPayload = JSON.parse(rawText) as RawCanadaFile;
  const records = extractCanadaRecallRecords(rawPayload);

  if (records.length === 0) {
    throw new Error('No Canada raw records found; detail image metadata was not updated.');
  }

  const { records: enrichedRecords, results } = await enrichCanadaRecordsWithDetailImages(records);
  const recordsWithImages = enrichedRecords.filter((record) => Array.isArray(record.Images) && record.Images.length > 0);
  const detailImagesFetchedAt = new Date().toISOString();

  await writeJsonAtomic(defaultRawCanadaRecallsPath, {
    ...rawPayload,
    detailImagesFetchedAt,
    detailImageSource: 'official Canada recall detail pages',
    count: enrichedRecords.length,
    records: enrichedRecords
  });

  const processed = await writeNormalizedCanadaRecalls(enrichedRecords, defaultCanadaProcessedPath);
  const merged = await mergeProcessedRecalls();
  const sample = processed.records.find((record) => record.primaryImageUrl);

  console.log(
    JSON.stringify(
      {
        detailImagesFetchedAt,
        rawPath: defaultRawCanadaRecallsPath,
        processedPath: defaultCanadaProcessedPath,
        canonicalPath: canonicalProcessedPath,
        detailPagesChecked: results.length,
        detailPagesFetched: results.filter((result) => result.ok).length,
        detailPageFetchFailures: results.filter((result) => !result.ok).length,
        rawRecordsSaved: enrichedRecords.length,
        rawRecordsWithImages: recordsWithImages.length,
        normalizedRecordsSaved: processed.count,
        normalizedRecordsWithPrimaryImageUrl: processed.records.filter((record) => record.primaryImageUrl).length,
        mergedRecordsSaved: merged.count,
        countsBySource: merged.countsBySource,
        sample: sample
          ? {
              id: sample.id,
              source: sample.source,
              sourceUrl: sample.sourceUrl,
              title: sample.title,
              primaryImageUrl: sample.primaryImageUrl,
              primaryImageThumbnailUrl: sample.primaryImageThumbnailUrl,
              primaryImageAlt: sample.primaryImageAlt,
              images: sample.images?.length ?? 0,
              slug: sample.slug
            }
          : null
      },
      null,
      2
    )
  );
}

run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
