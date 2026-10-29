import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveApiBaseUrl } from '../src/utils/apiBaseUrl.js';

test('uses localhost only as the development default', () => {
  assert.equal(resolveApiBaseUrl(undefined, true), 'http://localhost:5000/api');
  assert.equal(
    resolveApiBaseUrl('http://127.0.0.1:5000/api', true),
    'http://127.0.0.1:5000/api',
  );
});

test('requires a configured API URL for production builds', () => {
  assert.throws(() => resolveApiBaseUrl(undefined, false), /must be configured/);
});

test('rejects insecure, malformed, and loopback production API URLs', () => {
  assert.throws(() => resolveApiBaseUrl('/api', false), /absolute HTTPS URL/);
  assert.throws(
    () => resolveApiBaseUrl('http://api.example.com/api', false),
    /public HTTPS URL/,
  );
  assert.throws(
    () => resolveApiBaseUrl('https://localhost:5000/api', false),
    /public HTTPS URL/,
  );
  assert.throws(
    () => resolveApiBaseUrl('https://127.0.0.1:5000/api', false),
    /public HTTPS URL/,
  );
  const credentialedUrl = new URL('https://api.example.com/api');
  credentialedUrl.username = 'test-user';
  credentialedUrl.password = 'test-password';
  assert.throws(
    () => resolveApiBaseUrl(credentialedUrl.toString(), false),
    /must not contain credentials/,
  );
});

test('accepts a configured public HTTPS API URL in production', () => {
  assert.equal(
    resolveApiBaseUrl('https://api.example.com/api', false),
    'https://api.example.com/api',
  );
});
