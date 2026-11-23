import { jointPowerBankRecall } from './recall-search-examples.ts';

// Safety Gate returned a zero-byte response for these official image IDs on 2026-11-23.
const unavailableEuImageIds = new Set([
  '11012374', '11012375', '11012376', '11013654', '11013655', '11013656',
  '11012776', '11012883', '11012884', '11012885', '11012886',
  '11013505', '11013506', '11013507', '11013508'
]);

export function isUnavailableEuRecallImage(url: string | undefined): boolean {
  const imageId = url?.match(/^https:\/\/ec\.europa\.eu\/safety-gate-alerts\/public\/api\/notification\/(?:image|thumbnail)\/(\d+)(?:[?#]|$)/i)?.[1];
  return imageId !== undefined && unavailableEuImageIds.has(imageId);
}

export function correctCpscRecallAction(recordId: string, action: string): string {
  if (recordId !== jointPowerBankRecall.usId) return action;

  return action
    .replace(/\bConsumers should dispose of the camera in accordance with local and state regulations\.\s*/i, '')
    .replace(/visit\s+(?:https?:\/\/)?(?:www\.)?spectroandco\.com\/recall\s+to register/i,
      'use the consumer contact details in the official CPSC notice to register');
}
