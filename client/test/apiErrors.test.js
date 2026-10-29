import assert from 'node:assert/strict';
import test from 'node:test';
import { getApiErrorMessage } from '../src/utils/apiErrors.js';

test('uses a server API message when present and otherwise returns the local fallback', () => {
  assert.equal(
    getApiErrorMessage({ response: { data: { message: 'Group unavailable' } } }, 'Try again'),
    'Group unavailable',
  );
  assert.equal(getApiErrorMessage(new Error('Network error'), 'Try again'), 'Try again');
  assert.equal(
    getApiErrorMessage(
      { response: { data: { message: { unexpected: true } } } },
      'Try again',
    ),
    'Try again',
  );
});
