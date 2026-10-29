import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';
import Swipe from '../src/models/Swipe.js';
import { createGroupSwipeHandlers } from '../src/controllers/groupSwipeController.js';
import {
  createRequireGroupMembership,
  hashCredential,
  membershipCookieName,
  validateGroupId,
} from '../src/middleware/groupMembership.js';

const now = Date.now();
const groupId = '507f1f77bcf86cd799439011';
const hotelIds = [
  '507f1f77bcf86cd799439021',
  '507f1f77bcf86cd799439022',
  '507f1f77bcf86cd799439023',
];

function createMember(memberId, removedAt = null) {
  return {
    memberId,
    displayName: memberId,
    expiresAt: new Date(now + 60_000),
    removedAt,
  };
}

function createGroup(members = [createMember('member-1'), createMember('member-2')]) {
  return {
    _id: groupId,
    cities: ['Mumbai'],
    localities: [],
    members,
  };
}

function createHotels(ids = hotelIds) {
  return ids.map((id, index) => ({
    _id: new mongoose.Types.ObjectId(id),
    name: `Hotel ${index + 1}`,
    city: 'Mumbai',
    locality: '',
    source: 'openstreetmap',
    sourceId: `node/${index + 1}`,
    latitude: 19,
    longitude: 72,
    accommodationType: 'hotel',
    amenities: [],
    tags: {},
    imageUrls: [],
  }));
}

class FakeQuery {
  constructor(value) {
    this.value = value;
  }

  select() {
    return this;
  }

  sort() {
    return this;
  }

  lean() {
    return Promise.resolve(this.value);
  }

  then(resolve, reject) {
    return Promise.resolve(this.value).then(resolve, reject);
  }
}

function createModels(hotels = createHotels()) {
  const swipes = [];
  const Hotel = {
    find(filter) {
      if (filter._id?.$in) {
        return new FakeQuery(
          hotels.filter((hotel) =>
            filter._id.$in.some((id) => hotel._id.toString() === String(id)),
          ),
        );
      }
      const selected = hotels.filter((hotel) => {
        const cityPatterns = filter.city.$in;
        const matchesCity = cityPatterns.some((pattern) => pattern.test(hotel.city));
        if (!matchesCity) return false;
        if (!filter.locality) return true;
        return filter.locality.$in.some((pattern) => pattern.test(hotel.locality));
      });
      return new FakeQuery(selected);
    },
    findOne(filter) {
      const hotel = hotels.find(
        (candidate) =>
          candidate._id.toString() === String(filter._id) &&
          filter.city.$in.some((pattern) => pattern.test(candidate.city)) &&
          (!filter.locality ||
            filter.locality.$in.some((pattern) => pattern.test(candidate.locality))),
      );
      return new FakeQuery(hotel ?? null);
    },
  };

  const SwipeModel = {
    records: swipes,
    findOneAndUpdate(filter, update, options = {}) {
      let record = swipes.find(
        (item) =>
          item.groupId === String(filter.groupId) &&
          item.memberId === filter.memberId &&
          item.hotelId === String(filter.hotelId),
      );
      if (!record && options.upsert) {
        record = {
          groupId: String(filter.groupId),
          memberId: filter.memberId,
          hotelId: String(filter.hotelId),
          createdAt: new Date(now),
          updatedAt: new Date(now),
        };
        swipes.push(record);
      }
      if (record) {
        record.action = update.$set.action;
        record.updatedAt = new Date(now);
      }
      return new FakeQuery(record ?? null);
    },
    find(filter) {
      const records = swipes.filter((record) => {
        if (record.groupId !== String(filter.groupId)) return false;
        if (filter.memberId && typeof filter.memberId === 'string') {
          if (record.memberId !== filter.memberId) return false;
        }
        if (filter.memberId?.$in && !filter.memberId.$in.includes(record.memberId)) return false;
        if (filter.action && filter.action !== record.action) return false;
        return filter.hotelId.$in.some((id) => String(id) === record.hotelId);
      });
      return new FakeQuery(records);
    },
    async distinct(_field, filter) {
      return [...new Set(
        swipes
          .filter(
            (record) =>
              record.groupId === String(filter.groupId) &&
              record.memberId === filter.memberId &&
              filter.hotelId.$in.some((id) => String(id) === record.hotelId),
          )
          .map((record) => record.hotelId),
      )];
    },
  };

  return { Hotel, Swipe: SwipeModel };
}

