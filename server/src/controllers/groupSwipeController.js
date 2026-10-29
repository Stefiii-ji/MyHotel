import { serializeHotel } from './hotelController.js';
import { swipeSchema } from '../validators/groupValidators.js';
import { httpError } from '../utils/httpError.js';
import { escapeRegex } from '../utils/regex.js';

export function eligibleHotelFilter(group) {
  const filter = {
    city: {
      $in: group.cities.map((city) => new RegExp(`^${escapeRegex(city)}$`, 'i')),
    },
  };
  if (group.localities?.length) {
    filter.locality = {
      $in: group.localities.map((locality) => new RegExp(`^${escapeRegex(locality)}$`, 'i')),
    };
  }
  return filter;
}

function eligibleMembers(group, currentTime = new Date()) {
  return group.members.filter(
    (member) => !member.removedAt && member.expiresAt > currentTime,
  );
}

async function getEligibleHotels(Hotel, group) {
  return Hotel.find(eligibleHotelFilter(group)).select('_id').lean();
}

function toId(value) {
  return String(value?._id ?? value);
}

export function createGroupSwipeHandlers({ Swipe, Hotel, now = Date.now }) {
  async function submitSwipe(request, response, next) {
    const parsed = swipeSchema.safeParse(request.body);
    if (!parsed.success) {
      next(httpError(400, 'Invalid hotel id or swipe action'));
      return;
    }

    try {
      const currentTime = new Date(now());
      const members = eligibleMembers(request.group, currentTime);
      if (!members.some((member) => member.memberId === request.groupMember.memberId)) {
        next(httpError(403, 'This group membership is not eligible to vote'));
        return;
      }

      const hotel = await Hotel.findOne({
        _id: parsed.data.hotelId,
        ...eligibleHotelFilter(request.group),
      })
        .select('_id')
        .lean();
      if (!hotel) {
        next(httpError(404, 'Hotel not found in this group destination'));
        return;
      }

      const identity = {
        groupId: request.group._id,
        memberId: request.groupMember.memberId,
        hotelId: hotel._id,
      };
      let swipe;
      try {
        swipe = await Swipe.findOneAndUpdate(
          identity,
          { $set: { action: parsed.data.action } },
          { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
        ).lean();
      } catch (error) {
        if (error?.code !== 11000) throw error;
        swipe = await Swipe.findOneAndUpdate(
          identity,
          { $set: { action: parsed.data.action } },
          { new: true, runValidators: true },
        ).lean();
      }

      response.json({
        swipe: {
          hotelId: toId(swipe.hotelId),
          action: swipe.action,
          createdAt: swipe.createdAt,
          updatedAt: swipe.updatedAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async function getMySwipes(request, response, next) {
    try {
      const hotels = await getEligibleHotels(Hotel, request.group);
      const hotelIds = hotels.map((hotel) => hotel._id);
      const swipes = await Swipe.find({
        groupId: request.group._id,
        memberId: request.groupMember.memberId,
        hotelId: { $in: hotelIds },
      })
        .select('hotelId action createdAt updatedAt')
        .sort({ updatedAt: -1 })
        .lean();
      response.json({
        items: swipes.map((swipe) => ({
          hotelId: toId(swipe.hotelId),
          action: swipe.action,
          createdAt: swipe.createdAt,
          updatedAt: swipe.updatedAt,
        })),
      });
    } catch (error) {
      next(error);
    }
  }

  async function getProgress(request, response, next) {
    try {
      const currentTime = new Date(now());
      const members = eligibleMembers(request.group, currentTime);
      const hotels = await getEligibleHotels(Hotel, request.group);
      const hotelIds = hotels.map((hotel) => hotel._id);
      const completion = await Promise.all(
        members.map(async (member) => {
          const reviewedHotelIds = hotelIds.length
            ? await Swipe.distinct('hotelId', {
                groupId: request.group._id,
                memberId: member.memberId,
                hotelId: { $in: hotelIds },
              })
            : [];
          const completed =
            hotelIds.length > 0 && reviewedHotelIds.length === hotelIds.length;
          return {
            memberId: member.memberId,
            displayName: member.displayName,
            completed,
          };
        }),
      );
      const completedMembers = completion.filter((member) => member.completed).length;
      response.json({
        eligibleMemberCount: members.length,
        completedMemberCount: completedMembers,
        totalEligibleHotels: hotelIds.length,
        members: completion,
        complete: hotelIds.length > 0 && completedMembers === members.length,
      });
    } catch (error) {
      next(error);
    }
  }

  async function getMatches(request, response, next) {
    try {
      const members = eligibleMembers(request.group, new Date(now()));
      const hotels = await getEligibleHotels(Hotel, request.group);
      if (!members.length || !hotels.length) {
        response.json({ items: [], total: 0 });
        return;
      }

      const hotelIds = hotels.map((hotel) => hotel._id);
      const votes = await Swipe.find({
        groupId: request.group._id,
        memberId: { $in: members.map((member) => member.memberId) },
        hotelId: { $in: hotelIds },
        action: 'like',
      })
        .select('hotelId memberId')
        .lean();
      const likesByHotel = new Map();
      for (const vote of votes) {
        const hotelId = toId(vote.hotelId);
        const likedBy = likesByHotel.get(hotelId) ?? new Set();
        likedBy.add(vote.memberId);
        likesByHotel.set(hotelId, likedBy);
      }

      const matchIds = [...likesByHotel.entries()]
        .filter(([, likedBy]) => likedBy.size === members.length)
        .map(([hotelId]) => hotelId);
      if (!matchIds.length) {
        response.json({ items: [], total: 0 });
        return;
      }

      const matchedHotels = await Hotel.find({
        _id: { $in: matchIds },
        ...eligibleHotelFilter(request.group),
      })
        .sort({ name: 1 })
        .lean();
      response.json({
        items: matchedHotels.map((hotel) => ({
          ...serializeHotel(hotel),
          detailUrl: `/api/hotels/${String(hotel._id)}`,
        })),
        total: matchedHotels.length,
      });
    } catch (error) {
      next(error);
    }
  }

  return { submitSwipe, getMySwipes, getProgress, getMatches };
}
