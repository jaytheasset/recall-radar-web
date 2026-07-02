export const DEFAULT_LOCALE = 'en';

export const SUPPORTED_LOCALES = ['en'] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const messages = {
  en: {
    'app.name': 'Recall Radar',
    'nav.checker': 'Checker',
    'nav.watchlist': 'Watchlist',
    'nav.babyKids': 'Baby & Kids',
    'nav.batteriesElectronics': 'Batteries & Electronics',
    'nav.foodAllergy': 'Food & Allergy',
    'common.viewRecall': 'View recall',
    'common.browseRecalls': 'Browse recalls',
    'common.searchAllNotices': 'Search all notices',
    'common.officialNotice': 'Official notice',
    'common.verifyOfficialNotice': 'Verify with the official notice',
    'checker.title': 'Recall checker',
    'checker.searchPlaceholder': 'Search by product, brand, model, UPC, lot code, or keyword',
    'checker.noClearMatch': 'No clear match found',
    'checker.noResultSafety':
      'We did not find a clear match in the indexed recall notices. This does not mean the product is safe or recall-free. Try searching by brand name, model number, UPC/barcode, lot code, ingredient, allergen, or product type.',
    'disclaimer.possibleMatches':
      'Search results are possible matches, not safety confirmations. Always verify affected models, lots, dates, distribution, and remedies with the official notice.',
    'watchlist.savedInBrowser': 'Saved in this browser',
    'detail.howToVerify': 'How to verify',
    'detail.viewOfficialNotice': 'View official notice',
    'category.indexedNotices': 'Indexed notices',
    'error.pageNotFound': 'Page not found'
  }
} as const;

export type MessageKey = keyof (typeof messages)[typeof DEFAULT_LOCALE];

export function getMessage(key: MessageKey, locale: SupportedLocale = DEFAULT_LOCALE): string {
  return messages[locale][key];
}
