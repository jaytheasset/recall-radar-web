import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NormalizedRecall, ProcessedRecallFile, RecallImage } from '../src/data/recall-types.ts';
import { slugify } from '../src/lib/slug.ts';
import { canonicalProcessedPath, mergeProcessedRecalls, rappelConsoProcessedPath } from './merge-recalls.ts';
import { writeJsonAtomic } from './normalize-cpsc.ts';

export type RappelConsoRaw = {
  id?: unknown;
  numero_fiche?: unknown;
  numero_version?: unknown;
  rappel_guid?: unknown;
  date_publication?: unknown;
  nature_juridique_rappel?: unknown;
  categorie_produit?: unknown;
  sous_categorie_produit?: unknown;
  marque_produit?: unknown;
  modeles_ou_references?: unknown;
  identification_produits?: unknown;
  conditionnements?: unknown;
  date_debut_commercialisation?: unknown;
  date_date_fin_commercialisation?: unknown;
  zone_geographique_de_vente?: unknown;
  distributeurs?: unknown;
  motif_rappel?: unknown;
  risques_encourus?: unknown;
  preconisations_sanitaires?: unknown;
  description_complementaire_risque?: unknown;
  conduites_a_tenir_par_le_consommateur?: unknown;
  modalites_de_compensation?: unknown;
  date_de_fin_de_la_procedure_de_rappel?: unknown;
  informations_complementaires?: unknown;
  informations_complementaires_publiques?: unknown;
  liens_vers_les_images?: unknown;
  lien_vers_la_fiche_rappel?: unknown;
  lien_vers_affichette_pdf?: unknown;
  libelle?: unknown;
};

type RawRappelConsoFile = {
  fetchedAt?: unknown;
  endpoint?: unknown;
  count?: unknown;
  records?: unknown;
  results?: unknown;
};

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
export const defaultRawRappelConsoPath = resolve(projectRoot, 'data/raw/rappelconso-recalls.json');
export const defaultRappelConsoProcessedPath = rappelConsoProcessedPath;

function asString(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number'
    ? String(value).replace(/\s+/g, ' ').trim()
    : '';
}

function firstNonEmpty(values: unknown[], fallback = ''): string {
  for (const value of values) {
    const text = asString(value);
    if (text) {
      return text;
    }
  }

  return fallback;
}

