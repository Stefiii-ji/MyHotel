import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import HotelCard from '../components/HotelCard.jsx';
import HotelFilters from '../components/HotelFilters.jsx';
import { useHotelDemo } from '../context/HotelDemoContext.jsx';
import { getHotels } from '../services/hotelService.js';

const pageSize = 30;

export default function DiscoverPage() {
  const { decisions, decisionHistory, decide, undo } = useHotelDemo();
  const [area, setArea] = useState('');
  const [locality, setLocality] = useState('');
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const [pageData, setPageData] = useState({ items: [], pagination: null, attribution: null });
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const isTransitioningRef = useRef(false);
  const transitionTimerRef = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    const debounce = setTimeout(() => {
      setIsLoading(true);
      setLoadError('');
      getHotels(
        {
          ...(area ? { city: area } : {}),
          ...(locality.trim() ? { locality: locality.trim() } : {}),
          ...(type ? { type } : {}),
          page,
          limit: pageSize,
        },
        { signal: controller.signal },
      )
        .then((result) => {
          setPageData(result);
        })
        .catch((error) => {
          if (error.code === 'ERR_CANCELED') return;
          setLoadError('Hotel data is temporarily unavailable. Please try again later.');
          setPageData({ items: [], pagination: null, attribution: null });
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsLoading(false);
        });
    }, locality ? 250 : 0);

    return () => {
      clearTimeout(debounce);
      controller.abort();
    };
  }, [area, locality, type, page, retryCount]);

  useEffect(
    () => () => {
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    },
    [],
  );

  const hotels = pageData.items ?? [];
  const currentHotel = hotels.find((hotel) => !decisions[hotel.id]);
  const lastDecision = decisionHistory.at(-1);
  const attribution = pageData.attribution;
  const pageCount = pageData.pagination?.totalPages ?? 0;
  const pageLabel = useMemo(
    () =>
      pageData.pagination?.totalPages
        ? `Page ${pageData.pagination.page} of ${pageData.pagination.totalPages}`
        : '',
    [pageData.pagination],
  );

  function handleDecision(hotel, choice) {
    if (isTransitioningRef.current) return;
    isTransitioningRef.current = true;
    setIsTransitioning(true);
    decide(hotel, choice);
    transitionTimerRef.current = setTimeout(() => {
      isTransitioningRef.current = false;
      setIsTransitioning(false);
      transitionTimerRef.current = null;
    }, 300);
  }

  function handleExitComplete() {
    if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    transitionTimerRef.current = null;
    isTransitioningRef.current = false;
    setIsTransitioning(false);
  }

  function changeFilter(setter, value) {
    setter(value);
    setPage(1);
  }

  return (
    <section className="page-shell py-8 pb-16 sm:py-12 sm:pb-20">
      <div className="mx-auto max-w-3xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#c55338]">Explore stays</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.06em] sm:text-4xl">Find your kind of stay.</h1>
            <p className="mt-2 text-sm leading-6 text-[#77756e]">
              Browse available accommodation records. OpenStreetMap coverage and details vary by area.
            </p>
          </div>
          <Link
            className="rounded-full border border-[#24231f]/15 px-4 py-2.5 text-sm font-semibold transition hover:border-[#24231f]/40"
            to="/favorites"
          >
            View favorites
          </Link>
        </div>

        <div className="mt-6 rounded-2xl border border-[#d7dfd1] bg-[#f0f3ed] px-4 py-3 text-sm text-[#52604b]">
          OpenStreetMap records are © OpenStreetMap contributors under the{' '}
          <a className="font-semibold underline underline-offset-2" href="https://www.openstreetmap.org/copyright" rel="noreferrer" target="_blank">
            Open Database License
          </a>
          . Records marked as development samples are fictional. Ratings are not verified. Provider prices appear only when inventory is available.
        </div>

        <HotelFilters
          area={area}
          locality={locality}
          onAreaChange={(value) => changeFilter(setArea, value)}
          onLocalityChange={(value) => changeFilter(setLocality, value)}
          onTypeChange={(value) => changeFilter(setType, value)}
          type={type}
        />
        {pageData.pagination && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-[#77756e]">
            <span>
              {pageData.pagination.total} accommodation records{pageLabel ? ` · ${pageLabel}` : ''}
            </span>
            {pageCount > 1 && (
              <div className="flex gap-2">
                <button
                  className="rounded-full border border-[#24231f]/15 px-3 py-1.5 font-semibold disabled:opacity-40"
                  disabled={page <= 1 || isLoading}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  type="button"
                >
                  Previous page
                </button>
                <button
                  className="rounded-full border border-[#24231f]/15 px-3 py-1.5 font-semibold disabled:opacity-40"
                  disabled={page >= pageCount || isLoading}
                  onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                  type="button"
                >
                  Next page
                </button>
              </div>
            )}
          </div>
        )}

        {isLoading ? (
          <div className="grid min-h-[420px] place-content-center text-center" role="status">
            <span className="mx-auto size-8 animate-spin rounded-full border-2 border-[#24231f]/15 border-t-[#ef6848]" />
            <p className="mt-4 text-sm text-[#77756e]">Loading accommodation data…</p>
          </div>
        ) : loadError ? (
          <div className="mt-6 rounded-3xl border border-red-200 bg-red-50 p-8 text-center text-sm text-red-800" role="alert">
            <p>{loadError}</p>
            <button
              className="mt-4 rounded-full border border-red-300 px-4 py-2 font-semibold"
              onClick={() => setRetryCount((count) => count + 1)}
              type="button"
            >
              Try again
            </button>
          </div>
        ) : hotels.length === 0 ? (
          <div className="mt-6 rounded-3xl border border-[#24231f]/10 bg-[#fffdf8] px-6 py-14 text-center">
            <h2 className="text-xl font-semibold">No accommodation records found.</h2>
            <p className="mt-2 text-sm text-[#77756e]">
              OpenStreetMap coverage may be incomplete. Try another area or locality.
            </p>
          </div>
        ) : currentHotel ? (
          <>
            <div className="relative mx-auto mt-5 w-full max-w-[560px]">
              <div aria-hidden="true" className="absolute inset-x-3 -bottom-2 top-3 rounded-[2rem] bg-[#e7e2d8]" />
              <AnimatePresence mode="wait" onExitComplete={handleExitComplete}>
                <HotelCard
                  draggable={!isTransitioning}
                  hotel={currentHotel}
                  key={currentHotel.id}
                  onDecision={(_hotelId, choice) => handleDecision(currentHotel, choice)}
                />
              </AnimatePresence>
            </div>
            <div className="mt-6 flex items-center justify-center gap-4 sm:gap-6">
              <button
                aria-label="Reject this accommodation"
                className="grid size-14 place-items-center rounded-full border border-[#24231f]/10 bg-[#fffdf8] text-2xl text-[#bf5c4a] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#bf5c4a] disabled:cursor-not-allowed disabled:opacity-40"
                disabled={isTransitioning}
                onClick={() => handleDecision(currentHotel, 'reject')}
                type="button"
              >
                <span aria-hidden="true">×</span>
              </button>
              <button
                aria-label="Undo the most recent swipe"
                className="rounded-full border border-[#24231f]/15 px-4 py-2.5 text-sm font-semibold text-[#68665f] transition hover:border-[#24231f]/40 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={!lastDecision}
                onClick={undo}
                type="button"
              >
                Undo
              </button>
              <button
                aria-label="Like this accommodation"
                className="grid size-14 place-items-center rounded-full bg-[#65735d] text-2xl text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#52604b] hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#52604b] disabled:cursor-not-allowed disabled:opacity-40"
                disabled={isTransitioning}
                onClick={() => handleDecision(currentHotel, 'like')}
                type="button"
              >
                <span aria-hidden="true">♥</span>
              </button>
            </div>
            <p className="mt-3 text-center text-xs text-[#77756e]">Swipe, drag, or choose an action</p>
          </>
        ) : (
          <div className="mt-6 rounded-3xl border border-[#24231f]/10 bg-[#fffdf8] px-6 py-14 text-center">
            <span aria-hidden="true" className="text-4xl">✦</span>
            <h2 className="mt-4 text-2xl font-semibold tracking-[-0.05em]">
              {pageCount > page ? 'You’ve viewed this page of stays.' : 'You’ve seen every stay on this page.'}
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#77756e]">
              Your likes are kept in this browser session. OpenStreetMap does not provide verified hotel ratings or prices.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              {lastDecision && (
                <button
                  className="rounded-full border border-[#24231f]/15 px-5 py-3 text-sm font-semibold"
                  onClick={undo}
                  type="button"
                >
                  Undo last swipe
                </button>
              )}
              {page < pageCount && (
                <button
                  className="rounded-full bg-[#65735d] px-5 py-3 text-sm font-semibold text-white"
                  onClick={() => setPage((current) => current + 1)}
                  type="button"
                >
                  Load next page
                </button>
              )}
              <Link
                className="rounded-full bg-[#24231f] px-5 py-3 text-sm font-semibold text-[#fffaf4]"
                to="/favorites"
              >
                View favorites
              </Link>
            </div>
          </div>
        )}

        {attribution && (
          <p className="mt-6 text-center text-xs text-[#77756e]">
            {attribution.source} · {attribution.license}
          </p>
        )}
      </div>
    </section>
  );
}
