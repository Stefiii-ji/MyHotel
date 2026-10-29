import assert from 'node:assert/strict';
import test from 'node:test';
import { getUnavailableOfferMessage } from '../src/utils/hotelOfferMessages.js';

test('shows clear fallbacks when provider credentials or inventory mappings are unavailable', () => {
  assert.match(getUnavailableOfferMessage('credentials_missing'), /not configured/);
  assert.match(getUnavailableOfferMessage('inventory_not_mapped'), /No matching provider inventory/);
  assert.match(getUnavailableOfferMessage('provider_disabled'), /disabled/);
});

test('falls back safely for an unknown offer-unavailable reason', () => {
  assert.equal(
    getUnavailableOfferMessage('unknown'),
    'No confirmed provider offer is available.',
  );
});
