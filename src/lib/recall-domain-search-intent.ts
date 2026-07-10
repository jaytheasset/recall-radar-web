import type { RecallDomain } from '../data/recall-taxonomy-v2.ts';
import {
  normalizeTaxonomySearchText,
  removeTaxonomySearchTerms,
  taxonomyTermMatchesQuery
} from './taxonomy-search-text.ts';

export type RecallDomainSearchIntent = {
  recallDomains: RecallDomain[];
  remainingQuery: string;
};

type SearchableRecallDomain = Exclude<RecallDomain, 'unknown'>;

// These phrases deliberately include a recall context so ordinary product names
// such as "food processor" are not mistaken for a food-recall filter.
const RECALL_DOMAIN_TERMS: Record<SearchableRecallDomain, string[]> = {
  'consumer-product': [
    'consumer product recall',
    'consumer product recalls',
    'consumer safety recall',
    '\uC18C\uBE44\uC790 \uC81C\uD488 \uB9AC\uCF5C',
    '\u6D88\u8D39\u54C1\u53EC\u56DE',
    '\u6D88\u8CBB\u8005\u88FD\u54C1\u30EA\u30B3\u30FC\u30EB',
    'rappel produit de consommation',
    'retirada de productos de consumo',
    'recall de produto de consumo',
    'verbraucherproduktruckruf'
  ],
  food: [
    'food recall',
    'food recalls',
    '\uC2DD\uD488 \uB9AC\uCF5C',
    '\u98DF\u54C1\u53EC\u56DE',
    '\u98DF\u54C1\u30EA\u30B3\u30FC\u30EB',
    'rappel alimentaire',
    'retirada de alimentos',
    'recall de alimentos',
    'lebensmittelruckruf'
  ],
  vehicle: [
    'vehicle recall',
    'vehicle recalls',
    '\uC790\uB3D9\uCC28 \uB9AC\uCF5C',
    '\u8F66\u8F86\u53EC\u56DE',
    '\u8ECA\u4E21\u30EA\u30B3\u30FC\u30EB',
    'rappel de vehicule',
    'retirada de vehiculo',
    'recall de veiculo',
    'fahrzeugruckruf'
  ],
  'medical-health': [
    'medical device recall',
    'medical recall',
    'medical health recall',
    '\uC758\uB8CC\uAE30\uAE30 \uB9AC\uCF5C',
    '\u533B\u7597\u5668\u68B0\u53EC\u56DE',
    '\u533B\u7642\u6A5F\u5668\u30EA\u30B3\u30FC\u30EB',
    'rappel de dispositif medical',
    'retirada de dispositivo medico',
    'recall de dispositivo medico',
    'medizinproduktruckruf'
  ],
  chemical: [
    'chemical recall',
    'chemical product recall',
    '\uD654\uD559 \uC81C\uD488 \uB9AC\uCF5C',
    '\u5316\u5B66\u4EA7\u54C1\u53EC\u56DE',
    '\u5316\u5B66\u88FD\u54C1\u30EA\u30B3\u30FC\u30EB',
    'rappel de produit chimique',
    'retirada de producto quimico',
    'recall de produto quimico',
    'chemikalienruckruf'
  ],
  'workplace-industrial': [
    'workplace recall',
    'industrial recall',
    '\uC0B0\uC5C5\uC6A9 \uC81C\uD488 \uB9AC\uCF5C',
    '\u5DE5\u4E1A\u4EA7\u54C1\u53EC\u56DE',
    '\u7523\u696D\u7528\u88FD\u54C1\u30EA\u30B3\u30FC\u30EB',
    'rappel industriel',
    'retirada industrial',
    'recall industrial',
    'industrieruckruf'
  ]
};

export function getRecallDomainSearchIntent(query: string): RecallDomainSearchIntent | null {
  const normalizedQuery = normalizeTaxonomySearchText(query);
  if (!normalizedQuery) {
    return null;
  }

  const matches = (Object.entries(RECALL_DOMAIN_TERMS) as Array<[SearchableRecallDomain, string[]]>)
    .map(([recallDomain, terms]) => ({
      recallDomain,
      matchedTerms: terms.filter((term) => taxonomyTermMatchesQuery(query, normalizedQuery, term))
    }))
    .filter(({ matchedTerms }) => matchedTerms.length > 0);

  if (matches.length === 0) {
    return null;
  }

  const remainingQuery = removeTaxonomySearchTerms(
    normalizedQuery,
    matches.flatMap(({ matchedTerms }) => matchedTerms)
  );

  return {
    recallDomains: matches.map(({ recallDomain }) => recallDomain),
    remainingQuery
  };
}
