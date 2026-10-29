import { useEffect, useRef, useState } from 'react';
import { getHotelOffers } from '../services/hotelService.js';
import { getUnavailableOfferMessage } from '../utils/hotelOfferMessages.js';
import { getApiErrorMessage } from '../utils/apiErrors.js';

function localDateOffset(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function dateAfter(value) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function formatAmount(amount, currency) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
}

export default function HotelOffersPanel({ hotelId }) {
  const [checkIn, setCheckIn] = useState(() => localDateOffset(1));
  const [checkOut, setCheckOut] = useState(() => localDateOffset(2));
  const [guests, setGuests] = useState('2');
  const [currency, setCurrency] = useState('INR');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const requestRef = useRef(null);

  useEffect(() => () => requestRef.current?.abort(), []);

  async function submit(event) {
    event.preventDefault();
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setError('');
    setResult(null);
    setIsLoading(true);
    try {
      const response = await getHotelOffers(
        hotelId,
        { checkIn, checkOut, guests: Number(guests), currency },
        { signal: controller.signal },
      );
      setResult(response.item);
    } catch (requestError) {
      if (requestError.code !== 'ERR_CANCELED') {
        setError(getApiErrorMessage(requestError, 'Could not check hotel offers.'));
      }
    } finally {
      if (!controller.signal.aborted) setIsLoading(false);
    }
  }

  const offer = result?.offer;
  return (
    <section className="mt-6 rounded-2xl border border-[#24231f]/10 bg-white/70 p-4 sm:p-5">
      <h3 className="text-base font-semibold">Check provider offers</h3>
      <p className="mt-1 text-xs leading-5 text-[#77756e]">
        Prices are requested only when you check. Availability and totals can change.
      </p>
      <form className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4" onSubmit={submit}>
        <label className="text-xs font-medium text-[#68665f]">
          Check-in
          <input
            className="mt-1 w-full rounded-xl border border-[#24231f]/15 bg-[#fffdf8] px-3 py-2 text-sm text-[#24231f]"
            min={localDateOffset(0)}
            onChange={(event) => {
              const nextCheckIn = event.target.value;
              setCheckIn(nextCheckIn);
              if (checkOut <= nextCheckIn) setCheckOut(dateAfter(nextCheckIn));
            }}
            required
            type="date"
            value={checkIn}
          />
        </label>
        <label className="text-xs font-medium text-[#68665f]">
          Check-out
          <input
            className="mt-1 w-full rounded-xl border border-[#24231f]/15 bg-[#fffdf8] px-3 py-2 text-sm text-[#24231f]"
            min={checkIn ? dateAfter(checkIn) : localDateOffset(1)}
            onChange={(event) => setCheckOut(event.target.value)}
            required
            type="date"
            value={checkOut}
          />
        </label>
        <label className="text-xs font-medium text-[#68665f]">
          Guests (adults)
          <select
            className="mt-1 w-full rounded-xl border border-[#24231f]/15 bg-[#fffdf8] px-3 py-2 text-sm text-[#24231f]"
            onChange={(event) => setGuests(event.target.value)}
            value={guests}
          >
            {[1, 2, 3, 4, 5, 6, 7, 8].map((count) => (
              <option key={count} value={count}>{count}</option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-[#68665f]">
          Currency
          <select
            className="mt-1 w-full rounded-xl border border-[#24231f]/15 bg-[#fffdf8] px-3 py-2 text-sm text-[#24231f]"
            onChange={(event) => setCurrency(event.target.value)}
            value={currency}
          >
            {['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'JPY', 'AUD', 'CAD'].map((code) => (
              <option key={code} value={code}>{code}</option>
            ))}
          </select>
        </label>
        <button
          className="col-span-2 mt-1 rounded-full bg-[#65735d] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-60 sm:col-span-4"
          disabled={isLoading}
          type="submit"
        >
          {isLoading ? 'Checking offers…' : 'Check offers'}
        </button>
        <p className="col-span-2 -mt-1 text-[0.7rem] text-[#77756e] sm:col-span-4">
          Offer search is for one room; guest count is sent as the adult count.
        </p>
      </form>

      {isLoading && <p className="mt-3 text-sm text-[#77756e]" role="status">Contacting the offer provider…</p>}
      {error && (
        <div className="mt-3 text-sm text-red-800" role="alert">
          <p><strong>Price unavailable.</strong> {error}</p>
          <button className="mt-2 font-semibold underline" onClick={submit} type="button">
            Retry
          </button>
        </div>
      )}
      {!isLoading && result?.availability === 'unavailable' && (
        <p className="mt-3 text-sm text-[#77756e]" role="status">
          <strong>Price unavailable.</strong>{' '}
          {getUnavailableOfferMessage(result.reason)}
        </p>
      )}
      {offer && (
        <div className="mt-4 border-t border-[#24231f]/10 pt-4">
          {result.mode === 'test' && (
            <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
              Amadeus test-mode response — this is not live inventory or a confirmed booking price.
            </p>
          )}
          <p className="text-lg font-semibold">
            {formatAmount(offer.totalStayPrice, offer.currency)} total stay
          </p>
          {offer.nightlyAverage !== null && (
            <p className="mt-1 text-sm text-[#68665f]">
              {formatAmount(offer.nightlyAverage, offer.currency)} nightly average
            </p>
          )}
          {(offer.taxes.length > 0 || offer.fees.length > 0) && (
            <div className="mt-3 space-y-1 text-xs text-[#68665f]">
              {offer.taxes.map((tax, index) => (
                <p key={`tax-${index}`}>
                  Tax{tax.code ? ` (${tax.code})` : ''}: {formatAmount(tax.amount, tax.currency)}
                  {tax.included === null ? '' : tax.included ? ' · included in total' : ' · not included in total'}
                </p>
              ))}
              {offer.fees.map((fee, index) => (
                <p key={`fee-${index}`}>
                  Fee{fee.code ? ` (${fee.code})` : ''}: {formatAmount(fee.amount, fee.currency)}
                  {fee.included === null ? '' : fee.included ? ' · included in total' : ' · not included in total'}
                </p>
              ))}
            </div>
          )}
          {(offer.room.description || offer.room.category || offer.boardType) && (
            <p className="mt-3 text-xs text-[#68665f]">
              {[offer.room.description, offer.room.category, offer.boardType].filter(Boolean).join(' · ')}
            </p>
          )}
          {offer.cancellation && (
            <p className="mt-2 text-xs text-[#68665f]">
              Cancellation: {[offer.cancellation.type, offer.cancellation.deadline].filter(Boolean).join(' · ') || 'terms supplied by provider'}
            </p>
          )}
          <p className="mt-3 text-xs text-[#77756e]">
            Retrieved {new Date(result.retrievedAt).toLocaleString()}
          </p>
          {offer.bookingUrl && (
            <a
              className="mt-3 inline-flex rounded-full border border-[#24231f]/15 px-4 py-2 text-sm font-semibold hover:border-[#24231f]/40"
              href={offer.bookingUrl}
              rel="noreferrer"
              target="_blank"
            >
              View provider booking page
            </a>
          )}
        </div>
      )}
    </section>
  );
}
