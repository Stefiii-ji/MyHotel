import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { joinGroup } from '../services/groupService.js';
import { getApiErrorMessage } from '../utils/apiErrors.js';
import { useRecentGroup } from '../context/RecentGroupContext.jsx';

export default function GroupJoinPage() {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const { rememberGroup } = useRecentGroup();
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  async function handleJoin(event) {
    event.preventDefault();
    setError('');
    setIsJoining(true);
    try {
      const { group } = await joinGroup(token, displayName);
      rememberGroup(group);
      navigate(`/groups/${group.id}`, { replace: true });
    } catch (requestError) {
      setError(getApiErrorMessage(
        requestError,
        'This invitation could not be used. Ask the group creator for a current link.',
      ));
    } finally {
      setIsJoining(false);
    }
  }

  return (
    <section className="page-shell grid min-h-[65vh] place-items-center py-10">
      <form
        className="w-full max-w-md rounded-3xl border border-[#24231f]/[0.08] bg-[#fffdf8] p-6 sm:p-8"
        onSubmit={handleJoin}
      >
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#c55338]">
          You’re invited
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.06em]">Join the group</h1>
        <p className="mt-3 text-sm leading-6 text-[#77756e]">
          Choose a name to show in the group lobby. No permanent account is needed.
        </p>
        <label className="mt-7 grid gap-2 text-sm font-semibold">
          Your name
          <input
            autoComplete="nickname"
            className="rounded-xl border border-[#24231f]/15 bg-white px-4 py-3 font-normal outline-none focus:border-[#65735d]"
            maxLength={40}
            onChange={(event) => setDisplayName(event.target.value)}
            required
            value={displayName}
          />
        </label>
        {error && (
          <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
            {error}
          </p>
        )}
        <button
          className="mt-6 w-full rounded-full bg-[#24231f] px-6 py-3.5 text-sm font-semibold text-[#fffaf4] transition hover:bg-[#514e46] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isJoining || !token}
          type="submit"
        >
          {isJoining ? 'Joining…' : 'Join group'}
        </button>
        <Link className="mt-5 block text-center text-sm font-medium text-[#77756e] hover:underline" to="/">
          Back to StaySwipe
        </Link>
      </form>
    </section>
  );
}
