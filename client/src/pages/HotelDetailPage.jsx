import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import HotelCard from '../components/HotelCard.jsx';
import { getHotel } from '../services/hotelService.js';
import { getApiErrorMessage } from '../utils/apiErrors.js';

export default function HotelDetailPage() {
  const { hotelId = '' } = useParams();
  const [hotel, setHotel] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    getHotel(hotelId, { signal: controller.signal })
      .then((result) => setHotel(result.item))
      .catch((requestError) => {
        if (requestError.code === 'ERR_CANCELED') return;
        setError(getApiErrorMessage(requestError, 'Could not load this hotel record.'));
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [hotelId]);

  return (
    <section className="page-shell py-8 pb-16 sm:py-12 sm:pb-20">
      <div className="mx-auto max-w-3xl">
        <Link className="text-sm font-semibold text-[#65735d] hover:underline" to="/discover">
          ← Back to stays
        </Link>
        {isLoading ? (
          <div className="grid min-h-[300px] place-content-center" role="status">
            <p className="text-sm text-[#77756e]">Loading hotel details…</p>
          </div>
        ) : error || !hotel ? (
          <div className="mt-6 rounded-3xl border border-red-200 bg-red-50 p-7 text-center">
            <p className="text-sm text-red-800" role="alert">
              {error || 'Hotel not found.'}
            </p>
          </div>
        ) : (
          <div className="mt-6">
            <HotelCard draggable={false} hotel={hotel} onDecision={() => {}} />
          </div>
        )}
      </div>
    </section>
  );
}
