import type { RecallAudience } from '../data/recall-taxonomy-v2.ts';
import {
  normalizeTaxonomySearchText,
  removeTaxonomySearchTerms,
  taxonomyTermMatchesQuery
} from './taxonomy-search-text.ts';

export type RecallAudienceSearchIntent = {
  audiences: RecallAudience[];
  remainingQuery: string;
};

type SearchableRecallAudience = Exclude<RecallAudience, 'general' | 'unknown'>;

// Use audience-specific phrases only. General product words such as "baby" or
// "allergy" continue through normal product and hazard matching.
const RECALL_AUDIENCE_TERMS: Record<SearchableRecallAudience, string[]> = {
  children: [
    'for children',
    'children recall',
    'children recalls',
    'for kids',
    'kids recall',
    '\uC5B4\uB9B0\uC774 \uB9AC\uCF5C',
    '\u513F\u7AE5\u4EA7\u54C1\u53EC\u56DE',
    '\u5B50\u3069\u3082\u5411\u3051\u30EA\u30B3\u30FC\u30EB',
    'rappel pour enfants',
    'retirada para ninos',
    'recall para criancas',
    'kinderruckruf'
  ],
  infants: [
    'for infants',
    'infant recall',
    'infants recall',
    '\uC720\uC544 \uB9AC\uCF5C',
    '\u5A74\u513F\u4EA7\u54C1\u53EC\u56DE',
    '\u4E73\u5150\u5411\u3051\u30EA\u30B3\u30FC\u30EB',
    'rappel pour nourrissons',
    'retirada para bebes',
    'recall para bebes',
    'sauglingsruckruf'
  ],
  'allergy-sensitive-consumers': [
    'for allergy-sensitive consumers',
    'allergy-sensitive consumers recall',
    '\uC54C\uB808\uB974\uAE30 \uBBFC\uAC10 \uC18C\uBE44\uC790 \uB9AC\uCF5C',
    '\u8FC7\u654F\u4EBA\u7FA4\u53EC\u56DE',
    '\u30A2\u30EC\u30EB\u30AE\u30FC\u5BFE\u5FDC\u30EA\u30B3\u30FC\u30EB',
    'rappel pour personnes allergiques',
    'retirada para personas alergicas',
    'recall para pessoas alergicas',
    'allergikerruckruf'
  ],
  elderly: [
    'for older adults',
    'older adults recall',
    'elderly recall',
    '\uACE0\uB839\uC790 \uB9AC\uCF5C',
    '\u8001\u5E74\u4EBA\u53EC\u56DE',
    '\u9AD8\u9F62\u8005\u5411\u3051\u30EA\u30B3\u30FC\u30EB',
    'rappel pour personnes agees',
    'retirada para adultos mayores',
    'recall para idosos',
    'seniorenruckruf'
  ],
  'pregnant-people': [
    'for pregnant people',
    'pregnant people recall',
    'pregnancy recall',
    '\uC784\uC0B0\uBD80 \uB9AC\uCF5C',
    '\u5B55\u5987\u53EC\u56DE',
    '\u598A\u5A66\u5411\u3051\u30EA\u30B3\u30FC\u30EB',
    'rappel pour femmes enceintes',
    'retirada para embarazadas',
    'recall para gravidas',
    'schwangerenruckruf'
  ],
  'pet-owners': [
    'for pet owners',
    'pet owners recall',
    '\uBC18\uB824\uB3D9\uBB3C \uBCF4\uD638\uC790 \uB9AC\uCF5C',
    '\u5BA0\u7269\u4E3B\u4EBA\u53EC\u56DE',
    '\u30DA\u30C3\u30C8\u30AA\u30FC\u30CA\u30FC\u5411\u3051\u30EA\u30B3\u30FC\u30EB',
    'rappel pour proprietaires d animaux',
    'retirada para duenos de mascotas',
    'recall para donos de animais',
    'tierhalterruckruf'
  ],
  workers: [
    'for workers',
    'workers recall',
    'worker recall',
    '\uADFC\uB85C\uC790 \uB9AC\uCF5C',
    '\u5DE5\u4EBA\u53EC\u56DE',
    '\u4F5C\u696D\u8005\u5411\u3051\u30EA\u30B3\u30FC\u30EB',
    'rappel pour travailleurs',
    'retirada para trabajadores',
    'recall para trabalhadores',
    'arbeiteruckruf'
  ],
  'outdoor-users': [
    'for outdoor users',
    'outdoor users recall',
    '\uC544\uC6C3\uB3C4\uC5B4 \uC774\uC6A9\uC790 \uB9AC\uCF5C',
    '\u6237\u5916\u7528\u6237\u53EC\u56DE',
    '\u30A2\u30A6\u30C8\u30C9\u30A2\u5229\u7528\u8005\u5411\u3051\u30EA\u30B3\u30FC\u30EB',
    'rappel pour utilisateurs exterieurs',
    'retirada para usuarios al aire libre',
    'recall para usuarios ao ar livre',
    'outdoornutzeruckruf'
  ],
  'vehicle-users': [
    'for vehicle users',
    'vehicle users recall',
    '\uCC28\uB7C9 \uC774\uC6A9\uC790 \uB9AC\uCF5C',
    '\u8F66\u8F86\u7528\u6237\u53EC\u56DE',
    '\u8ECA\u4E21\u5229\u7528\u8005\u5411\u3051\u30EA\u30B3\u30FC\u30EB',
    'rappel pour utilisateurs de vehicules',
    'retirada para usuarios de vehiculos',
    'recall para usuarios de veiculos',
    'fahrzeugnutzeruckruf'
  ]
};

export function getRecallAudienceSearchIntent(query: string): RecallAudienceSearchIntent | null {
  const normalizedQuery = normalizeTaxonomySearchText(query);
  if (!normalizedQuery) {
    return null;
  }

  const matches = (Object.entries(RECALL_AUDIENCE_TERMS) as Array<[SearchableRecallAudience, string[]]>)
    .map(([audience, terms]) => ({
      audience,
      matchedTerms: terms.filter((term) => taxonomyTermMatchesQuery(query, normalizedQuery, term))
    }))
    .filter(({ matchedTerms }) => matchedTerms.length > 0);

  if (matches.length === 0) {
    return null;
  }

  return {
    audiences: matches.map(({ audience }) => audience),
    remainingQuery: removeTaxonomySearchTerms(
      normalizedQuery,
      matches.flatMap(({ matchedTerms }) => matchedTerms)
    )
  };
}
