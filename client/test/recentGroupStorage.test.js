import assert from 'node:assert/strict';
import test from 'node:test';
import { readRecentGroup, writeRecentGroup } from '../src/utils/recentGroupStorage.js';

function createStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); },
    removeItem(key) { values.delete(key); },
    values,
  };
}

test('remembers only a non-secret group pointer across a lobby remount', () => {
  const storage = createStorage();
  const group = {
    id: '507f1f77bcf86cd799439011',
    name: 'Mumbai weekend',
    invitationToken: 'must-not-be-saved',
    membershipCredential: 'must-not-be-saved',
  };

  assert.equal(writeRecentGroup(group, storage), true);
  assert.deepEqual(readRecentGroup(storage), {
    id: group.id,
    name: group.name,
  });
  assert.equal([...storage.values.values()].some((value) =>
    value.includes('must-not-be-saved'),
  ), false);
});

test('rejects malformed or invalid stored group pointers', () => {
  const storage = createStorage();
  storage.setItem('stayswipe.recent-group', JSON.stringify({
    id: 'not-an-object-id',
    name: 'Unknown group',
  }));
  assert.equal(readRecentGroup(storage), null);
  assert.equal(writeRecentGroup({ id: 'invalid', name: 'No group' }, storage), false);
});
