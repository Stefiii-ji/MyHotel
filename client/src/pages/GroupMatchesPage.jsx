import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import GroupNavigation from '../components/GroupNavigation.jsx';
import HotelCard from '../components/HotelCard.jsx';
import { getGroupMatches, getGroupProgress } from '../services/groupService.js';
import { getApiErrorMessage } from '../utils/apiErrors.js';

export default function GroupMatchesPage() {
  const { groupId = '' } = useParams();
  const [matches, setMatches] = useState([]);
  const [progress, setProgress] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setError('');
    Promise.all([
      getGroupMatches(groupId, { signal: controller.signal }),
      getGroupProgress(groupId, { signal: controller.signal }),
    ])
      .then(([matchResult, currentProgress]) => {
        setMatches(matchResult.items);
        setProgress(currentProgress);
      })
      .catch((requestError) => {
        if (requestError.code === 'ERR_CANCELED') return;
        setError(getApiErrorMessage(requestError, 'Could not load group matches.'));
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [groupId, retryCount]);

  return (
    <section className="page-shell py-8 pb-16 sm:py-12 sm:pb-20">
      <div className="mx-auto max-w-5xl">
        <GroupNavigation groupId={groupId} />
        <div className="mt-7">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#c55338]">
            Everyone’s picks
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.06em] sm:text-4xl">
            Mutual matches
          </h1>
          {progress && (
            <p className="mt-2 text-sm text-[#77756e]">
              {progress.completedMemberCount} of {progress.eligibleMemberCount} members finished
            </p>
          )}
          <button
            className="mt-4 rounded-full border border-[#24231f]/15 px-4 py-2 text-sm font-semibold"
            disabled={isLoading}
            onClick={() => setRetryCount((count) => count + 1)}
            type="button"
          >
            Refresh matches
          </button>
        </div>

        {isLoading ? (
          <div className="grid min-h-[300px] place-content-center text-center" role="status">
            <span className="mx-auto size-8 animate-spin rounded-full border-2 border-[#24231f]/15 border-t-[#ef6848]" />
            <p className="mt-4 text-sm text-[#77756e]">Checking everyone’s choices…</p>
          </div>
        ) : error ? (
          <div className="mt-6 rounded-3xl border border-red-200 bg-red-50 p-7 text-center">
            <p className="text-sm text-red-800" role="alert">{error}</p>
            <button
              className="mt-5 rounded-full border border-red-300 px-5 py-2.5 text-sm font-semibold"
              onClick={() => setRetryCount((count) => count + 1)}
              type="button"
            >
              Retry
            </button>
          </div>
        ) : matches.length ? (
          <div className="mt-6 grid items-start gap-5 md:grid-cols-2">
            {matches.map((hotel) => (
              <article
                className="rounded-[2rem] border border-[#24231f]/[0.08] bg-[#fffdf8] p-3"
                key={hotel.id}
              >
                <HotelCard draggable={false} hotel={hotel} onDecision={() => {}} />
                <Link
                  className="mt-3 inline-flex rounded-full border border-[#24231f]/15 px-4 py-2.5 text-sm font-semibold hover:border-[#24231f]/40"
                  to={`/hotels/${hotel.id}`}
                >
                  Open hotel details
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-3xl border border-[#24231f]/10 bg-[#fffdf8] px-6 py-12 text-center">
            <span aria-hidden="true" className="text-4xl">♡</span>
            <h2 className="mt-4 text-xl font-semibold">No mutual matches yet</h2>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[#77756e]">
              A stay appears here only after every current group member likes it. A pass or a
              missing choice means it is not a match.
              {progress?.complete
                ? ' Everyone has finished deciding; there are no shared picks yet.'
                : ` ${progress?.completedMemberCount ?? 0} of ${progress?.eligibleMemberCount ?? 0} members have finished deciding.`}
            </p>
            <Link
              className="mt-5 inline-flex rounded-full bg-[#65735d] px-5 py-3 text-sm font-semibold text-white"
              to={`/groups/${groupId}/swipe`}
            >
              Continue swiping
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
