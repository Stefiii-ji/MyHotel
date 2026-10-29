import { createHash, randomBytes, randomUUID } from 'node:crypto';
import {
  hashCredential,
  membershipCookieName,
  readCookie,
  setMembershipCookie,
} from '../middleware/groupMembership.js';
import {
  createGroupSchema,
  joinGroupSchema,
  memberIdSchema,
  readySchema,
} from '../validators/groupValidators.js';
import { httpError } from '../utils/httpError.js';

const maxGroupSize = 12;
const membershipLifetimeMs = 30 * 24 * 60 * 60 * 1000;
const invitationLifetimeMs = 7 * 24 * 60 * 60 * 1000;

function hashInvitation(token) {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

function generateSecret() {
  return randomBytes(32).toString('base64url');
}

function getActiveMembers(group, currentTime) {
  return group.members.filter(
    (member) => !member.removedAt && member.expiresAt > currentTime,
  );
}

function safeGroup(group, currentMember, currentTime = new Date()) {
  return {
    id: String(group._id),
    name: group.name,
    cities: group.cities,
    localities: group.localities ?? [],
    checkIn: group.checkIn ? new Date(group.checkIn).toISOString().slice(0, 10) : null,
    checkOut: group.checkOut ? new Date(group.checkOut).toISOString().slice(0, 10) : null,
    budgetPerNight: group.budgetPerNight,
    minimumRating: group.minimumRating ?? null,
    invitationStatus: group.invitationStatus,
    expiresAt: group.expiresAt,
    canManage: Boolean(currentMember?.isCreator),
    members: getActiveMembers(group, currentTime).map((member) => ({
      id: member.memberId,
      displayName: member.displayName,
      state: member.ready ? 'ready' : 'joined',
      isCreator: member.isCreator,
      isCurrentMember: member.memberId === currentMember?.memberId,
      joinedAt: member.joinedAt,
    })),
  };
}

function invitationUrl(clientOrigin, token) {
  return new URL(`/join/${token}`, clientOrigin).toString();
}

function groupQuery(Group, filter) {
  return Group.findOne(filter).select('+invitationTokenHash +members.credentialHash +members.guestId');
}

export function createGroupHandlers({ Group, clientOrigin, isProduction, now = Date.now }) {
  function setCookie(response, groupId, credential, expiresAt) {
    const maxAgeSeconds = Math.floor((new Date(expiresAt).getTime() - now()) / 1000);
    setMembershipCookie(response, groupId, credential, { isProduction, maxAgeSeconds });
  }

  async function createGroup(request, response, next) {
    const parsed = createGroupSchema.safeParse(request.body);
    if (!parsed.success) {
      next(httpError(400, 'Invalid group details'));
      return;
    }

    try {
      const currentTime = now();
      const expiresAt = new Date(currentTime + membershipLifetimeMs);
      const invitationToken = generateSecret();
      const credential = generateSecret();
      const creator = {
        memberId: randomUUID(),
        guestId: randomUUID(),
        displayName: parsed.data.creatorName,
        credentialHash: hashCredential(credential),
        joinedAt: new Date(currentTime),
        expiresAt,
        ready: false,
        isCreator: true,
      };
      const group = await Group.create({
        name: parsed.data.name,
        creatorMemberId: creator.memberId,
        cities: parsed.data.cities,
        localities: parsed.data.localities,
        checkIn: parsed.data.checkIn ? new Date(`${parsed.data.checkIn}T00:00:00.000Z`) : null,
        checkOut: parsed.data.checkOut ? new Date(`${parsed.data.checkOut}T00:00:00.000Z`) : null,
        budgetPerNight: parsed.data.budgetPerNight,
        minimumRating: parsed.data.minimumRating ?? null,
        members: [creator],
        invitationTokenHash: hashInvitation(invitationToken),
        invitationStatus: 'active',
        invitationExpiresAt: new Date(currentTime + invitationLifetimeMs),
        expiresAt,
      });

      setCookie(response, String(group._id), credential, expiresAt);
      response.status(201).json({
        group: safeGroup(group, creator),
        invitationUrl: invitationUrl(clientOrigin, invitationToken),
      });
    } catch (error) {
      next(error);
    }
  }

  async function joinGroup(request, response, next) {
    const parsed = joinGroupSchema.safeParse(request.body);
    if (!parsed.success) {
      next(httpError(400, 'Invalid invitation or display name'));
      return;
    }

    const tokenHash = hashInvitation(parsed.data.token);
    try {
      const currentTime = new Date(now());
      const group = await groupQuery(Group, {
        invitationTokenHash: tokenHash,
        invitationStatus: 'active',
        invitationExpiresAt: { $gt: currentTime },
        expiresAt: { $gt: currentTime },
      });
      if (!group) {
        next(httpError(404, 'Invitation is invalid, revoked, or expired'));
        return;
      }

      const credential = readCookie(request, membershipCookieName(String(group._id)));
      const credentialHash = credential ? hashCredential(credential) : '';
      const existingMember = credentialHash
        ? group.members.find((member) => member.credentialHash === credentialHash)
        : null;
      if (existingMember?.removedAt) {
        next(httpError(403, 'This group membership has been removed'));
        return;
      }
      if (existingMember && existingMember.expiresAt > currentTime) {
        setCookie(response, String(group._id), credential, existingMember.expiresAt);
        response.json({ group: safeGroup(group, existingMember) });
        return;
      }

      if (getActiveMembers(group, currentTime).length >= maxGroupSize) {
        next(httpError(409, 'This group has reached its member limit'));
        return;
      }

      const newCredential = generateSecret();
      const newMember = {
        memberId: randomUUID(),
        guestId: randomUUID(),
        displayName: parsed.data.displayName,
        credentialHash: hashCredential(newCredential),
        joinedAt: currentTime,
        expiresAt: group.expiresAt,
        ready: false,
        isCreator: false,
      };

      const updatedGroup = await Group.findOneAndUpdate(
        {
          _id: group._id,
          invitationTokenHash: tokenHash,
          invitationStatus: 'active',
          invitationExpiresAt: { $gt: currentTime },
          expiresAt: { $gt: currentTime },
          members: { $not: { $elemMatch: { credentialHash: newMember.credentialHash } } },
          $expr: {
            $lt: [
              {
                $size: {
                  $filter: {
                    input: '$members',
                    as: 'member',
                    cond: {
                      $and: [
                        { $eq: [{ $ifNull: ['$$member.removedAt', null] }, null] },
                        { $gt: ['$$member.expiresAt', currentTime] },
                      ],
                    },
                  },
                },
              },
              maxGroupSize,
            ],
          },
        },
        { $push: { members: newMember } },
        { new: true, runValidators: true },
      ).select('+members.credentialHash +members.guestId');

      if (!updatedGroup) {
        const latestGroup = await groupQuery(Group, {
          invitationTokenHash: tokenHash,
          invitationStatus: 'active',
          invitationExpiresAt: { $gt: currentTime },
          expiresAt: { $gt: currentTime },
        });
        if (!latestGroup) {
          next(httpError(404, 'Invitation is invalid, revoked, or expired'));
          return;
        }
        const joinedMember = credentialHash
          ? latestGroup.members.find((member) => member.credentialHash === credentialHash)
          : null;
        if (joinedMember && joinedMember.expiresAt > currentTime) {
          if (joinedMember.removedAt) {
            next(httpError(403, 'This group membership has been removed'));
            return;
          }
          setCookie(response, String(latestGroup._id), credential, joinedMember.expiresAt);
          response.json({ group: safeGroup(latestGroup, joinedMember) });
          return;
        }
        if (getActiveMembers(latestGroup, currentTime).length >= maxGroupSize) {
          next(httpError(409, 'This group has reached its member limit'));
          return;
        }
        next(httpError(409, 'The invitation changed. Please try the current link again.'));
        return;
      }

      setCookie(response, String(updatedGroup._id), newCredential, newMember.expiresAt);
      response.status(201).json({
        group: safeGroup(
          updatedGroup,
          updatedGroup.members.find((member) => member.memberId === newMember.memberId),
        ),
      });
    } catch (error) {
      next(error);
    }
  }

  function getGroup(request, response) {
    response.json({ group: safeGroup(request.group, request.groupMember) });
  }

  async function setReady(request, response, next) {
    const parsed = readySchema.safeParse(request.body);
    if (!parsed.success) {
      next(httpError(400, 'Invalid ready state'));
      return;
    }
    try {
      request.groupMember.ready = parsed.data.ready;
      await request.group.save();
      response.json({ group: safeGroup(request.group, request.groupMember) });
    } catch (error) {
      next(error);
    }
  }

  async function rotateInvitation(request, response, next) {
    try {
      const token = generateSecret();
      request.group.invitationTokenHash = hashInvitation(token);
      request.group.invitationStatus = 'active';
      request.group.invitationExpiresAt = new Date(now() + invitationLifetimeMs);
      await request.group.save();
      response.json({
        group: safeGroup(request.group, request.groupMember),
        invitationUrl: invitationUrl(clientOrigin, token),
      });
    } catch (error) {
      next(error);
    }
  }

  async function revokeInvitation(request, response, next) {
    try {
      request.group.invitationStatus = 'revoked';
      request.group.invitationExpiresAt = new Date(now());
      await request.group.save();
      response.json({ group: safeGroup(request.group, request.groupMember) });
    } catch (error) {
      next(error);
    }
  }

  async function removeMember(request, response, next) {
    const parsed = memberIdSchema.safeParse(request.params.memberId);
    if (!parsed.success) {
      next(httpError(400, 'Invalid member id'));
      return;
    }

    const memberIndex = request.group.members.findIndex(
      (member) => member.memberId === parsed.data,
    );
    if (memberIndex < 0) {
      next(httpError(404, 'Group member not found'));
      return;
    }
    if (request.group.members[memberIndex].removedAt) {
      next(httpError(404, 'Group member not found'));
      return;
    }
    if (request.group.members[memberIndex].isCreator) {
      next(httpError(400, 'The group creator cannot be removed'));
      return;
    }

    try {
      request.group.members[memberIndex].removedAt = new Date(now());
      await request.group.save();
      response.json({ group: safeGroup(request.group, request.groupMember) });
    } catch (error) {
      next(error);
    }
  }

  return {
    createGroup,
    joinGroup,
    getGroup,
    setReady,
    rotateInvitation,
    revokeInvitation,
    removeMember,
  };
}
