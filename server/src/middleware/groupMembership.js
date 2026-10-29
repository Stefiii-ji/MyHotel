import { createHash } from 'node:crypto';
import {
  emptyBodySchema,
  groupIdSchema,
  memberIdSchema,
} from '../validators/groupValidators.js';
import { httpError } from '../utils/httpError.js';

export function hashCredential(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function membershipCookieName(groupId) {
  return `stayswipe_group_${groupId}`;
}

export function readCookie(request, name) {
  const cookieHeader = request.get('cookie') ?? '';
  for (const cookie of cookieHeader.split(';')) {
    const separator = cookie.indexOf('=');
    if (separator < 0 || cookie.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(cookie.slice(separator + 1).trim());
    } catch {
      return '';
    }
  }
  return '';
}

export function setMembershipCookie(
  response,
  groupId,
  credential,
  { isProduction, maxAgeSeconds },
) {
  const attributes = [
    `${membershipCookieName(groupId)}=${encodeURIComponent(credential)}`,
    'Path=/api/groups',
    'HttpOnly',
    `SameSite=${isProduction ? 'None' : 'Lax'}`,
    `Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`,
  ];
  if (isProduction) attributes.push('Secure');
  response.append('Set-Cookie', attributes.join('; '));
}

export function validateGroupId(request, _response, next) {
  const parsed = groupIdSchema.safeParse(request.params.groupId);
  if (!parsed.success) {
    next(httpError(400, 'Invalid group id'));
    return;
  }
  next();
}

export function validateEmptyBody(request, _response, next) {
  if (request.body === undefined || emptyBodySchema.safeParse(request.body).success) {
    next();
    return;
  }
  next(httpError(400, 'This endpoint does not accept a request body'));
}

export function validateMemberId(request, _response, next) {
  if (!memberIdSchema.safeParse(request.params.memberId).success) {
    next(httpError(400, 'Invalid member id'));
    return;
  }
  next();
}

export function createRequireGroupMembership({ Group }) {
  return async function requireGroupMembership(request, _response, next) {
    try {
      const group = await Group.findById(request.params.groupId).select(
        '+members.credentialHash +members.guestId +invitationTokenHash',
      );
      if (!group || group.expiresAt <= new Date()) {
        next(httpError(404, 'Group not found or expired'));
        return;
      }

      const credential = readCookie(request, membershipCookieName(request.params.groupId));
      if (!credential) {
        next(httpError(401, 'Group membership is required'));
        return;
      }
      const credentialHash = hashCredential(credential);
      const member = group.members.find(
        (candidate) =>
          candidate.credentialHash === credentialHash &&
          candidate.expiresAt > new Date() &&
          !candidate.removedAt,
      );
      if (!member) {
        next(httpError(401, 'Group membership is required'));
        return;
      }

      request.group = group;
      request.groupMember = member;
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireGroupCreator(request, _response, next) {
  if (!request.groupMember?.isCreator) {
    next(httpError(403, 'Only the group creator can manage invitations or members'));
    return;
  }
  next();
}

export function requireAllowedOrigin(allowedOrigin) {
  return function checkRequestOrigin(request, _response, next) {
    const origin = request.get('origin');
    if (origin && origin !== allowedOrigin) {
      next(httpError(403, 'Request origin is not allowed'));
      return;
    }
    next();
  };
}