function createResponse() {
  return {
    statusCode: 200,
    body: null,
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

async function call(handler, request) {
  const response = createResponse();
  let error;
  await handler(request, response, (nextError) => {
    error = nextError;
  });
  return { response, error };
}

function createRequest(group, memberId, body) {
  return {
    group,
    groupMember: group.members.find((member) => member.memberId === memberId),
    body,
  };
}

async function decide(handlers, group, memberId, hotelId, action) {
  return call(
    handlers.submitSwipe,
    createRequest(group, memberId, { hotelId, action }),
  );
}

async function matchesFor(members, votes) {
  const group = createGroup(members);
  const models = createModels();
  const handlers = createGroupSwipeHandlers({ ...models, now: () => now });
  for (const [memberId, hotelId, action] of votes) {
    await decide(handlers, group, memberId, hotelId, action);
  }
  const { response, error } = await call(
    handlers.getMatches,
    createRequest(group, members[0].memberId),
  );
  assert.equal(error, undefined);
  return { matches: response.body.items, models, handlers, group };
}

test('Swipe schema uses ObjectId hotel references and uniquely indexes group/member/hotel', () => {
  const index = Swipe.schema.indexes().find(
    ([keys, options]) =>
      keys.groupId === 1 &&
      keys.memberId === 1 &&
      keys.hotelId === 1 &&
      options.unique,
  );
  assert.ok(index);
  assert.equal(Swipe.schema.path('groupId').instance, 'ObjectId');
  assert.equal(Swipe.schema.path('memberId').instance, 'String');
  assert.equal(Swipe.schema.path('hotelId').instance, 'ObjectId');
  assert.deepEqual(Swipe.schema.path('action').enumValues, ['like', 'reject']);
});

test('rejects malformed group IDs before looking up membership', () => {
  let error;
  validateGroupId(
    { params: { groupId: 'not-an-object-id' } },
    {},
    (nextError) => {
      error = nextError;
    },
  );
  assert.equal(error.statusCode, 400);
});

test('two and three current members liking the same hotel create matches', async () => {
  const twoMembers = await matchesFor(
    [createMember('one'), createMember('two')],
    [['one', hotelIds[0], 'like'], ['two', hotelIds[0], 'like']],
  );
  assert.deepEqual(twoMembers.matches.map((hotel) => hotel.id), [hotelIds[0]]);

  const threeMembers = await matchesFor(
    [createMember('one'), createMember('two'), createMember('three')],
    [['one', hotelIds[0], 'like'], ['two', hotelIds[0], 'like'], ['three', hotelIds[0], 'like']],
  );
  assert.deepEqual(threeMembers.matches.map((hotel) => hotel.id), [hotelIds[0]]);
});

test('a reject, missing vote, or no votes prevents a match', async () => {
  const members = [createMember('one'), createMember('two')];
  assert.equal(
    (await matchesFor(members, [['one', hotelIds[0], 'like'], ['two', hotelIds[0], 'reject']]))
      .matches.length,
    0,
  );
  assert.equal(
    (await matchesFor(members, [['one', hotelIds[0], 'like']])).matches.length,
    0,
  );
  assert.equal((await matchesFor(members, [])).matches.length, 0);
});

test('repeated swipes upsert one decision and changing action recalculates matches', async () => {
  const { group, models, handlers } = await matchesFor(
    [createMember('one'), createMember('two')],
    [['one', hotelIds[0], 'like'], ['two', hotelIds[0], 'like']],
  );
  assert.equal(models.Swipe.records.length, 2);

  await decide(handlers, group, 'one', hotelIds[0], 'reject');
  assert.equal(models.Swipe.records.length, 2);
  const noLongerMatched = await call(
    handlers.getMatches,
    createRequest(group, 'one'),
  );
  assert.equal(noLongerMatched.response.body.total, 0);

  await decide(handlers, group, 'one', hotelIds[0], 'like');
  const matchedAgain = await call(handlers.getMatches, createRequest(group, 'one'));
  assert.equal(matchedAgain.response.body.total, 1);
});

test('member decision reads are private and progress reports completion rather than vote choices', async () => {
  const members = [createMember('one'), createMember('two')];
  const group = createGroup(members);
  const models = createModels();
  const handlers = createGroupSwipeHandlers({ ...models, now: () => now });
  await decide(handlers, group, 'one', hotelIds[0], 'like');

  const mine = await call(handlers.getMySwipes, createRequest(group, 'one'));
  assert.equal(mine.response.body.items.length, 1);
  assert.equal(mine.response.body.items[0].action, 'like');
  const theirs = await call(handlers.getMySwipes, createRequest(group, 'two'));
  assert.equal(theirs.response.body.items.length, 0);

  const progress = await call(handlers.getProgress, createRequest(group, 'one'));
  assert.equal(progress.response.body.eligibleMemberCount, 2);
  assert.equal(progress.response.body.completedMemberCount, 0);
  assert.equal(progress.response.body.totalEligibleHotels, hotelIds.length);
  assert.equal(progress.response.body.members[0].completed, false);
  assert.equal('action' in progress.response.body.members[0], false);
  await decide(handlers, group, 'one', hotelIds[1], 'reject');
  await decide(handlers, group, 'one', hotelIds[2], 'like');
  const completedProgress = await call(handlers.getProgress, createRequest(group, 'one'));
  assert.equal(completedProgress.response.body.completedMemberCount, 1);
  assert.equal(completedProgress.response.body.complete, false);
});

test('removed members do not count toward matches, progress, or historical votes', async () => {
  const removedAt = new Date(now);
  const members = [
    createMember('one'),
    createMember('two'),
    createMember('removed', removedAt),
  ];
  const group = createGroup(members);
  const models = createModels();
  const handlers = createGroupSwipeHandlers({ ...models, now: () => now });
  models.Swipe.records.push(
    { groupId, memberId: 'one', hotelId: hotelIds[0], action: 'like' },
    { groupId, memberId: 'two', hotelId: hotelIds[0], action: 'like' },
    { groupId, memberId: 'removed', hotelId: hotelIds[0], action: 'reject' },
  );
  const matchResult = await call(handlers.getMatches, createRequest(group, 'one'));
  const matches = matchResult.response.body.items;
  assert.deepEqual(matches.map((hotel) => hotel.id), [hotelIds[0]]);

  const progress = await call(handlers.getProgress, createRequest(group, 'one'));
  assert.equal(progress.response.body.eligibleMemberCount, 2);
  assert.equal(progress.response.body.members.some((member) => member.memberId === 'removed'), false);

  const removedSwipeRecordCount = models.Swipe.records.length;

  const removedSwipe = await call(
    handlers.submitSwipe,
    {
      group,
      groupMember: members[2],
      body: { hotelId: hotelIds[1], action: 'like' },
    },
  );
  assert.equal(removedSwipe.error.statusCode, 403);
  assert.equal(models.Swipe.records.length, removedSwipeRecordCount);
});

test('rejects invalid actions, malformed and nonexistent hotel IDs, and memberId in request body', async () => {
  const group = createGroup();
  const models = createModels();
  const handlers = createGroupSwipeHandlers({ ...models, now: () => now });
  for (const body of [
    { hotelId: hotelIds[0], action: 'skip' },
    { hotelId: 'not-an-object-id', action: 'like' },
    { hotelId: hotelIds[0], action: 'like', memberId: 'another-member' },
  ]) {
    const result = await call(handlers.submitSwipe, createRequest(group, 'member-1', body));
    assert.equal(result.error.statusCode, 400);
  }

  const missingHotel = await decide(handlers, group, 'member-1', '507f1f77bcf86cd799439099', 'like');
  assert.equal(missingHotel.error.statusCode, 404);
  assert.equal(models.Swipe.records.length, 0);
});

test('does not count members with no eligible hotels as finished', async () => {
  const group = createGroup([createMember('one')]);
  const models = createModels([]);
  const handlers = createGroupSwipeHandlers({ ...models, now: () => now });
  const result = await call(handlers.getProgress, createRequest(group, 'one'));
  assert.equal(result.response.body.totalEligibleHotels, 0);
  assert.equal(result.response.body.members[0].completed, false);
  assert.equal(result.response.body.complete, false);
});

test('requires a current membership cookie and rejects non-members and removed members', async () => {
  const member = createMember('current');
  member.credentialHash = hashCredential('member-secret');
  const removed = createMember('removed', new Date(now));
  removed.credentialHash = hashCredential('removed-secret');
  const group = createGroup([member, removed]);
  const Group = {
    findById(id) {
      return new FakeQuery(id === group._id ? group : null);
    },
  };
  const requireMembership = createRequireGroupMembership({ Group });

  async function authorize(cookie) {
    const request = {
      params: { groupId },
      get(name) {
        return name.toLowerCase() === 'cookie' ? cookie : undefined;
      },
    };
    let error;
    await requireMembership(request, {}, (nextError) => {
      error = nextError;
    });
    return { request, error };
  }

  assert.equal((await authorize('')).error.statusCode, 401);
  assert.equal(
    (await authorize(`${membershipCookieName(groupId)}=some-other-secret`)).error.statusCode,
    401,
  );
  const current = await authorize(`${membershipCookieName(groupId)}=member-secret`);
  assert.equal(current.error, undefined);
  assert.equal(current.request.groupMember.memberId, 'current');
  assert.equal(
    (await authorize(`${membershipCookieName(groupId)}=removed-secret`)).error.statusCode,
    401,
  );
});

test('rejects credentials from another group and expired member sessions', async () => {
  const firstGroupId = groupId;
  const secondGroupId = '507f1f77bcf86cd799439099';
  const firstMember = createMember('member-one');
  firstMember.credentialHash = hashCredential('first-group-secret');
  const secondMember = createMember('member-two');
  secondMember.credentialHash = hashCredential('second-group-secret');
  const expiredMember = createMember('expired');
  expiredMember.credentialHash = hashCredential('expired-secret');
  expiredMember.expiresAt = new Date(now - 1);
  const groups = new Map([
    [firstGroupId, { ...createGroup([firstMember]), _id: firstGroupId, expiresAt: new Date(now + 60_000) }],
    [secondGroupId, {
      ...createGroup([secondMember, expiredMember]),
      _id: secondGroupId,
      expiresAt: new Date(now + 60_000),
    }],
  ]);
  const Group = {
    findById(id) {
      return new FakeQuery(groups.get(id) ?? null);
    },
  };
  const requireMembership = createRequireGroupMembership({ Group });

  async function authorize(requestedGroupId, cookieValue) {
    const request = {
      params: { groupId: requestedGroupId },
      get(name) {
        return name.toLowerCase() === 'cookie'
          ? `${membershipCookieName(requestedGroupId)}=${cookieValue}`
          : undefined;
      },
    };
    let error;
    await requireMembership(request, {}, (nextError) => { error = nextError; });
    return error;
  }

  assert.equal(
    (await authorize(secondGroupId, 'first-group-secret')).statusCode,
    401,
  );
  assert.equal(
    (await authorize(secondGroupId, 'expired-secret')).statusCode,
    401,
  );
});

test('marks the group complete only after every current member reviews the full hotel pool', async () => {
  const members = [createMember('one'), createMember('two')];
  const group = createGroup(members);
  const models = createModels();
  const handlers = createGroupSwipeHandlers({ ...models, now: () => now });
  for (const member of members) {
    for (const hotelId of hotelIds) {
      await decide(handlers, group, member.memberId, hotelId, 'reject');
    }
  }
  const progress = await call(handlers.getProgress, createRequest(group, 'one'));
  assert.equal(progress.response.body.completedMemberCount, 2);
  assert.equal(progress.response.body.complete, true);
});
