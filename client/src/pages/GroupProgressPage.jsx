import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import GroupNavigation from '../components/GroupNavigation.jsx';
import { getGroupProgress } from '../services/groupService.js';
import { getApiErrorMessage } from '../utils/apiErrors.js';

export default function GroupProgressPage() {
  const { groupId = '' } = useParams();
  const [progress, setProgress] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setError('');
    getGroupProgress(groupId, { signal: controller.signal })
      .then(setProgress)
      .catch((requestError) => {
        if (requestError.code === 'ERR_CANCELED') return;
        setError(getApiErrorMessage(requestError, 'Could not load group progress.'));
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [groupId, retryCount]);

  return (
    <section className="page-shell py-8 pb-16 sm:py-12 sm:pb-20">
      <div className="mx-auto max-w-3xl">
        <GroupNavigation groupId={groupId} />
        <div className="mt-7">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#c55338]">
            Group progress
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.06em] sm:text-4xl">
            Everyone’s progress
          </h1>
          <p className="mt-2 text-sm text-[#77756e]">
            Members are finished when they have reviewed every eligible stay.
          </p>
          <button
            className="mt-4 rounded-full border border-[#24231f]/15 px-4 py-2 text-sm font-semibold"
            disabled={isLoading}
            onClick={() => setRetryCount((count) => count + 1)}
            type="button"
          >
            Refresh progress
          </button>
        </div>

        {isLoading ? (
          <div className="grid min-h-[300px] place-content-center text-center" role="status">
            <span className="mx-auto size-8 animate-spin rounded-full border-2 border-[#24231f]/15 border-t-[#ef6848]" />
            <p className="mt-4 text-sm text-[#77756e]">Loading group progress…</p>
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
        ) : progress ? (
          <div className="mt-6 rounded-3xl border border-[#24231f]/[0.08] bg-[#fffdf8] p-5 sm:p-8">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-sm text-[#77756e]">Members finished</p>
                <p className="mt-1 text-3xl font-semibold tracking-[-0.05em]">
                  {progress.completedMemberCount} of {progress.eligibleMemberCount}
                </p>
              </div>
              <p className="text-sm text-[#77756e]">
                {progress.totalEligibleHotels} eligible stays
              </p>
            </div>
            {progress.totalEligibleHotels === 0 ? (
              <p className="mt-6 rounded-2xl bg-[#f1eee6] p-4 text-sm leading-6 text-[#68665f]">
                No hotel records currently match this group’s selected destination, so review
                completion and matches are not available yet.
              </p>
            ) : (
              <ul className="mt-5 divide-y divide-[#24231f]/[0.08]">
                {progress.members.map((member) => (
                  <li
                    className="flex flex-wrap items-center justify-between gap-3 py-4"
                    key={member.memberId}
                  >
                    <span className="font-semibold">{member.displayName}</span>
                    <span
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                        member.completed
                          ? 'bg-[#e6eee2] text-[#52604b]'
                          : 'bg-[#f1eee6] text-[#68665f]'
                      }`}
                    >
                      {member.completed ? 'Finished' : 'Still deciding'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Link
              className="mt-5 inline-flex rounded-full bg-[#24231f] px-5 py-3 text-sm font-semibold text-white"
              to={`/groups/${groupId}/matches`}
            >
              See mutual matches
            </Link>
          </div>
        ) : null}
      </div>
    </section>
  );
}
