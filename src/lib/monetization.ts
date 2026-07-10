export type AdSensePlacement = 'home';

export type AdSenseSlotConfig = {
  client: string;
  slot: string;
};

const adSenseClient = import.meta.env.PUBLIC_ADSENSE_CLIENT?.trim() ?? '';
const homeAdSenseSlot = import.meta.env.PUBLIC_ADSENSE_HOME_SLOT?.trim() ?? '';

function isValidAdSenseClient(value: string): boolean {
  return /^ca-pub-\d{10,20}$/.test(value);
}

function isValidAdSenseSlot(value: string): boolean {
  return /^\d{8,20}$/.test(value);
}

export function getAdSenseSlotConfig(placement: AdSensePlacement): AdSenseSlotConfig | undefined {
  const slot = placement === 'home' ? homeAdSenseSlot : '';

  if (!isValidAdSenseClient(adSenseClient) || !isValidAdSenseSlot(slot)) {
    return undefined;
  }

  return { client: adSenseClient, slot };
}
