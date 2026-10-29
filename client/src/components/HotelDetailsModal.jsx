import { lazy, Suspense, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import HotelImage from './HotelImage.jsx';

const HotelOffersPanel = lazy(() => import('./HotelOffersPanel.jsx'));

export default function HotelDetailsModal({ hotel, onClose }) {
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!hotel) return undefined;
    const previousFocus = document.activeElement;
    closeButtonRef.current?.focus();

    function onKeyDown(event) {
      if (event.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = [...dialogRef.current.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )].filter((element) => element.getClientRects().length > 0);
      if (!focusable.length) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialogRef.current.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialogRef.current.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, [hotel]);

  return (
    <AnimatePresence>
      {hotel && (
        <motion.div
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 grid place-items-center bg-[#24231f]/55 p-4 backdrop-blur-sm"
          exit={{ opacity: 0 }}
          initial={{ opacity: 0 }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose();
          }}
        >
          <motion.section
            animate={{ opacity: 1, y: 0, scale: 1 }}
            aria-labelledby="hotel-details-title"
            aria-modal="true"
            className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-[1.75rem] bg-[#fffdf8] shadow-2xl"
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            initial={{ opacity: 0, y: 14, scale: 0.98 }}
            ref={dialogRef}
            role="dialog"
            tabIndex={-1}
          >
            <div className="relative h-56 sm:h-72">
              <HotelImage
                alt={hotel.imageUrls?.length ? `Photo of ${hotel.name} from its listed data source` : 'No photo is available for this accommodation'}
                className="size-full object-cover"
                src={hotel.imageUrls?.[0]}
              />
              <button
                aria-label="Close hotel details"
                className="absolute right-4 top-4 grid size-10 place-items-center rounded-full bg-[#fffdf8]/90 text-xl shadow"
                onClick={onClose}
                ref={closeButtonRef}
                type="button"
              >
                ×
              </button>
            </div>
            <div className="p-6 sm:p-8">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#c55338]">
                {hotel.isSampleData ? 'Development sample' : 'OpenStreetMap'} ·{' '}
                {hotel.accommodationType || 'Accommodation type unavailable'}
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.05em]" id="hotel-details-title">
                {hotel.name || 'Unnamed accommodation'}
              </h2>
              <p className="mt-1 text-sm text-[#77756e]">
                {[hotel.address, hotel.locality, hotel.city, hotel.region].filter(Boolean).join(' · ') ||
                  'Address and locality unavailable'}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {(hotel.amenities ?? []).map((amenity) => (
                  <span
                    className="rounded-full bg-[#f1eee6] px-3 py-1.5 text-xs font-medium text-[#56544d]"
                    key={amenity}
                  >
                    {amenity}
                  </span>
                ))}
              </div>
              {hotel.isSampleData ? (
                <p className="mt-6 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  Fictional development sample. Live prices, availability, and booking are not provided.
                </p>
              ) : (
                <Suspense fallback={<p className="mt-6 text-sm text-[#77756e]" role="status">Loading offer search…</p>}>
                  <HotelOffersPanel hotelId={hotel.id} />
                </Suspense>
              )}
              <p className="mt-6 border-t border-[#24231f]/10 pt-4 text-xs leading-5 text-[#77756e]">
                {hotel.isSampleData
                  ? 'This is fictional test data, not a real accommodation.'
                  : 'Ratings and customer reviews are not provided as verified data. Source record:'}{' '}
                {hotel.sourceId || 'unavailable'}. Coordinates:{' '}
                {Number.isFinite(hotel.latitude) && Number.isFinite(hotel.longitude)
                  ? `${hotel.latitude}, ${hotel.longitude}`
                  : 'unavailable'}.
                {hotel.source === 'openstreetmap' && hotel.sourceId && (
                  <>
                    {' '}
                    <a
                      className="font-semibold underline"
                      href={`https://www.openstreetmap.org/${hotel.sourceId}`}
                      rel="noreferrer"
                      target="_blank"
                    >
                      View OpenStreetMap record
                    </a>
                  </>
                )}
              </p>
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
