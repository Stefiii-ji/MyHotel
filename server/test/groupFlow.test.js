import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import express from 'express';
import { createGroupHandlers } from '../src/controllers/groupController.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import {
  createRequireGroupMembership,
  requireGroupCreator,
} from '../src/middleware/groupMembership.js';
import { createGroupRateLimit } from '../src/middleware/groupRateLimit.js';
import { createGroupSchema } from '../src/validators/groupValidators.js';
import { createGroupRouter } from '../src/routes/groupRoutes.js';

const now = Date.now();
const validDetails = {
  name: 'Mumbai weekend',
  creatorName: 'Asha',
  cities: ['Mumbai'],
  localities: ['Bandra', 'Colaba'],
  checkIn: '2026-11-12',
  checkOut: '2026-11-15',
  budgetPerNight: 5000,
};

class FakeQuery {
  constructor(value) {
    this.value = value;
  }

  select() {
    return this;
  }

  then(resolve, reject) {
    return Promise.resolve(this.value).then(resolve, reject);
  }
}

class FakeGroup {
  constructor(details) {
    Object.assign(this, details);
    this._id = '507f1f77bcf86cd799439011';
  }

  async save() {
    FakeGroup.record = this;
    return this;
  }

  static async create(details) {
    this.record = new FakeGroup(details);
    return this.record;
  }

  static findOne(filter) {
    const group = this.record;
    const expiry = filter.expiresAt?.$gt;
    const invitationExpiry = filter.invitationExpiresAt?.$gt;
    const matches =
      group &&
      group.invitationTokenHash === filter.invitationTokenHash &&
      group.invitationStatus === filter.invitationStatus &&
      group.expiresAt > expiry &&
      group.invitationExpiresAt > invitationExpiry;
    return new FakeQuery(matches ? group : null);
  }

  static findById(id) {
    return new FakeQuery(this.record?._id === id ? this.record : null);
  }

  static findOneAndUpdate(filter, update) {
    const group = this.record;
    const newMember = update.$push.members;
    const valid =
      group &&
      group._id === filter._id &&
      group.invitationTokenHash === filter.invitationTokenHash &&
      group.invitationStatus === filter.invitationStatus &&
      group.invitationExpiresAt > filter.invitationExpiresAt.$gt &&
      group.expiresAt > filter.expiresAt.$gt &&
      group.members.filter(
        (member) => !member.removedAt && member.expiresAt > filter.expiresAt.$gt,
      ).length < 12 &&
      !group.members.some((member) => member.credentialHash === newMember.credentialHash);
    if (valid) group.members.push(newMember);
    return new FakeQuery(valid ? group : null);
  }
}

function createResponse() {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
    append(name, value) {
      const current = this.headers[name] ?? [];
      this.headers[name] = [...current, value];
      return this;
    },
  };
}

function createHandlers() {
  return createGroupHandlers({
    Group: FakeGroup,
    clientOrigin: 'https://stayswipe.example',
    isProduction: true,
    now: () => now,
  });
}

function createRequest({ body, groupId, memberId, cookie = '' } = {}) {
  return {
    body,
    params: { groupId, memberId },
    get(name) {
      return name.toLowerCase() === 'cookie' ? cookie : undefined;
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

function tokenFromUrl(url) {
  return new URL(url).pathname.split('/').at(-1);
}

function cookieFrom(response) {
  const header = response.headers['Set-Cookie'][0];
  return header.slice(0, header.indexOf(';'));
}

function cookieSecret(cookie) {
  return cookie.slice(cookie.indexOf('=') + 1);
}

test('validates group details, paired dates, and unavailable verified-rating preferences', () => {
  assert.equal(createGroupSchema.safeParse(validDetails).success, true);
  assert.equal(
    createGroupSchema.safeParse({ ...validDetails, checkOut: undefined }).success,
    false,
  );
  assert.equal(
    createGroupSchema.safeParse({ ...validDetails, checkIn: '2026-02-30' }).success,
    false,
  );
  assert.equal(
    createGroupSchema.safeParse({ ...validDetails, minimumRating: 4 }).success,
    false,
  );
});

test('creates a group with hashed invitation and member credentials and joins without an account', async () => {
  const handlers = createHandlers();
  const { response } = await call(handlers.createGroup, createRequest({ body: validDetails }));
  const token = tokenFromUrl(response.body.invitationUrl);
  const creatorCookie = cookieFrom(response);
  const creatorCredential = cookieSecret(creatorCookie);

  assert.equal(response.statusCode, 201);
  assert.equal(FakeGroup.record.invitationTokenHash, createHash('sha256').update(token).digest('hex'));
  assert.notEqual(FakeGroup.record.invitationTokenHash, token);
  assert.equal(FakeGroup.record.members.length, 1);
  assert.notEqual(FakeGroup.record.members[0].credentialHash, creatorCredential);
  assert.match(response.headers['Set-Cookie'][0], /HttpOnly/);
  assert.match(response.headers['Set-Cookie'][0], /Secure/);
  assert.equal(response.body.group.canManage, true);
  assert.equal(response.body.group.members[0].isCurrentMember, true);
  assert.equal(JSON.stringify(response.body.group).includes('credentialHash'), false);
  assert.equal(JSON.stringify(response.body.group).includes('guestId'), false);

  const joined = await call(
    handlers.joinGroup,
    createRequest({ body: { token, displayName: 'Ravi' } }),
  );
  assert.equal(joined.response.statusCode, 201);
  assert.equal(joined.response.body.group.members.length, 2);
  assert.equal(joined.response.body.group.canManage, false);
  assert.equal(joined.response.body.group.members[1].isCurrentMember, true);
  assert.match(joined.response.headers['Set-Cookie'][0], /HttpOnly/);
});

test('reloads a persisted group lobby through its route id and member cookie', async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/groups', createGroupRouter({
    Group: FakeGroup,
    Swipe: {},
    Hotel: {},
    clientOrigin: 'http://localhost:5173',
    isProduction: false,
  }));
  app.use(errorHandler);

  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const { port } = server.address();
    const baseUrl = `http://127.0.0.1:${port}/api/groups`;
    const createdResponse = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validDetails),
    });
    const created = await createdResponse.json();
    const groupId = created.group.id;
    const cookie = createdResponse.headers.get('set-cookie').split(';', 1)[0];

    const lobbyResponse = await fetch(`${baseUrl}/${groupId}`, {
      headers: { cookie },
    });
    const lobby = await lobbyResponse.json();

    assert.equal(createdResponse.status, 201);
    assert.equal(lobbyResponse.status, 200);
    assert.equal(lobby.group.id, groupId);
    assert.equal(lobby.group.name, validDetails.name);
    assert.equal(lobby.group.canManage, true);
    assert.equal(FakeGroup.record._id, groupId);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
});

