export type SearchAliasGroup = {
  id: string;
  terms: string[];
  aliases: string[];
};

export const REQUIRED_SEARCH_ALIAS_TERMS: Record<string, string[]> = {
  'food-grocery': ['food', 'grocery', 'alimentation', 'alimento', '\uC2DD\uD488', '\u98DF\u54C1'],
  'baby-kids': ['baby', 'child', 'crianca', '\uC544\uAE30', '\uC5B4\uB9B0\uC774', '\u513F\u7AE5'],
  'baby-sleep': ['crib', 'baby sleeper', 'berco', '\uC544\uAE30\uCE68\uB300', '\u30D9\u30D3\u30FC\u30D9\u30C3\u30C9', '\u5A74\u513F\u5E8A'],
  battery: ['battery', 'bateria', '\uBC30\uD130\uB9AC', '\u96FB\u6C60', '\u7535\u6C60'],
  'power-bank': ['power bank', 'portable charger', 'banco de energia', '\uBCF4\uC870\uBC30\uD130\uB9AC', '\u30E2\u30D0\u30A4\u30EB\u30D0\u30C3\u30C6\u30EA\u30FC', '\u5145\u7535\u5B9D'],
  'smoke-detector': ['smoke detector', 'smoke alarm', 'detector de fumaca', '\uC5F0\uAE30\uAC10\uC9C0\uAE30', '\u7159\u63A2\u77E5\u5668'],
  allergen: ['allergen', 'allergy', 'alergeno', '\uC54C\uB808\uB974\uAE30', '\u30A2\u30EC\u30EB\u30B2\u30F3', '\u8FC7\u654F\u539F'],
  identifiers: ['barcode', 'upc', 'lot', 'batch', 'model number', 'codigo de barras', '\uBC14\uCF54\uB4DC', '\u6761\u5F62\u7801'],
  'pathogen-contamination': ['salmonella', 'listeria', 'bacteria', 'contaminacao', '\uC138\uADE0', '\u7EC6\u83CC'],
  'foreign-matter': ['foreign matter', 'metal', 'glass', 'corpo estranho', '\uC774\uBB3C\uC9C8', '\u7570\u7269'],
  'chemical-contamination': ['chemical contamination', 'ethylene oxide', 'contaminacao quimica', '\uD654\uD559\uC624\uC5FC', '\u5316\u5B66\u6C61\u67D3'],
  'fire-burn-overheat': ['fire', 'fire hazard', 'overheating', 'incendio', '\uD654\uC7AC', '\u706B\u707D'],
  'electric-shock': ['electric shock', 'shock hazard', 'choque eletrico', '\uAC10\uC804', '\u611F\u96FB'],
  'choking-suffocation': ['choking', 'suffocation', 'asfixia', '\uC9C8\uC2DD', '\u7A92\u606F'],
  'fall-injury': ['fall', 'injury', 'queda', '\uB0D9\uC0C1', '\u8DCC\u5012'],
  'labeling-quality': ['labeling error', 'quality defect', 'rotulagem', '\uD45C\uC2DC\uC624\uB958', '\u6807\u7B7E\u9519\u8BEF'],
  toy: ['toy', 'brinquedo', '\uC7A5\uB09C\uAC10', '\u304A\u3082\u3061\u3083', '\u73A9\u5177'],
  stroller: ['stroller', 'pram', 'carrinho de bebe', '\uC720\uBAA8\uCC28', '\u30D9\u30D3\u30FC\u30AB\u30FC', '\u5A74\u513F\u8F66'],
  'helmet-bike': ['helmet', 'bike helmet', 'capacete', '\uD5EC\uBA67', '\u30D8\u30EB\u30E1\u30C3\u30C8', '\u5934\u76D4']
};

