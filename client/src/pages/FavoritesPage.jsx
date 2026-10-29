import { Link } from 'react-router-dom';
import HotelCard from '../components/HotelCard.jsx';
import { useHotelDemo } from '../context/HotelDemoContext.jsx';

export default function FavoritesPage() {
  const { likedHotels } = useHotelDemo();

  return (
    <section className="page-shell py-8 pb-16 sm:py-12 sm:pb-20">
      <div className="mx-auto max-w-5xl">
        <Link className="text-sm font-semibold text-[#a84934] hover:underline" to="/discover">
          ← Back to discovery
        </Link>
        <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#c55338]">Your shortlist</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.06em] sm:text-4xl">Favorites</h1>
            <p className="mt-2 text-sm text-[#77756e]">Likes stay in this browser session only.</p>
          </div>
          <Link
            className="rounded-full bg-[#24231f] px-5 py-3 text-sm font-semibold text-[#fffaf4]"
            to="/discover"
          >
            Keep exploring
          </Link>
        </div>
        <p className="mt-5 text-xs text-[#77756e]">
          Data © OpenStreetMap contributors, available under the{' '}
          <a className="font-semibold underline" href="https://www.openstreetmap.org/copyright" rel="noreferrer" target="_blank">
            Open Database License
          </a>
          . Ratings and prices are unavailable unless verified from another source.
        </p>
        {likedHotels.length === 0 ? (
          <div className="mt-6 rounded-3xl border border-[#24231f]/10 bg-[#fffdf8] px-6 py-14 text-center">
            <span aria-hidden="true" className="text-4xl">♡</span>
            <h2 className="mt-4 text-xl font-semibold">No favorites yet.</h2>
            <p className="mt-2 text-sm text-[#77756e]">Like an accommodation and it will appear here.</p>
            <Link
              className="mt-5 inline-flex rounded-full bg-[#65735d] px-5 py-3 text-sm font-semibold text-white"
              to="/discover"
            >
              Explore accommodations
            </Link>
          </div>
        ) : (
          <div className="mt-6 grid items-start gap-5 md:grid-cols-2">
            {likedHotels.map((hotel) => (
              <HotelCard draggable={false} hotel={hotel} key={hotel.id} onDecision={() => {}} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
