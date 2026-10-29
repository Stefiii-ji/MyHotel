import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createGroup } from '../services/groupService.js';
import { getApiErrorMessage } from '../utils/apiErrors.js';
import { useRecentGroup } from '../context/RecentGroupContext.jsx';

const cityOptions = ['Mumbai', 'Navi Mumbai'];

export default function GroupCreatePage() {
  const navigate = useNavigate();
  const { rememberGroup } = useRecentGroup();
  const [name, setName] = useState('');
  const [creatorName, setCreatorName] = useState('');
  const [cities, setCities] = useState(['Mumbai']);
  const [localities, setLocalities] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [budgetPerNight, setBudgetPerNight] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  function toggleCity(city) {
    setCities((selected) =>
      selected.includes(city) ? selected.filter((item) => item !== city) : [...selected, city],
    );
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      const { group, invitationUrl } = await createGroup({
        name,
        creatorName,
        cities,
        localities: localities
          .split(',')
          .map((locality) => locality.trim())
          .filter(Boolean),
        ...(checkIn ? { checkIn, checkOut } : {}),
        budgetPerNight: Number(budgetPerNight),
      });
      rememberGroup(group);
      navigate(`/groups/${group.id}`, { state: { invitationUrl }, replace: true });
    } catch (requestError) {
      setError(getApiErrorMessage(
        requestError,
        'The group could not be created. Check your details and try again.',
      ));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="page-shell py-8 pb-16 sm:py-12 sm:pb-20">
      <div className="mx-auto max-w-2xl">
        <Link className="text-sm font-semibold text-[#65735d] hover:underline" to="/">
          ← StaySwipe
        </Link>
        <p className="mt-8 text-xs font-bold uppercase tracking-[0.18em] text-[#c55338]">
          Start planning
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.06em] sm:text-4xl">
          Create your group
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-[#77756e]">
          Set the trip basics, then invite people with a private link. You can join without creating
          an account.
        </p>

        <form
          className="mt-8 space-y-6 rounded-3xl border border-[#24231f]/[0.08] bg-[#fffdf8] p-5 sm:p-8"
          onSubmit={handleSubmit}
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold sm:col-span-2">
              Group name
              <input
                autoComplete="off"
                className="rounded-xl border border-[#24231f]/15 bg-white px-4 py-3 font-normal outline-none focus:border-[#65735d]"
                maxLength={80}
                onChange={(event) => setName(event.target.value)}
                required
                value={name}
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold sm:col-span-2">
              Your name in the group
              <input
                autoComplete="nickname"
                className="rounded-xl border border-[#24231f]/15 bg-white px-4 py-3 font-normal outline-none focus:border-[#65735d]"
                maxLength={40}
                onChange={(event) => setCreatorName(event.target.value)}
                required
                value={creatorName}
              />
            </label>
          </div>

          <fieldset>
            <legend className="text-sm font-semibold">Destination</legend>
            <div className="mt-3 flex flex-wrap gap-3">
              {cityOptions.map((city) => (
                <label
                  className="flex items-center gap-2 rounded-full border border-[#24231f]/15 px-4 py-2.5 text-sm"
                  key={city}
                >
                  <input
                    checked={cities.includes(city)}
                    onChange={() => toggleCity(city)}
                    type="checkbox"
                  />
                  {city}
                </label>
              ))}
            </div>
            <label className="mt-4 grid gap-2 text-sm font-semibold">
              Localities <span className="font-normal text-[#77756e]">(optional, comma-separated)</span>
              <input
                className="rounded-xl border border-[#24231f]/15 bg-white px-4 py-3 font-normal outline-none focus:border-[#65735d]"
                onChange={(event) => setLocalities(event.target.value)}
                placeholder="For example: Bandra, Colaba, Vashi"
                value={localities}
              />
            </label>
          </fieldset>

          <div className="grid gap-5 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold">
              Check-in <span className="font-normal text-[#77756e]">(optional)</span>
              <input
                className="rounded-xl border border-[#24231f]/15 bg-white px-4 py-3 font-normal outline-none focus:border-[#65735d]"
                onChange={(event) => setCheckIn(event.target.value)}
                type="date"
                value={checkIn}
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Check-out <span className="font-normal text-[#77756e]">(optional)</span>
              <input
                className="rounded-xl border border-[#24231f]/15 bg-white px-4 py-3 font-normal outline-none focus:border-[#65735d]"
                min={checkIn || undefined}
                onChange={(event) => setCheckOut(event.target.value)}
                type="date"
                value={checkOut}
              />
            </label>
          </div>

          <label className="grid gap-2 text-sm font-semibold">
            Maximum budget per night (₹)
            <input
              className="rounded-xl border border-[#24231f]/15 bg-white px-4 py-3 font-normal outline-none focus:border-[#65735d]"
              min="1"
              onChange={(event) => setBudgetPerNight(event.target.value)}
              required
              type="number"
              value={budgetPerNight}
            />
          </label>

          <p className="rounded-2xl bg-[#f1eee6] p-4 text-sm leading-6 text-[#68665f]">
            Verified hotel ratings are not available in the current listings, so a minimum rating
            preference cannot be applied yet.
          </p>

          {error && (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
              {error}
            </p>
          )}
          <button
            className="w-full rounded-full bg-[#24231f] px-6 py-3.5 text-sm font-semibold text-[#fffaf4] transition hover:bg-[#514e46] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isSubmitting || cities.length === 0 || !budgetPerNight || Boolean(checkIn) !== Boolean(checkOut)}
            type="submit"
          >
            {isSubmitting ? 'Creating group…' : 'Create group'}
          </button>
        </form>
      </div>
    </section>
  );
}
