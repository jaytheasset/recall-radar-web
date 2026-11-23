export const jointPowerBankRecall = {
  model: 'T1037',
  product: 'Super Off-Road 12,000 mAh Solar Wireless Power Bank',
  guidePath: '/recall-search-guide/#super-off-road',
  canadaId: 'ca-recalls-82213',
  usId: 'cpsc-26575'
};

export function isJointPowerBankRecall(recordId: string): boolean {
  return recordId === jointPowerBankRecall.canadaId || recordId === jointPowerBankRecall.usId;
}

export const recallSearchExamples = [
  { label: 'Model', query: jointPowerBankRecall.model, href: '/checker?q=T1037' },
  { label: 'Barcode', query: '29168800000', href: '/checker?q=29168800000&source=FDA' },
  { label: 'Lot', query: '260303', href: '/checker?q=260303&source=CA_RECALLS' },
  { label: 'Recall number', query: 'H-0952-2026', href: '/checker?q=H-0952-2026&source=FDA' }
];