export const SEARCH_ALIAS_GROUPS: SearchAliasGroup[] = [
  {
    id: 'food-grocery',
    terms: [
      'food',
      'grocery',
      'groceries',
      'packaged food',
      'food product',
      'alimentation',
      'alimentaire',
      'produit alimentaire',
      'comida',
      'alimento',
      'alimentos',
      'produto alimentar',
      'mercearia',
      'lebensmittel',
      '\uC2DD\uD488',
      '\uC74C\uC2DD',
      '\u98DF\u54C1',
      '\u98DF\u6599\u54C1'
    ],
    aliases: ['food', 'grocery', 'packaged food', 'food product']
  },
  {
    id: 'beverage',
    terms: ['beverage', 'drink', 'juice', 'milk drink', 'boisson', 'bebida', 'getrank', '\uC74C\uB8CC', '\u98F2\u307F\u7269', '\u996E\u6599'],
    aliases: ['beverage', 'drink']
  },
  {
    id: 'meat-seafood',
    terms: ['meat', 'seafood', 'fish', 'shellfish', 'viande', 'poisson', 'mariscos', 'fleisch', 'fisch', '\uC721\uB958', '\uC218\uC0B0\uBB3C', '\u9B5A', '\u8089'],
    aliases: ['meat', 'seafood', 'fish', 'shellfish']
  },
  {
    id: 'infant-food',
    terms: [
      'infant food',
      'baby food',
      'formula',
      'infant formula',
      'lait infantile',
      'comida para bebe',
      'alimento infantil',
      'formula infantil',
      'babynahrung',
      '\uC774\uC720\uC2DD',
      '\uBD84\uC720',
      '\u30D9\u30D3\u30FC\u30D5\u30FC\u30C9',
      '\u7C89\u30DF\u30EB\u30AF',
      '\u5A74\u5150\u98DF\u54C1',
      '\u5976\u7C89'
    ],
    aliases: ['infant food', 'baby food', 'formula', 'infant formula']
  },
  {
    id: 'power-bank',
    terms: [
      'power bank',
      'powerbank',
      'portable charger',
      'battery pack',
      'external battery',
      'batterie externe',
      'bateria externa',
      'banco de energia',
      '\uBCF4\uC870\uBC30\uD130\uB9AC',
      '\u30E2\u30D0\u30A4\u30EB\u30D0\u30C3\u30C6\u30EA\u30FC',
      '\u5145\u7535\u5B9D',
      '\u884C\u52D5\u96FB\u6E90'
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
      'cargador',
      'carregador',
      'ladegerat',
      '\uCDA9\uC804\uAE30',
      '\u5145\u96FB\u5668',
      '\u5145\u7535\u5668'
    ],
    aliases: ['charger', 'adapter', 'power adapter', 'charging cable', 'portable charger', 'power bank']
  },
  {
    id: 'battery',
    terms: [
      'battery',
      'batteries',
      'lithium-ion',
      'lithium ion',
      'button battery',
      'coin battery',
      'batterie',
      'pila',
      'bateria',
      '\uBC30\uD130\uB9AC',
      '\u96FB\u6C60',
      '\u7535\u6C60'
    ],
    aliases: ['battery', 'batteries', 'lithium-ion', 'lithium ion', 'button battery', 'coin battery']
  },
  {
    id: 'smoke-detector',
    terms: [
      'smoke detector',
      'smoke alarm',
      'carbon monoxide alarm',
      'co detector',
      'detecteur de fumee',
      'detector de humo',
      'detector de fumaca',
      'alarme de fumaca',
      'rauchmelder',
      '\uC5F0\uAE30\uAC10\uC9C0\uAE30',
      '\u7159\u63A2\u77E5\u5668',
      '\u70DF\u96FE\u62A5\u8B66\u5668'
    ],
    aliases: ['smoke detector', 'smoke alarm', 'carbon monoxide alarm', 'co detector']
  },
  {
    id: 'appliance-electric',
    terms: [
      'appliance',
      'household appliance',
      'electric',
      'electrical',
      'kitchen appliance',
      'laundry appliance',
      'appareil',
      'electromenager',
      'electrodomestico',
      'haushaltsgerat',
      '\uAC00\uC804',
      '\uC804\uAE30',
      '\u5BB6\u96FB',
      '\u7535\u5668'
    ],
    aliases: ['appliance', 'household appliance', 'electric', 'electrical', 'kitchen appliance']
  },
  {
    id: 'furniture-household',
    terms: [
      'furniture',
      'bedding',
      'cookware',
      'tableware',
      'household product',
      'meuble',
      'muebles',
      'mobel',
      '\uAC00\uAD6C',
      '\uCE68\uAD6C',
      '\u5BB6\u5177',
      '\u5BDD\u5177'
    ],
    aliases: ['furniture', 'bedding', 'cookware', 'tableware', 'household product']
  },
  {
    id: 'vehicles-mobility',
    terms: [
      'vehicle',
      'car',
      'automobile',
      'passenger vehicle',
      'golf cart',
      'scooter',
      'bicycle',
      'bike',
      'vehicule',
      'voiture',
      'vehiculo',
      'auto',
      'fahrzeug',
      '\uC790\uB3D9\uCC28',
      '\uC790\uC804\uAC70',
      '\u8ECA',
      '\u81EA\u52D5\u8ECA',
      '\u6C7D\u8F66'
    ],
    aliases: ['vehicle', 'car', 'passenger vehicle', 'scooter', 'bicycle', 'bike']
  },
  {
    id: 'sports-outdoor',
    terms: ['sports', 'outdoor', 'camping', 'exercise equipment', 'pool', 'water sports', 'sport', 'deporte', '\uC2A4\uD3EC\uCE20', '\uCEA0\uD551', '\u30B9\u30DD\u30FC\u30C4', '\u6237\u5916'],
    aliases: ['sports', 'outdoor', 'camping', 'exercise equipment', 'pool', 'water sports']
  },
  {
    id: 'tools-equipment',
    terms: ['tool', 'tools', 'power tool', 'hand tool', 'ladder', 'machinery', 'equipment', 'outil', 'herramienta', 'werkzeug', '\uACF5\uAD6C', '\uC0AC\uB2E4\uB9AC', '\u5DE5\u5177'],
    aliases: ['tool', 'tools', 'power tool', 'hand tool', 'ladder', 'machinery', 'equipment']
  },
  {
    id: 'clothing-sleepwear',
    terms: [
      'clothing',
      'apparel',
      'garment',
      'sleepwear',
      "children's sleepwear",
      'kids sleepwear',
      'loungewear',
      'vetement',
      'ropa',
      'kleidung',
      '\uC758\uB958',
      '\uC5B4\uB9B0\uC774 \uC7A0\uC637',
      '\u8863\u985E',
      '\u670D\u88C5'
    ],
    aliases: ['clothing', 'apparel', 'garment', 'sleepwear', "children's sleepwear", 'kids sleepwear', 'loungewear']
  },
  {
    id: 'health-personal-care',
    terms: [
      'cosmetic',
      'personal care',
      'medical device',
      'hygiene',
      'cosmetique',
      'cosmetico',
      'dispositivo medico',
      'kosmetik',
      '\uD654\uC7A5\uD488',
      '\uC704\uC0DD\uC6A9\uD488',
      '\uC758\uB8CC\uAE30\uAE30',
      '\u5316\u7CA7\u54C1',
      '\u533B\u7642\u6A5F\u5668',
      '\u533B\u7597\u5668\u68B0'
    ],
    aliases: ['cosmetic', 'personal care', 'medical device', 'hygiene product']
  },
  {
    id: 'cleaner-detergent',
    terms: ['detergent', 'cleaner', 'cleaning product', 'degreaser', 'nettoyant', 'detergente', 'reiniger', '\uC138\uC81C', '\uCCAD\uC18C\uC81C', '\u6D17\u5264'],
    aliases: ['detergent', 'cleaner', 'cleaning product']
  },
  {
    id: 'chemical-product',
    terms: ['chemical', 'chemical product', 'pesticide', 'solvent', 'paint', 'chimique', 'quimico', 'chemikalie', '\uD654\uD559\uC81C\uD488', '\uB18D\uC57D', '\u5316\u5B66\u54C1'],
    aliases: ['chemical', 'chemical product', 'pesticide', 'solvent']
  },
  {
    id: 'pet-products',
    terms: ['pet', 'pet food', 'pet toy', 'dog', 'cat', 'animal', 'mascota', 'tierbedarf', '\uBC18\uB824\uB3D9\uBB3C', '\uAC15\uC544\uC9C0', '\uACE0\uC591\uC774', '\u30DA\u30C3\u30C8', '\u5BA0\u7269'],
    aliases: ['pet', 'pet food', 'pet toy', 'dog', 'cat']
  },
  {
    id: 'industrial-workplace',
    terms: ['industrial', 'workplace', 'work equipment', 'factory', 'professionnel', 'arbeitsplatz', '\uC0B0\uC5C5\uC6A9', '\uC791\uC5C5\uC7A5', '\u5DE5\u696D'],
    aliases: ['industrial', 'workplace', 'work equipment', 'factory']
  },
  {
    id: 'pistachio',
    terms: ['pistachio', 'pistache', 'pistacho', 'pistazie', '\uD53C\uC2A4\uD0C0\uCE58\uC624', '\u30D4\u30B9\u30BF\u30C1\u30AA', '\u5F00\u5FC3\u679C'],
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
      'allergie',
      'alergeno',
      'alergia',
      'allergenhinweis',
      '\uC54C\uB808\uB974\uAE30',
      '\uC54C\uB808\uB974\uAC90',
      '\u30A2\u30EC\u30EB\u30B2\u30F3',
      '\u8FC7\u654F\u539F',
      '\u904E\u654F\u539F'
    ],
    aliases: ['allergen', 'allergy', 'undeclared allergen', 'undeclared', 'allergene']
  },
  {
    id: 'milk',
    terms: ['milk', 'dairy', 'lait', 'leche', 'leite', 'milch', '\uC6B0\uC720', '\u4E73', '\u725B\u5976'],
    aliases: ['milk', 'dairy', 'lait']
  },
  {
    id: 'egg',
    terms: ['egg', 'oeuf', 'huevo', 'ovo', 'ei', '\uACC4\uB780', '\u5375', '\u9E21\u86CB'],
    aliases: ['egg', 'oeuf']
  },
  {
    id: 'peanut',
    terms: ['peanut', 'arachide', 'cacahuete', 'cacahuate', 'amendoim', 'erdnuss', '\uB545\uCF69', '\u843D\u82B1\u751F', '\u82B1\u751F'],
    aliases: ['peanut', 'arachide']
  },
  {
    id: 'tree-nut',
    terms: ['tree nut', 'nuts', 'almond', 'walnut', 'cashew', 'hazelnut', 'fruits a coque', 'nueces', 'castanha', 'nozes', 'nusse', '\uACAC\uACFC\uB958', '\u6728\u306E\u5B9F', '\u6811\u575A\u679C'],
    aliases: ['tree nut', 'nuts', 'almond', 'walnut', 'cashew', 'hazelnut']
  },
  {
    id: 'wheat-gluten',
    terms: ['wheat', 'gluten', 'ble', 'trigo', 'weizen', '\uBC00', '\uAE00\uB8E8\uD150', '\u5C0F\u9EA6', '\u9EB8\u8D28'],
    aliases: ['wheat', 'gluten', 'ble']
  },
  {
    id: 'soy',
    terms: ['soy', 'soya', 'soybean', 'soja', '\uB300\uB450', '\u5927\u8C46'],
    aliases: ['soy', 'soya', 'soybean']
  },
  {
    id: 'sesame',
    terms: ['sesame', 'sesamo', 'gergelim', 'sesam', '\uCC38\uAE68', '\u80E1\u9EBB', '\u829D\u9EBB'],
    aliases: ['sesame']
  },
  {
    id: 'pathogen-contamination',
    terms: ['salmonella', 'listeria', 'e coli', 'ecoli', 'pathogen', 'bacteria', 'bacterial', 'contamination', 'contaminacion', 'contaminacao', 'kontamination', '\uC0B4\uBAA8\uB12C\uB77C', '\uC138\uADE0', '\u7EC6\u83CC'],
    aliases: ['pathogen contamination', 'salmonella', 'listeria', 'e coli', 'bacteria', 'contamination']
  },
  {
    id: 'foreign-matter',
    terms: ['foreign matter', 'metal', 'glass', 'plastic fragment', 'piece of metal', 'corps etranger', 'cuerpo extrano', 'corpo estranho', 'fremdkorper', '\uC774\uBB3C\uC9C8', '\uAE08\uC18D\uC870\uAC01', '\u7570\u7269', '\u5F02\u7269'],
    aliases: ['foreign matter', 'metal', 'glass', 'plastic fragment']
  },
  {
    id: 'chemical-contamination',
    terms: ['chemical contamination', 'ethylene oxide', 'pesticide residue', 'lead', 'cadmium', 'chemical exposure', 'contamination chimique', 'contaminacion quimica', 'contaminacao quimica', '\uD654\uD559\uC624\uC5FC', '\u5316\u5B66\u6C61\u67D3'],
    aliases: ['chemical contamination', 'chemical exposure', 'ethylene oxide', 'pesticide residue']
  },
  {
    id: 'fire-burn-overheat',
    terms: [
      'fire',
      'fire hazard',
      'burn',
      'burn hazard',
      'overheating',
      'overheat',
      'thermal',
      'incendie',
      'brulure',
      'feu',
      'incendio',
      'quemadura',
      'queimadura',
      'sobreaquecimento',
      'brandgefahr',
      'verbrennung',
      '\uD654\uC7AC',
      '\uD654\uC0C1',
      '\uACFC\uC5F4',
      '\u706B\u707D',
      '\u70E7\u4F24',
      '\u8FC7\u70ED'
    ],
    aliases: ['fire', 'fire hazard', 'burn', 'burn hazard', 'overheating', 'overheat', 'thermal']
  },
  {
    id: 'electric-shock',
    terms: ['electric shock', 'shock hazard', 'electrocution', 'choc electrique', 'descarga electrica', 'choque eletrico', 'stromschlag', '\uAC10\uC804', '\u611F\u96FB', '\u89E6\u7535'],
    aliases: ['electric shock', 'shock hazard', 'electrocution']
  },
  {
    id: 'choking-suffocation',
    terms: ['choking', 'choking hazard', 'suffocation', 'etouffement', 'asfixia', 'erstickung', '\uC9C8\uC2DD', '\u7A92\u606F'],
    aliases: ['choking', 'choking hazard', 'suffocation']
  },
  {
    id: 'strangulation',
    terms: ['strangulation', 'strangulation hazard', 'etranglement', 'estrangulamiento', 'strangulation gefahr', '\uBAA9\uC870\uB984', '\u7D5E\u9996'],
    aliases: ['strangulation', 'strangulation hazard']
  },
  {
    id: 'fall-injury',
    terms: ['fall', 'fall hazard', 'injury', 'injury hazard', 'chute', 'blessure', 'caida', 'lesion', 'queda', 'ferimento', 'verletzung', '\uB0D9\uC0C1', '\uBD80\uC0C1', '\u8DCC\u5012', '\u4F24\u5BB3'],
    aliases: ['fall', 'fall hazard', 'injury', 'injury hazard']
  },
  {
    id: 'cut-laceration',
    terms: ['cut', 'cuts', 'laceration', 'sharp edge', 'coupure', 'corte', 'schnittverletzung', '\uC808\uC0C1', '\uCC14\uB9BC', '\u5272\u4F24'],
    aliases: ['cut', 'laceration', 'sharp edge']
  },
  {
    id: 'entrapment',
    terms: ['entrapment', 'pinch', 'pinching', 'trapped', 'coincement', 'atrapamiento', 'aprisionamento', 'einklemmung', '\uB07C\uC784', '\u5939\u4F24'],
    aliases: ['entrapment', 'pinch', 'trapped']
  },
  {
    id: 'poisoning',
    terms: ['poisoning', 'toxic', 'toxicity', 'intoxication', 'envenenamiento', 'envenenamento', 'vergiftung', '\uC911\uB3C5', '\u4E2D\u6BD2'],
    aliases: ['poisoning', 'toxic', 'toxicity']
  },
  {
    id: 'crash-drowning',
    terms: ['crash', 'collision', 'drowning', 'accident', 'noyade', 'choque', 'ahogamiento', 'acidente', 'afogamento', 'unfall', 'ertrinken', '\uCDA9\uB3CC', '\uC775\uC0AC', '\u649E\u8F66', '\u6EBA\u6C34'],
    aliases: ['crash', 'collision', 'drowning']
  },
  {
    id: 'labeling-quality',
    terms: [
      'labeling error',
      'labelling error',
      'mislabelled',
      'misbranded',
      'regulatory noncompliance',
      'quality defect',
      'packaging defect',
      'etiquetage',
      'etiquetado',
      'rotulagem',
      'defeito de embalagem',
      'kennzeichnung',
      '\uD45C\uC2DC\uC624\uB958',
      '\uD488\uC9C8\uACB0\uD568',
      '\u8868\u793A\u30DF\u30B9',
      '\u6807\u7B7E\u9519\u8BEF'
    ],
    aliases: ['labeling error', 'labelling error', 'regulatory noncompliance', 'quality defect', 'packaging defect']
  },
  {
    id: 'baby-sleep',
    terms: ['crib', 'cot', 'baby sleeper', 'bassinet', 'lit bebe', 'cuna', 'berco', 'babybett', '\uC544\uAE30\uCE68\uB300', '\u30D9\u30D3\u30FC\u30D9\u30C3\u30C9', '\u5A74\u513F\u5E8A'],
    aliases: ['crib', 'cot', 'baby sleeper', 'bassinet']
  },
  {
    id: 'baby-kids',
    terms: ['baby', 'infant', 'nursery', 'child', 'children', 'kids', 'bebe', 'crianca', 'criancas', 'enfant', 'nino', 'kind', '\uC544\uAE30', '\uC720\uC544', '\uC5B4\uB9B0\uC774', '\u5B50\u4F9B', '\u513F\u7AE5'],
    aliases: ['baby', 'infant', 'nursery', 'child', 'children', 'kids']
  },
  {
    id: 'toy',
    terms: ['toy', 'toys', 'brinquedo', 'jouet', 'juguete', 'spielzeug', '\uC7A5\uB09C\uAC10', '\u304A\u3082\u3061\u3083', '\u73A9\u5177'],
    aliases: ['toy', 'toys']
  },
  {
    id: 'stroller',
    terms: ['stroller', 'pram', 'pushchair', 'poussette', 'cochecito', 'carrinho de bebe', 'kinderwagen', '\uC720\uBAA8\uCC28', '\u30D9\u30D3\u30FC\u30AB\u30FC', '\u5A74\u513F\u8F66'],
    aliases: ['stroller', 'pram', 'pushchair']
  },
  {
    id: 'helmet-bike',
    terms: ['helmet', 'bicycle', 'bike', 'bike helmet', 'casque', 'velo', 'casco', 'bicicleta', 'capacete', 'fahrradhelm', '\uD5EC\uBA67', '\uC790\uC804\uAC70', '\u30D8\u30EB\u30E1\u30C3\u30C8', '\u5934\u76D4'],
    aliases: ['helmet', 'bicycle', 'bike', 'bike helmet']
  },
  {
    id: 'identifiers',
    terms: [
      'barcode',
      'bar code',
      'upc',
      'gtin',
      'ean',
      'lot',
      'batch',
      'model',
      'model number',
      'serial number',
      'date code',
      'best before',
      'use by',
      'expiry',
      'validade',
      'vencimento',
      'recall number',
      'numero de lot',
      'codigo de barras',
      'codigo de lote',
      'modellnummer',
      '\uBC14\uCF54\uB4DC',
      '\uBAA8\uB378\uBC88\uD638',
      '\uB85C\uD2B8\uBC88\uD638',
      '\u88FD\u9020\u756A\u53F7',
      '\u578B\u756A',
      '\u6761\u5F62\u7801',
      '\u578B\u53F7',
      '\u6279\u6B21'
    ],
    aliases: ['barcode', 'upc', 'lot', 'batch', 'model number', 'serial number', 'date code', 'recall number']
  },
  {
    id: 'recall-alert',
    terms: ['recall', 'recalled', 'alert', 'safety alert', 'rappel', 'retiro', 'retirada', 'ruckruf', '\uB9AC\uCF5C', '\u56DE\u53CE', '\u53EC\u56DE'],
    aliases: ['recall', 'recalled', 'alert', 'safety alert', 'rappel']
  }
];
