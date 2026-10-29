import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import GroupNavigation from '../components/GroupNavigation.jsx';
import {
  getGroup,
  removeGroupMember,
  revokeInvitation,
  rotateInvitation,
  updateReady,
} from '../services/groupService.js';
import { getApiErrorMessage } from '../utils/apiErrors.js';
import { useRecentGroup } from '../context/RecentGroupContext.jsx';

function formatTripDates(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 'Dates not set';
  return `${new Date(`${checkIn}T00:00:00`).toLocaleDateString()} – ${new Date(`${checkOut}T00:00:00`).toLocaleDateString()}`;
}

async function copyText(value) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      // Fall through to the legacy clipboard API for non-secure local origins.
    }
  }

  const input = document.createElement('textarea');
  input.value = value;
  input.setAttribute('readonly', '');
  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.append(input);
  input.select();
  const copied = document.execCommand('copy');
  input.remove();
  if (!copied) throw new Error('Clipboard access is unavailable');
}

export default function GroupLobbyPage() {
  const { groupId = '' } = useParams();
  const location = useLocation();
  const { rememberGroup } = useRecentGroup();
  const [group, setGroup] = useState(null);
  const [invitationUrl, setInvitationUrl] = useState(location.state?.invitationUrl ?? '');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  const loadGroup = useCallback(async (signal) => {
    setError('');
    try {
      const result = await getGroup(groupId, { signal });
      setGroup(result.group);
      rememberGroup(result.group);
    } catch (requestError) {
      if (signal?.aborted) return;
      setError(getApiErrorMessage(
        requestError,
        'This group could not be loaded. You may need to join again using a current invitation.',
      ));
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, [groupId, rememberGroup]);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    void loadGroup(controller.signal);
    return () => controller.abort();
  }, [loadGroup]);

  const isCreator = group?.canManage ?? false;
  const currentMember = group?.members.find((member) => member.isCurrentMember);

  async function changeReady() {
    if (!group || isUpdating) return;
    setIsUpdating(true);
    setError('');
    try {
      const result = await updateReady(group.id, currentMember?.state !== 'ready');
      setGroup(result.group);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Could not update your ready status.'));
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleRotateInvitation() {
    setIsUpdating(true);
    setError('');
    setNotice('');
    try {
      const result = await rotateInvitation(group.id);
      setGroup(result.group);
      setInvitationUrl(result.invitationUrl);
      setNotice('A new invitation link is ready. Previous links no longer work.');
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Could not rotate the invitation.'));
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleRevokeInvitation() {
    setIsUpdating(true);
    setError('');
    setNotice('');
    try {
      const result = await revokeInvitation(group.id);
      setGroup(result.group);
      setInvitationUrl('');
      setNotice('The invitation has been revoked.');
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Could not revoke the invitation.'));
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleRemoveMember(memberId) {
    setIsUpdating(true);
    setError('');
    try {
      const result = await removeGroupMember(group.id, memberId);
      setGroup(result.group);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Could not remove this member.'));
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleCopyLink() {
    try {
      await copyText(invitationUrl);
      setNotice('Invitation link copied.');
    } catch {
      setError('Could not access the clipboard. Select and copy the invitation link instead.');
    }
  }

  async function handleShare() {
    if (!navigator.share) {
      await handleCopyLink();
      return;
    }
    try {
      await navigator.share({ title: `Join ${group.name}`, url: invitationUrl });
    } catch (shareError) {
      if (shareError.name !== 'AbortError') {
        setError('Could not share the link. Try copying it instead.');
      }
    }
  }

  if (isLoading) {
    return (
      <section className="page-shell grid min-h-[60vh] place-items-center" role="status">
        <p className="text-sm text-[#77756e]">Loading group…</p>
      </section>
    );
  }

  if (!group) {
    return (
      <section className="page-shell py-16">
        <div className="mx-auto max-w-lg rounded-3xl border border-red-200 bg-red-50 p-7 text-center">
          <h1 className="text-2xl font-semibold">Group unavailable</h1>
          <p className="mt-3 text-sm leading-6 text-red-800" role="alert">{error}</p>
          <Link className="mt-5 inline-block font-semibold underline" to="/groups/new">
            Create a group
          </Link>
        </div>
      </section>
    );
  }

  const destinations = [...group.cities, ...group.localities].join(' · ');
  const memberCount = group.members.length;
  const isReady = currentMember?.state === 'ready';

  return (
    <section className="page-shell py-8 pb-16 sm:py-12 sm:pb-20">
      <div className="mx-auto max-w-3xl">
        <Link className="text-sm font-semibold text-[#65735d] hover:underline" to="/">
          ← StaySwipe
        </Link>
        <div className="mt-5">
          <GroupNavigation groupId={groupId} />
        </div>
        <div className="mt-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#c55338]">Group lobby</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.06em] sm:text-4xl">{group.name}</h1>
            <p className="mt-2 text-sm text-[#77756e]">
              {memberCount} of 12 people · expires {new Date(group.expiresAt).toLocaleDateString()}
            </p>
          </div>
          <button
            className={`rounded-full px-5 py-3 text-sm font-semibold transition disabled:opacity-50 ${
              isReady ? 'bg-[#65735d] text-white' : 'border border-[#24231f]/20'
            }`}
            disabled={isUpdating}
            onClick={changeReady}
            type="button"
          >
            {isReady ? 'You’re ready ✓' : 'Mark me ready'}
          </button>
        </div>

        <div className="mt-7 grid gap-3 sm:grid-cols-3">
          <article className="rounded-2xl border border-[#24231f]/[0.08] bg-[#fffdf8] p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#77756e]">Destination</p>
            <p className="mt-2 font-semibold">{destinations || 'Not set'}</p>
          </article>
          <article className="rounded-2xl border border-[#24231f]/[0.08] bg-[#fffdf8] p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#77756e]">Trip dates</p>
            <p className="mt-2 font-semibold">{formatTripDates(group.checkIn, group.checkOut)}</p>
          </article>
          <article className="rounded-2xl border border-[#24231f]/[0.08] bg-[#fffdf8] p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#77756e]">Budget per night</p>
            <p className="mt-2 font-semibold">₹{group.budgetPerNight.toLocaleString('en-IN')}</p>
          </article>
        </div>

        <div className="mt-8 rounded-3xl border border-[#24231f]/[0.08] bg-[#fffdf8] p-5 sm:p-7">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold tracking-[-0.04em]">People in this group</h2>
              <p className="mt-1 text-sm text-[#77756e]">Joined and ready status is visible to members.</p>
            </div>
            <button
              className="text-sm font-semibold text-[#65735d] hover:underline"
              onClick={() => loadGroup()}
              type="button"
            >
              Refresh
            </button>
          </div>
          <ul className="mt-5 divide-y divide-[#24231f]/[0.08]">
            {group.members.map((member) => (
              <li className="flex flex-wrap items-center justify-between gap-3 py-4" key={member.id}>
                <div>
                  <p className="font-semibold">
                    {member.displayName}
                    {member.isCreator && (
                      <span className="ml-2 text-xs font-medium text-[#77756e]">Creator</span>
                    )}
                  </p>
                  <p className="mt-1 text-xs text-[#77756e]">
                    {member.state === 'ready' ? 'Ready' : 'Joined'}
                  </p>
                </div>
                {isCreator && !member.isCreator && (
                  <button
                    className="rounded-full border border-red-200 px-3 py-2 text-xs font-semibold text-red-800 disabled:opacity-50"
                    disabled={isUpdating}
                    onClick={() => handleRemoveMember(member.id)}
                    type="button"
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>

        {isCreator && (
          <div className="mt-6 rounded-3xl border border-[#d7dfd1] bg-[#f0f3ed] p-5 sm:p-7">
            <h2 className="text-xl font-semibold tracking-[-0.04em]">Invite people</h2>
            <p className="mt-2 text-sm leading-6 text-[#52604b]">
              Anyone with the link can join until it expires, is revoked, or the group reaches 12
              members. Rotate it if it is shared too widely.
            </p>
            {invitationUrl ? (
              <>
                <label className="mt-4 block text-xs font-semibold text-[#52604b]" htmlFor="invite-link">
                  Shareable invitation link
                </label>
                <input
                  className="mt-2 w-full min-w-0 rounded-xl border border-[#65735d]/25 bg-white px-3 py-3 text-sm"
                  id="invite-link"
                  readOnly
                  value={invitationUrl}
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    className="rounded-full bg-[#24231f] px-4 py-2.5 text-sm font-semibold text-white"
                    onClick={handleCopyLink}
                    type="button"
                  >
                    Copy link
                  </button>
                  <button
                    className="rounded-full border border-[#24231f]/20 px-4 py-2.5 text-sm font-semibold"
                    onClick={handleShare}
                    type="button"
                  >
                    Share
                  </button>
                </div>
              </>
            ) : (
              <p className="mt-4 text-sm font-semibold text-[#52604b]">
                Invitation: {group.invitationStatus}
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                className="rounded-full border border-[#24231f]/20 px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
                disabled={isUpdating}
                onClick={handleRotateInvitation}
                type="button"
              >
                {invitationUrl ? 'Rotate link' : 'Create new link'}
              </button>
              {group.invitationStatus === 'active' && (
                <button
                  className="rounded-full border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-800 disabled:opacity-50"
                  disabled={isUpdating}
                  onClick={handleRevokeInvitation}
                  type="button"
                >
                  Revoke link
                </button>
              )}
            </div>
          </div>
        )}

        {notice && (
          <p className="mt-4 rounded-xl bg-[#f0f3ed] px-4 py-3 text-sm text-[#52604b]" role="status">
            {notice}
          </p>
        )}
        {error && (
          <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
            {error}
          </p>
        )}
        <p className="mt-6 text-xs leading-5 text-[#77756e]">
          Membership is stored in this browser’s HTTP-only cookie and expires with the group. Do
          not share this device or cookie; leaving the group requires the creator to remove you.
        </p>
      </div>
    </section>
  );
}
