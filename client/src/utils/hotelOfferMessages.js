const unavailableMessages = {
  credentials_missing: 'Live offers are not configured on this server.',
  inventory_not_mapped: 'No matching provider inventory is mapped to this accommodation.',
  provider_disabled: 'Hotel offer lookup is currently disabled.',
  no_availability: 'No offers were returned for these dates and guests.',
  inventory_mismatch: 'The provider could not confirm inventory for this accommodation.',
  malformed_response: 'The provider returned offer data that could not be verified.',
  rate_limited: 'The provider is receiving too many requests. Please try again shortly.',
  upstream_timeout: 'The provider took too long to respond. Please try again.',
  upstream_error: 'Hotel offers are temporarily unavailable. Please try again.',
};

export function getUnavailableOfferMessage(reason) {
  return unavailableMessages[reason] ?? 'No confirmed provider offer is available.';
}