test('rejects invalid and revoked invitation links', async () => {
  const handlers = createHandlers();
  const { response: created } = await call(
    handlers.createGroup,
    createRequest({ body: validDetails }),
  );
  const token = tokenFromUrl(created.body.invitationUrl);

  const invalidToken = `${token[0] === 'A' ? 'B' : 'A'}${token.slice(1)}`;
  const invalid = await call(
    handlers.joinGroup,
    createRequest({ body: { token: invalidToken, displayName: 'Ravi' } }),
  );
  assert.equal(invalid.error.statusCode, 404);

  const revoked = await call(
    handlers.revokeInvitation,
    {
      ...createRequest({ groupId: FakeGroup.record._id }),
      group: FakeGroup.record,
      groupMember: FakeGroup.record.members[0],
    },
  );
  assert.equal(revoked.response.body.group.invitationStatus, 'revoked');
  const denied = await call(
    handlers.joinGroup,
    createRequest({ body: { token, displayName: 'Ravi' } }),
  );
  assert.equal(denied.error.statusCode, 404);
  assert.equal(FakeGroup.record.members.length, 1);
});

test('rejects an expired invitation even when its original token is supplied', async () => {
  const handlers = createHandlers();
  const { response: created } = await call(
    handlers.createGroup,
    createRequest({ body: validDetails }),
  );
  const token = tokenFromUrl(created.body.invitationUrl);
  FakeGroup.record.invitationExpiresAt = new Date(now - 1);

  const result = await call(
    handlers.joinGroup,
    createRequest({ body: { token, displayName: 'Ravi' } }),
  );
  assert.equal(result.error.statusCode, 404);
  assert.equal(FakeGroup.record.members.length, 1);
});

test('returns the existing membership on a duplicate join from the same device', async () => {
  const handlers = createHandlers();
  const { response: created } = await call(
    handlers.createGroup,
    createRequest({ body: validDetails }),
  );
  const token = tokenFromUrl(created.body.invitationUrl);
  const firstJoin = await call(
    handlers.joinGroup,
    createRequest({ body: { token, displayName: 'Ravi' } }),
  );
  const cookie = cookieFrom(firstJoin.response);

  const duplicate = await call(
    handlers.joinGroup,
    createRequest({ body: { token, displayName: 'Ravi' }, cookie }),
  );
  assert.equal(duplicate.error, undefined);
  assert.equal(FakeGroup.record.members.length, 2);
  assert.equal(duplicate.response.body.group.members.length, 2);
  assert.equal(cookieSecret(cookieFrom(duplicate.response)), cookieSecret(cookie));
});

