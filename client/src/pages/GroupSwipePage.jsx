import { useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Link, useParams } from 'react-router-dom';
import GroupNavigation from '../components/GroupNavigation.jsx';
import HotelCard from '../components/HotelCard.jsx';
import { getHotels } from '../services/hotelService.js';
import {
  getGroup,
  getGroupProgress,
  getMyGroupSwipes,
  submitGroupSwipe,
} from '../services/groupService.js';
import { getApiErrorMessage } from '../utils/apiErrors.js';
import { getAllCityHotels } from '../utils/hotelPagination.js';

const pageSize = 100;

async function getGroupHotels(cities, localities, signal) {
  const cityResults = await Promise.all(cities.map((city) =>
    getAllCityHotels(getHotels, { city, limit: pageSize, signal }),
  ));

  const selectedLocalities = new Set(localities.map((locality) => locality.toLocaleLowerCase()));
  const hotelsById = new Map();
  for (const hotel of cityResults.flat()) {
    if (
      !selectedLocalities.size ||
      selectedLocalities.has((hotel.locality ?? '').toLocaleLowerCase())
    ) {
      hotelsById.set(hotel.id, hotel);
    }
  }
  return [...hotelsById.values()].sort((first, second) => first.name.localeCompare(second.name));
}

export default function GroupSwipePage() {
  const { groupId = '' } = useParams();
  const [group, setGroup] = useState(null);
  const [hotels, setHotels] = useState([]);
  const [swipes, setSwipes] = useState({});
  const [progress, setProgress] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [pendingHotelId, setPendingHotelId] = useState('');
  const [failedVote, setFailedVote] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const pendingRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setLoadError('');

    async function load() {
      try {
        const { group: currentGroup } = await getGroup(groupId, { signal: controller.signal });
        const [eligibleHotels, mySwipes, currentProgress] = await Promise.all([
          getGroupHotels(currentGroup.cities, currentGroup.localities, controller.signal),
          getMyGroupSwipes(groupId, { signal: controller.signal }),
          getGroupProgress(groupId, { signal: controller.signal }),
        ]);
        if (controller.signal.aborted) return;
        const decisions = Object.fromEntries(
          mySwipes.items.map((swipe) => [swipe.hotelId, swipe.action]),
        );
        setGroup(currentGroup);
        setHotels(eligibleHotels);
        setSwipes(decisions);
        setProgress(currentProgress);
      } catch (error) {
        if (controller.signal.aborted) return;
        setLoadError(
          getApiErrorMessage(error, 'Could not load group stays. Please try again.'),
        );
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }

    load();
    return () => controller.abort();
  }, [groupId, retryCount]);

  async function submitVote(hotel, action) {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPendingHotelId(hotel.id);
    setActionError('');
    setNotice('');
    setFailedVote(null);
    try {
      const result = await submitGroupSwipe(groupId, hotel.id, action);
      setSwipes((current) => ({ ...current, [hotel.id]: result.swipe.action }));
      setNotice(result.swipe.action === 'like' ? 'Your like was saved.' : 'Your pass was saved.');
      try {
        setProgress(await getGroupProgress(groupId));
      } catch (error) {
        setActionError(getApiErrorMessage(error, 'Swipe saved, but progress could not refresh.'));
      }
    } catch (error) {
      setActionError(getApiErrorMessage(error, 'Your swipe could not be saved.'));
      setFailedVote({ hotel, action });
    } finally {
      pendingRef.current = false;
      setPendingHotelId('');
    }
  }

  const currentHotel = hotels.find((hotel) => !swipes[hotel.id]);
  const reviewedHotels = hotels.filter((hotel) => swipes[hotel.id]);

  if (isLoading) {
    return (
      <section className="page-shell grid min-h-[60vh] place-items-center" role="status">
        <p className="text-sm text-[#77756e]">Loading group stays and your saved swipes…</p>
      </section>
    );
  }

  if (loadError || !group) {
    return (
      <section className="page-shell py-12">
        <div className="mx-auto max-w-xl rounded-3xl border border-red-200 bg-red-50 p-7 text-center">
          <h1 className="text-2xl font-semibold">Could not open group swiping</h1>
          <p className="mt-3 text-sm text-red-800" role="alert">
            {loadError || 'Group information is unavailable.'}
          </p>
          <button
            className="mt-5 rounded-full border border-red-300 px-5 py-2.5 text-sm font-semibold"
            onClick={() => setRetryCount((count) => count + 1)}
            type="button"
          >
            Retry
          </button>
          <Link className="ml-3 text-sm font-semibold underline" to={`/groups/${groupId}`}>
            Return to lobby
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="page-shell py-8 pb-16 sm:py-12 sm:pb-20">
      <div className="mx-auto max-w-3xl">
        <GroupNavigation groupId={groupId} />
        <div className="mt-7">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#c55338]">
            Group stays
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.06em] sm:text-4xl">
            {group.name}
          </h1>
          <p className="mt-2 text-sm text-[#77756e]">
            {progress
              ? `${progress.completedMemberCount} of ${progress.eligibleMemberCount} members finished · ${reviewedHotels.length} of ${hotels.length} stays reviewed by you`
              : 'Your choices are saved to this group.'}
          </p>
        </div>

        {actionError && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
            <span>{actionError}</span>
            {failedVote && (
              <button
                className="rounded-full border border-red-300 px-4 py-2 font-semibold"
                disabled={Boolean(pendingHotelId)}
                onClick={() => submitVote(failedVote.hotel, failedVote.action)}
                type="button"
              >
                Retry swipe
              </button>
            )}
          </div>
        )}
        {notice && (
          <p className="mt-4 rounded-xl bg-[#f0f3ed] px-4 py-3 text-sm text-[#52604b]" role="status">
            {notice}
          </p>
        )}

        {currentHotel ? (
          <>
            <div className="relative mx-auto mt-6 w-full max-w-[560px]">
              <div aria-hidden="true" className="absolute inset-x-3 -bottom-2 top-3 rounded-[2rem] bg-[#e7e2d8]" />
              <AnimatePresence mode="wait">
                <HotelCard
                  draggable={!pendingHotelId}
                  hotel={currentHotel}
                  key={currentHotel.id}
                  onDecision={(_hotelId, action) => submitVote(currentHotel, action)}
                />
              </AnimatePresence>
            </div>
            <div className="mt-6 flex items-center justify-center gap-4 sm:gap-6">
              <button
                aria-label="Pass on this hotel"
                className="grid size-14 place-items-center rounded-full border border-[#24231f]/10 bg-[#fffdf8] text-2xl text-[#bf5c4a] shadow-sm disabled:opacity-40"
                disabled={Boolean(pendingHotelId)}
                onClick={() => submitVote(currentHotel, 'reject')}
                type="button"
              >
                ×
              </button>
              <button
                aria-label="Like this hotel"
                className="grid size-14 place-items-center rounded-full bg-[#65735d] text-2xl text-white shadow-sm disabled:opacity-40"
                disabled={Boolean(pendingHotelId)}
                onClick={() => submitVote(currentHotel, 'like')}
                type="button"
              >
                ♥
              </button>
            </div>
            <p className="mt-3 text-center text-xs text-[#77756e]">
              {pendingHotelId ? 'Saving your choice…' : 'Swipe, drag, or choose an action'}
            </p>
          </>
        ) : hotels.length === 0 ? (
          <div className="mt-7 rounded-3xl border border-[#24231f]/10 bg-[#fffdf8] p-8 text-center">
            <h2 className="text-xl font-semibold">No stays in this group’s destination yet</h2>
            <p className="mt-2 text-sm leading-6 text-[#77756e]">
              The current hotel listings do not contain records for the selected cities and
              localities.
            </p>
          </div>
        ) : (
          <div className="mt-7 rounded-3xl border border-[#24231f]/10 bg-[#fffdf8] p-8 text-center">
            <h2 className="text-xl font-semibold">You’ve reviewed every stay in this group</h2>
            <p className="mt-2 text-sm leading-6 text-[#77756e]">
              {progress?.complete
                ? 'Everyone has finished. Check the group’s mutual matches.'
                : `${progress?.completedMemberCount ?? 0} of ${progress?.eligibleMemberCount ?? group.members.length} members have finished reviewing.`}
            </p>
            <Link
              className="mt-5 inline-flex rounded-full bg-[#24231f] px-5 py-3 text-sm font-semibold text-white"
              to={`/groups/${groupId}/matches`}
            >
              View mutual matches
            </Link>
          </div>
        )}

        {reviewedHotels.length > 0 && (
          <section className="mt-10">
            <h2 className="text-xl font-semibold tracking-[-0.04em]">Your reviewed stays</h2>
            <p className="mt-1 text-sm text-[#77756e]">
              Change a choice at any time; saved votes are updated rather than duplicated.
            </p>
            <ul className="mt-4 divide-y divide-[#24231f]/[0.08] rounded-2xl border border-[#24231f]/[0.08] bg-[#fffdf8] px-4">
              {reviewedHotels.map((hotel) => (
                <li className="flex flex-wrap items-center justify-between gap-3 py-4" key={hotel.id}>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{hotel.name}</p>
                    <p className="mt-1 text-xs text-[#77756e]">
                      {swipes[hotel.id] === 'like' ? 'You liked this stay' : 'You passed on this stay'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {['like', 'reject'].map((action) => (
                      <button
                        className="rounded-full border border-[#24231f]/15 px-3 py-2 text-xs font-semibold disabled:opacity-40"
                        disabled={Boolean(pendingHotelId) || swipes[hotel.id] === action}
                        key={action}
                        onClick={() => submitVote(hotel, action)}
                        type="button"
                      >
                        {action === 'like' ? 'Like' : 'Pass'}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </section>
  );
}
