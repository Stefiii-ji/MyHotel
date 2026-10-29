import { Router } from 'express';
import { createGroupHandlers } from '../controllers/groupController.js';
import { createGroupSwipeHandlers } from '../controllers/groupSwipeController.js';
import {
  createRequireGroupMembership,
  requireAllowedOrigin,
  requireGroupCreator,
  validateEmptyBody,
  validateGroupId,
  validateMemberId,
} from '../middleware/groupMembership.js';
import { createGroupRateLimit } from '../middleware/groupRateLimit.js';

export function createGroupRouter({ Group, Swipe, Hotel, clientOrigin, isProduction }) {
  const router = Router();
  const handlers = createGroupHandlers({ Group, clientOrigin, isProduction });
  const swipeHandlers = createGroupSwipeHandlers({ Swipe, Hotel });
  const requireMembership = createRequireGroupMembership({ Group });
  const rateLimitJoin = createGroupRateLimit();
  const rateLimitCreate = createGroupRateLimit({ limit: 5, intervalMs: 60 * 60 * 1000 });
  const rateLimitSwipe = createGroupRateLimit({
    limit: 120,
    intervalMs: 60 * 1000,
    message: 'Too many swipes. Please wait before trying again.',
    keyForRequest: (request) => `${request.group._id}:${request.groupMember.memberId}`,
  });
  const rateLimitInvitation = createGroupRateLimit({
    limit: 10,
    intervalMs: 60 * 60 * 1000,
    message: 'Too many invitation changes. Please try again later.',
    keyForRequest: (request) => `${request.group._id}:${request.groupMember.memberId}`,
  });
  const rateLimitMemberRemoval = createGroupRateLimit({
    limit: 20,
    intervalMs: 60 * 60 * 1000,
    message: 'Too many member changes. Please try again later.',
    keyForRequest: (request) => `${request.group._id}:${request.groupMember.memberId}`,
  });
  const checkOrigin = requireAllowedOrigin(clientOrigin);

  router.use((_request, response, next) => {
    response.set('Cache-Control', 'no-store');
    next();
  });

  router.post('/', checkOrigin, rateLimitCreate, handlers.createGroup);
  router.post('/join', checkOrigin, rateLimitJoin, handlers.joinGroup);
  router.post(
    '/:groupId/swipes',
    checkOrigin,
    validateGroupId,
    requireMembership,
    rateLimitSwipe,
    swipeHandlers.submitSwipe,
  );
  router.get(
    '/:groupId/swipes/me',
    validateGroupId,
    requireMembership,
    swipeHandlers.getMySwipes,
  );
  router.get(
    '/:groupId/progress',
    validateGroupId,
    requireMembership,
    swipeHandlers.getProgress,
  );
  router.get(
    '/:groupId/matches',
    validateGroupId,
    requireMembership,
    swipeHandlers.getMatches,
  );
  router.get(
    '/:groupId',
    validateEmptyBody,
    validateGroupId,
    requireMembership,
    handlers.getGroup,
  );
  router.patch(
    '/:groupId/ready',
    checkOrigin,
    validateGroupId,
    requireMembership,
    handlers.setReady,
  );
  router.post(
    '/:groupId/invitation',
    checkOrigin,
    validateEmptyBody,
    validateGroupId,
    requireMembership,
    requireGroupCreator,
    rateLimitInvitation,
    handlers.rotateInvitation,
  );
  router.delete(
    '/:groupId/invitation',
    checkOrigin,
    validateEmptyBody,
    validateGroupId,
    requireMembership,
    requireGroupCreator,
    rateLimitInvitation,
    handlers.revokeInvitation,
  );
  router.delete(
    '/:groupId/members/:memberId',
    checkOrigin,
    validateEmptyBody,
    validateGroupId,
    validateMemberId,
    requireMembership,
    requireGroupCreator,
    rateLimitMemberRemoval,
    handlers.removeMember,
  );

  return router;
}