test('requires a valid per-group cookie and denies unauthorized owner actions', async () => {
  const handlers = createHandlers();
  const { response: created } = await call(
    handlers.createGroup,
    createRequest({ body: validDetails }),
  );
  const groupId = FakeGroup.record._id;
  const requireMembership = createRequireGroupMembership({ Group: FakeGroup });
  const unauthorized = createRequest({ groupId });
  let unauthorizedError;
  await requireMembership(unauthorized, createResponse(), (error) => {
    unauthorizedError = error;
  });
  assert.equal(unauthorizedError.statusCode, 401);

  const creatorCookie = cookieFrom(created);
  const authorizedRequest = createRequest({ groupId, cookie: creatorCookie });
  let authorizedError;
  await requireMembership(authorizedRequest, createResponse(), (error) => {
    authorizedError = error;
  });
  assert.equal(authorizedError, undefined);
  assert.equal(authorizedRequest.groupMember.isCreator, true);

  const token = tokenFromUrl(created.body.invitationUrl);
  const joined = await call(
    handlers.joinGroup,
    createRequest({ body: { token, displayName: 'Ravi' } }),
  );
  const member = FakeGroup.record.members[1];
  let ownerError;
  requireGroupCreator(
    { groupMember: member },
    {},
    (error) => {
      ownerError = error;
    },
  );
  assert.equal(ownerError.statusCode, 403);
  assert.ok(cookieFrom(joined.response));
});

test('caps group membership and rate-limits repeated join attempts', async () => {
  const handlers = createHandlers();
  const { response: created } = await call(
    handlers.createGroup,
    createRequest({ body: validDetails }),
  );
  const token = tokenFromUrl(created.body.invitationUrl);
  FakeGroup.record.members = Array.from({ length: 12 }, (_, index) => ({
    memberId: `member-${index}`,
    displayName: `Member ${index}`,
    credentialHash: `hash-${index}`,
    expiresAt: FakeGroup.record.expiresAt,
    isCreator: index === 0,
  }));
  const full = await call(
    handlers.joinGroup,
    createRequest({ body: { token, displayName: 'Ravi' } }),
  );
  assert.equal(full.error.statusCode, 409);

  let time = now;
  const rateLimit = createGroupRateLimit({ limit: 2, intervalMs: 1000, now: () => time });
  rateLimit({ ip: '192.0.2.1' }, {}, (error) => assert.equal(error, undefined));
  rateLimit({ ip: '192.0.2.1' }, {}, (error) => assert.equal(error, undefined));
  let rateError;
  rateLimit({ ip: '192.0.2.1' }, {}, (error) => { rateError = error; });
  assert.equal(rateError.statusCode, 429);
  time += 1000;
  rateLimit({ ip: '192.0.2.1' }, {}, (error) => assert.equal(error, undefined));
});

test('removes a member and immediately invalidates that device credential', async () => {
  const handlers = createHandlers();
  const { response: created } = await call(
    handlers.createGroup,
    createRequest({ body: validDetails }),
  );
  const token = tokenFromUrl(created.body.invitationUrl);
  const joined = await call(
    handlers.joinGroup,
    createRequest({ body: { token, displayName: 'Ravi' } }),
  );
  const removedMember = FakeGroup.record.members[1];

  const removed = await call(handlers.removeMember, {
    ...createRequest({ groupId: FakeGroup.record._id, memberId: removedMember.memberId }),
    group: FakeGroup.record,
    groupMember: FakeGroup.record.members[0],
  });
  assert.equal(removed.response.body.group.members.length, 1);
  assert.equal(FakeGroup.record.members.length, 2);
  assert.ok(FakeGroup.record.members[1].removedAt);

  const requireMembership = createRequireGroupMembership({ Group: FakeGroup });
  let revokedError;
  await requireMembership(
    createRequest({
      groupId: FakeGroup.record._id,
      cookie: cookieFrom(joined.response),
    }),
    createResponse(),
    (error) => {
      revokedError = error;
    },
  );
  assert.equal(revokedError.statusCode, 401);

  const staleRejoin = await call(
    handlers.joinGroup,
    createRequest({
      body: { token, displayName: 'Ravi' },
      cookie: cookieFrom(joined.response),
    }),
  );
  assert.equal(staleRejoin.error.statusCode, 403);
  assert.equal(FakeGroup.record.members.length, 2);
});

test('rotation invalidates the old invite and returns a fresh link', async () => {
  const handlers = createHandlers();
  const { response: created } = await call(
    handlers.createGroup,
    createRequest({ body: validDetails }),
  );
  const oldToken = tokenFromUrl(created.body.invitationUrl);
  const oldHash = FakeGroup.record.invitationTokenHash;
  const rotated = await call(
    handlers.rotateInvitation,
    {
      ...createRequest({ groupId: FakeGroup.record._id }),
      group: FakeGroup.record,
      groupMember: FakeGroup.record.members[0],
    },
  );
  const newToken = tokenFromUrl(rotated.response.body.invitationUrl);

  assert.notEqual(newToken, oldToken);
  assert.notEqual(FakeGroup.record.invitationTokenHash, oldHash);
  assert.notEqual(FakeGroup.record.invitationTokenHash, newToken);
  assert.equal(
    (await call(handlers.joinGroup, createRequest({ body: { token: oldToken, displayName: 'Ravi' } })))
      .error.statusCode,
    404,
  );
  assert.equal(
    (await call(handlers.joinGroup, createRequest({ body: { token: newToken, displayName: 'Ravi' } })))
      .response.statusCode,
    201,
  );
});
