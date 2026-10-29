import { Link, useLocation } from 'react-router-dom';
import { useRecentGroup } from '../context/RecentGroupContext.jsx';

export default function SiteHeader() {
  const { pathname } = useLocation();
  const { recentGroup } = useRecentGroup();
  const recentGroupPath = recentGroup ? `/groups/${recentGroup.id}` : '';

  return (
    <header className="page-shell flex items-center justify-between py-5 sm:py-7">
      <Link aria-label="StaySwipe home" className="flex items-center gap-2.5" to="/">
        <span className="grid size-10 place-items-center rounded-[14px] bg-[#ef6848] text-lg font-black text-[#fffaf4]">
          S
        </span>
        <span className="text-[1.2rem] font-bold tracking-[-0.06em]">stayswipe</span>
      </Link>

      <nav aria-label="Main navigation" className="flex items-center gap-3 sm:gap-6">
        <Link
          className="hidden text-sm font-medium text-[#68665f] transition hover:text-[#24231f] sm:inline"
          to="/#how-it-works"
        >
          How it works
        </Link>
        <Link
          className="text-sm font-medium text-[#68665f] transition hover:text-[#24231f]"
          to="/discover"
        >
          Discover
        </Link>
        <Link
          className="text-sm font-medium text-[#68665f] transition hover:text-[#24231f]"
          to="/favorites"
        >
          Favorites
        </Link>
        {recentGroup && pathname !== recentGroupPath && (
          <Link
            aria-label={`Return to ${recentGroup.name}`}
            className="max-w-[30vw] truncate rounded-full border border-[#65735d]/30 px-3 py-2 text-sm font-semibold text-[#52604b] transition hover:border-[#65735d] sm:max-w-none sm:px-4"
            to={recentGroupPath}
          >
            <span className="sm:hidden">Return</span>
            <span className="hidden sm:inline">Return to {recentGroup.name}</span>
          </Link>
        )}
        <Link
          className="hidden rounded-full bg-[#24231f] px-4 py-2.5 text-sm font-semibold text-[#fffaf4] transition hover:bg-[#514e46] sm:inline-flex"
          to="/groups/new"
        >
          Plan a group
        </Link>
        <Link
          className="hidden rounded-full border border-[#24231f]/15 px-4 py-2.5 text-sm font-semibold transition hover:border-[#24231f]/40 sm:inline-block sm:px-5"
          to="/#about"
        >
          About StaySwipe
        </Link>
      </nav>
    </header>
  );
}