function uniqueNonEmpty(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function splitMultiValue(value: unknown): string[] {
  if (Array.isArray(value)) {
    return uniqueNonEmpty(value.flatMap((item) => splitMultiValue(item)));
  }

  const text = asString(value);
  if (!text) {
    return [];
  }

  return uniqueNonEmpty(
    text
      .split(/[|¤\n;]/)
      .map((item) => item.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
  );
}

function normalizeDate(value: unknown): string {
  const text = asString(value);
  if (!text) {
    return '';
  }

  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? text.slice(0, 10) : date.toISOString().slice(0, 10);
}

function truncateText(value: string, maxLength = 220): string {
  if (value.length <= maxLength) {
    return value;
  }

  const truncated = value.slice(0, maxLength);
  const wordBoundary = truncated.lastIndexOf(' ');
  return `${truncated.slice(0, wordBoundary > 60 ? wordBoundary : maxLength).trim()}...`;
}

function officialImageUrls(value: unknown): RecallImage[] {
  return splitMultiValue(value)
    .filter((url) => /^https:\/\/rappel\.conso\.gouv\.fr\/image\//i.test(url))
    .map((url) => ({
      url,
      caption: 'RappelConso product image',
      alt: 'RappelConso recalled product image'
    }));
}

function fallbackId(raw: RappelConsoRaw, title: string): string {
  return firstNonEmpty(
    [raw.numero_fiche, raw.rappel_guid, raw.id],
    slugify(title).slice(0, 72) || 'unknown'
  );
}

function categoryFor(raw: RappelConsoRaw): string {
  return firstNonEmpty([raw.categorie_produit, raw.sous_categorie_produit], 'produit');
}

function sourceUrlFor(raw: RappelConsoRaw): string {
  const directUrl = asString(raw.lien_vers_la_fiche_rappel);
  if (directUrl) {
    return directUrl;
  }

  const id = asString(raw.id);
  return id ? `https://rappel.conso.gouv.fr/fiche-rappel/${id}/interne` : 'https://rappel.conso.gouv.fr/';
}

function descriptionFor(raw: RappelConsoRaw, identifiers: string[]): string {
  return uniqueNonEmpty([
    asString(raw.modeles_ou_references),
    identifiers.length ? `Identifiers: ${identifiers.join(', ')}` : '',
    asString(raw.conditionnements),
    asString(raw.informations_complementaires),
    asString(raw.motif_rappel),
    asString(raw.risques_encourus),
    asString(raw.description_complementaire_risque),
    asString(raw.zone_geographique_de_vente),
    asString(raw.distributeurs)
  ]).join(' ');
}

export function normalizeRappelConsoRecords(records: RappelConsoRaw[]): NormalizedRecall[] {
  return records
    .map((raw) => {
      const productName = firstNonEmpty([raw.libelle, raw.modeles_ou_references], 'RappelConso product');
      const brandName = firstNonEmpty([raw.marque_produit, raw.distributeurs], 'RappelConso');
      const identifiers = splitMultiValue(raw.identification_produits);
      const recallNumber = firstNonEmpty([raw.numero_fiche, raw.rappel_guid, raw.id]);
      const id = `fr-rappelconso-${fallbackId(raw, `${brandName}-${productName}`)}`;
      const title = truncateText(uniqueNonEmpty([brandName, productName]).join(' - '), 140);
      const reason = firstNonEmpty([raw.motif_rappel, raw.risques_encourus], 'Reason not listed.');
      const risk = firstNonEmpty([raw.risques_encourus, raw.description_complementaire_risque]);
      const remedy = uniqueNonEmpty([
        ...splitMultiValue(raw.conduites_a_tenir_par_le_consommateur),
        asString(raw.modalites_de_compensation),
        asString(raw.preconisations_sanitaires)
      ]).join('; ');
      const distributionPattern = uniqueNonEmpty([
        asString(raw.zone_geographique_de_vente),
        asString(raw.distributeurs)
      ]).join(' ');
      const description = descriptionFor(raw, identifiers);
      const images = officialImageUrls(raw.liens_vers_les_images);

      return {
        id,
        source: 'FR_RAPPELCONSO',
        sourceUrl: sourceUrlFor(raw),
        title,
        brandNames: uniqueNonEmpty([brandName]),
        productNames: uniqueNonEmpty([productName, asString(raw.modeles_ou_references), ...identifiers]),
        category: categoryFor(raw),
        hazard: risk || reason,
        remedy,
        recallDate: normalizeDate(raw.date_publication),
        affectedUnits: asString(raw.conditionnements),
        description,
        slug: slugify(`${title}-${id}`),
        classification: asString(raw.nature_juridique_rappel),
        reason,
        distributionPattern,
        productQuantity: asString(raw.conditionnements),
        recallNumber,
        status: asString(raw.date_de_fin_de_la_procedure_de_rappel)
          ? `Recall procedure end date: ${asString(raw.date_de_fin_de_la_procedure_de_rappel)}`
          : '',
        ...(images.length ? { images, primaryImageUrl: images[0].url, primaryImageAlt: images[0].alt } : {}),
        raw
      } satisfies NormalizedRecall;
    })
    .filter((record) => record.title && record.id && record.recallDate);
}

export function extractRappelConsoRecords(payload: unknown): RappelConsoRaw[] {
  if (Array.isArray(payload)) {
    return payload as RappelConsoRaw[];
  }

  if (payload && typeof payload === 'object') {
    const maybeFile = payload as RawRappelConsoFile;
    if (Array.isArray(maybeFile.records)) {
      return maybeFile.records as RappelConsoRaw[];
    }

    if (Array.isArray(maybeFile.results)) {
      return maybeFile.results as RappelConsoRaw[];
    }
  }

  return [];
}

export async function writeNormalizedRappelConsoRecalls(
  records: RappelConsoRaw[],
  processedPath = defaultRappelConsoProcessedPath
): Promise<ProcessedRecallFile> {
  const normalizedRecords = normalizeRappelConsoRecords(records);

  if (normalizedRecords.length === 0) {
    throw new Error('RappelConso normalization produced zero records; existing processed data was not overwritten.');
  }

  const output: ProcessedRecallFile = {
    generatedAt: new Date().toISOString(),
    source: 'FR_RAPPELCONSO',
    count: normalizedRecords.length,
    records: normalizedRecords
  };

  await writeJsonAtomic(processedPath, output);
  return output;
}

async function runNormalize(): Promise<void> {
  const rawText = await readFile(defaultRawRappelConsoPath, 'utf8');
  const rawPayload = JSON.parse(rawText) as unknown;
  const records = extractRappelConsoRecords(rawPayload);

  if (records.length === 0) {
    throw new Error('No RappelConso raw records found; processed data was not overwritten.');
  }

  const output = await writeNormalizedRappelConsoRecalls(records);
  const mergedOutput = await mergeProcessedRecalls();
  const sample = output.records[0];

  console.log(
    JSON.stringify(
      {
        rawRecordsRead: records.length,
        normalizedRecordsSaved: output.count,
        processedPath: defaultRappelConsoProcessedPath,
        canonicalPath: canonicalProcessedPath,
        mergedRecordsSaved: mergedOutput.count,
        countsBySource: mergedOutput.countsBySource,
        sample: sample
          ? {
              id: sample.id,
              source: sample.source,
              sourceUrl: sample.sourceUrl,
              title: sample.title,
              brandNames: sample.brandNames,
              productNames: sample.productNames,
              category: sample.category,
              hazard: sample.hazard,
              remedy: sample.remedy,
              recallDate: sample.recallDate,
              affectedUnits: sample.affectedUnits,
              description: sample.description,
              slug: sample.slug,
              classification: sample.classification,
              reason: sample.reason,
              distributionPattern: sample.distributionPattern,
              productQuantity: sample.productQuantity,
              recallNumber: sample.recallNumber,
              status: sample.status
            }
          : null
      },
      null,
      2
    )
  );
}

if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replace(/\\/g, '/')}`).href) {
  runNormalize().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
