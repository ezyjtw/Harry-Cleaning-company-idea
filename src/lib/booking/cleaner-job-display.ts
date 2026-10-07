// B3 (RENA-026): a pre-accept job carries customerFirstName, an outward
// postcode and the town instead of clientName and address. The cleaner cards
// read clientName and address, so every fetch point passes rows through this
// one adapter; an assigned row already carries both and passes unchanged.

type RawJob = {
  clientName?: unknown;
  customerFirstName?: unknown;
  address?: unknown;
  postcode?: unknown;
  city?: unknown;
  status?: unknown;
  isOffer?: unknown;
};

export function normalizeCleanerJob<T extends object>(
  input: T
): T & { clientName: string; address: string; isOffer: boolean } {
  const raw = input as T & RawJob;
  const clientName =
    typeof raw.clientName === 'string'
      ? raw.clientName
      : typeof raw.customerFirstName === 'string'
        ? raw.customerFirstName
        : 'Customer';
  const address =
    typeof raw.address === 'string'
      ? raw.address
      : [raw.postcode, raw.city].filter((p) => typeof p === 'string' && p).join(', ') || 'TBD';
  const isOffer =
    typeof raw.isOffer === 'boolean'
      ? raw.isOffer
      : String(raw.status ?? '').toUpperCase() === 'AWAITING_CLEANER';
  return { ...raw, clientName, address, isOffer };
}
