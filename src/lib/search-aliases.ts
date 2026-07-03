export type SearchAliasGroup = {
  id: string;
  terms: string[];
  aliases: string[];
};

export const SEARCH_ALIAS_GROUPS: SearchAliasGroup[] = [
  {
    id: 'power-bank',
    terms: [
      'power bank',
      'powerbank',
      'portable charger',
      'battery pack',
      'external battery',
      '보조배터리',
      '보조 배터리',
      '蹂댁“諛고꽣由?',
      'モバイルバッテリー',
      '?㏂깘?ㅳ꺂?먦긿?녴꺁??'
    ],
    aliases: ['power bank', 'powerbank', 'portable charger', 'battery pack', 'external battery']
  },
  {
    id: 'charger',
    terms: [
      'charger',
      'adapter',
      'power adapter',
      'charging cable',
      '휴대용 충전기',
      '충전기',
      '?대???異⑹쟾湲?',
      '異⑹쟾湲?',
      '充電器',
      '?낂쎔??'
    ],
    aliases: ['charger', 'adapter', 'power adapter', 'charging cable', 'portable charger', 'power bank']
  },
  {
    id: 'battery',
    terms: ['battery', 'batteries', 'lithium-ion', 'lithium ion', '배터리', '諛고꽣由?'],
    aliases: ['battery', 'batteries', 'lithium-ion', 'lithium ion', 'button battery', 'coin battery']
  },
  {
    id: 'fire-burn-overheat',
    terms: [
      'fire',
      'fire hazard',
      'burn',
      'burn hazard',
      'overheating',
      'thermal',
      '화재',
      '과열',
      '화상',
      '?붿옱',
      '怨쇱뿴',
      '?붿긽',
      '火災',
      '過熱',
      '?ョ겱',
      '?롧넲'
    ],
    aliases: ['fire', 'fire hazard', 'burn', 'burn hazard', 'overheating', 'overheat', 'thermal']
  },
  {
    id: 'electric-shock',
    terms: ['electric shock', 'shock hazard', 'electrocution', '감전', '媛먯쟾'],
    aliases: ['electric shock', 'shock hazard', 'electrocution']
  },
  {
    id: 'pistachio',
    terms: ['pistachio', 'pistache', '피스타치오', '?쇱뒪?移섏삤', 'ピスタチオ', '?붵궧?욍긽??'],
    aliases: ['pistachio', 'pistache']
  },
  {
    id: 'allergen',
    terms: [
      'allergen',
      'allergy',
      'undeclared allergen',
      'undeclared',
      'allergene',
      'allergène',
      'allerg챔ne',
      '알레르기',
      '?뚮젅瑜닿린',
      'アレルゲン',
      '?㏂꺃?ャ궙??'
    ],
    aliases: ['allergen', 'allergy', 'undeclared allergen', 'undeclared', 'contains', 'may contain', 'allergene']
  },
  {
    id: 'milk',
    terms: ['milk', 'dairy', 'lait', '우유', '?곗쑀'],
    aliases: ['milk', 'dairy', 'lait']
  },
  {
    id: 'egg',
    terms: ['egg', 'oeuf', '계란', '怨꾨?'],
    aliases: ['egg', 'oeuf']
  },
  {
    id: 'peanut',
    terms: ['peanut', 'arachide', '땅콩', '?낆쉘'],
    aliases: ['peanut', 'arachide']
  },
  {
    id: 'tree-nut',
    terms: ['tree nut', 'nuts', 'almond', 'walnut', 'cashew', 'hazelnut', '견과류', '寃ш낵瑜?'],
    aliases: ['tree nut', 'nuts', 'almond', 'walnut', 'cashew', 'hazelnut']
  },
  {
    id: 'wheat-gluten',
    terms: ['wheat', 'gluten', 'ble', 'blé', 'bl챕', '밀', '諛'],
    aliases: ['wheat', 'gluten', 'ble']
  },
  {
    id: 'soy',
    terms: ['soy', 'soya', 'soybean', '대두', '???'],
    aliases: ['soy', 'soya', 'soybean']
  },
  {
    id: 'sesame',
    terms: ['sesame', '참깨', '李멸묠'],
    aliases: ['sesame']
  },
  {
    id: 'baby-sleep',
    terms: [
      'crib',
      'cot',
      'baby sleeper',
      'bassinet',
      '아기침대',
      '?꾧린移⑤?',
      'ベビーベッド',
      '?쇻깛?쇈깧?껁깋'
    ],
    aliases: ['crib', 'cot', 'baby sleeper', 'bassinet']
  },
  {
    id: 'baby-kids',
    terms: ['baby', 'infant', 'nursery', 'child', 'children', 'kids', '유아용품', '?좎븘?⑺뭹'],
    aliases: ['baby', 'infant', 'nursery', 'child', 'children', 'kids']
  },
  {
    id: 'toy',
    terms: ['toy', 'toys', '장난감', '?λ궃媛?', 'おもちゃ', '?듽굚?▲굛'],
    aliases: ['toy', 'toys']
  },
  {
    id: 'stroller',
    terms: ['stroller', 'pram', '유모차', '?좊え李?'],
    aliases: ['stroller', 'pram']
  },
  {
    id: 'helmet-bike',
    terms: ['helmet', 'bicycle', 'bike', '헬멧', '자전거', '?щĸ', '?먯쟾嫄?'],
    aliases: ['helmet', 'bicycle', 'bike']
  },
  {
    id: 'clothing-sleepwear',
    terms: ['clothing', 'apparel', 'garment', 'sleepwear', '의류', '어린이 잠옷', '?섎쪟', '?대┛???좎샆'],
    aliases: ['clothing', 'apparel', 'garment', 'sleepwear', "children's sleepwear", 'kids sleepwear', 'loungewear']
  },
  {
    id: 'cleaner-detergent',
    terms: ['detergent', 'cleaner', 'cleaning product', '세제', '?몄젣'],
    aliases: ['detergent', 'cleaner', 'cleaning product']
  },
  {
    id: 'appliance-electric',
    terms: ['appliance', 'household appliance', 'electric', 'electrical', '가전', '전기', '媛??', '?꾧린'],
    aliases: ['appliance', 'household appliance', 'electric', 'electrical']
  },
  {
    id: 'choking-suffocation',
    terms: ['choking', 'choking hazard', 'suffocation', '질식', '吏덉떇'],
    aliases: ['choking', 'choking hazard', 'suffocation']
  },
  {
    id: 'fall-injury',
    terms: ['fall', 'fall hazard', 'injury', 'injury hazard', '낙상', '부상', '?숈긽', '遺??'],
    aliases: ['fall', 'fall hazard', 'injury', 'injury hazard']
  },
  {
    id: 'recall-alert',
    terms: ['recall', 'recalled', 'alert', 'safety alert', 'rappel', '리콜', '由ъ퐳'],
    aliases: ['recall', 'recalled', 'alert', 'safety alert', 'rappel']
  }
];
