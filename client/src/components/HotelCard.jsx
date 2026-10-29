import { useState } from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import HotelDetailsModal from './HotelDetailsModal.jsx';
import HotelImage from './HotelImage.jsx';

export default function HotelCard({ hotel, onDecision, draggable = true }) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const dragX = useMotionValue(0);
  const likeOpacity = useTransform(dragX, [0, 100], [0, 1]);
  const nopeOpacity = useTransform(dragX, [-100, 0], [1, 0]);
  const rotation = useTransform(dragX, [-260, 260], [-8, 8]);

  function handleDragEnd(_event, info) {
    if (info.offset.x > 105) {
      onDecision(hotel.id, 'like');
    } else if (info.offset.x < -105) {
      onDecision(hotel.id, 'reject');
    }
  }

  return (
    <>
      <motion.article
        animate={{ opacity: 1, x: 0, rotate: 0 }}
        className="relative w-full touch-pan-y overflow-hidden rounded-[1.75rem] border border-[#24231f]/[0.08] bg-[#fffdf8] shadow-[0_24px_70px_rgba(47,45,38,0.14)] sm:rounded-[2rem]"
        drag={draggable ? 'x' : false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.82}
        dragMomentum={false}
        exit={{ opacity: 0, x: dragX.get() >= 0 ? 420 : -420, rotate: dragX.get() >= 0 ? 9 : -9 }}
        initial={{ opacity: 0, y: 18 }}
        key={hotel.id}
        onDragEnd={handleDragEnd}
        style={draggable ? { x: dragX, rotate: rotation } : undefined}
        transition={{ duration: 0.24, ease: 'easeOut' }}
      >
        <div className="relative h-[310px] sm:h-[390px]">
          <HotelImage
            alt={hotel.imageUrls?.length ? `Photo of ${hotel.name} from its listed data source` : 'No photo is available for this accommodation'}
            className="size-full object-cover"
            src={hotel.imageUrls?.[0]}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />
          <span className="absolute left-4 top-4 rounded-full border border-white/50 bg-[#fffdf8]/95 px-3 py-1.5 text-[0.65rem] font-extrabold tracking-[0.12em] text-[#5b4820] shadow sm:left-5 sm:top-5">
            {hotel.isSampleData ? 'DEVELOPMENT SAMPLE' : 'OPENSTREETMAP'}
          </span>
          {draggable && (
            <>
              <motion.span
                className="absolute left-5 top-20 -rotate-12 rounded-lg border-[3px] border-[#f2ddd2] px-3 py-1.5 text-2xl font-black tracking-[0.16em] text-[#fff1e9] sm:left-8"
                style={{ opacity: nopeOpacity }}
              >
                NOPE
              </motion.span>
              <motion.span
                className="absolute right-5 top-20 rotate-12 rounded-lg border-[3px] border-[#d7e5d1] px-3 py-1.5 text-2xl font-black tracking-[0.16em] text-[#edffe5] sm:right-8"
                style={{ opacity: likeOpacity }}
              >
                LIKE
              </motion.span>
            </>
          )}
          <div className="absolute inset-x-5 bottom-5 text-white sm:inset-x-7 sm:bottom-7">
            <p className="text-xs font-medium text-white/80">
              {[hotel.locality, hotel.city, hotel.region].filter(Boolean).join(' · ') || 'Location unavailable'}
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-[-0.045em] sm:text-3xl">
              {hotel.name || 'Unnamed accommodation'}
            </h2>
          </div>
        </div>

        <div className="p-5 sm:p-7">
          {hotel.isSampleData && (
            <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
              Fictional test data only. No real hotel, price, rating, or availability.
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-[#77756e]">Rating and reviews unavailable</p>
            <p className="text-sm text-[#77756e]">Price unavailable</p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {(hotel.amenities ?? []).map((amenity) => (
              <span
                className="rounded-full bg-[#f1eee6] px-3 py-1.5 text-xs font-medium text-[#56544d]"
                key={amenity}
              >
                {amenity}
              </span>
            ))}
            {!hotel.amenities?.length && (
              <span className="text-xs text-[#77756e]">No amenities listed in the source</span>
            )}
          </div>
          <button
            className="mt-5 text-sm font-semibold text-[#a84934] underline decoration-[#a84934]/40 underline-offset-4 hover:decoration-[#a84934] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#a84934]"
            onClick={() => setDetailsOpen(true)}
            onPointerDown={(event) => event.stopPropagation()}
            type="button"
          >
            View details
          </button>
        </div>
      </motion.article>
      <HotelDetailsModal hotel={detailsOpen ? hotel : null} onClose={() => setDetailsOpen(false)} />
    </>
  );
}
