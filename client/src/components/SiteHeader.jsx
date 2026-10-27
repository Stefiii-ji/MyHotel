import { Link } from 'react-router-dom';

export default function SiteHeader() {
  return (
    <header className="page-shell flex items-center justify-between py-5 sm:py-7">
      <Link aria-label="StaySwipe home" className="flex items-center gap-2.5" to="/">
        <span className="grid size-10 place-items-center rounded-[14px] bg-[#ef6848] text-lg font-black text-[#fffaf4]">
          S
        </span>
        <span className="text-[1.2rem] font-bold tracking-[-0.06em]">stayswipe</span>
      </Link>

      <nav aria-label="Main navigation" className="flex items-center gap-5 sm:gap-8">
        <a
          className="hidden text-sm font-medium text-[#68665f] transition hover:text-[#24231f] sm:inline"
          href="#how-it-works"
        >
          How it works
        </a>
        <a
          className="rounded-full border border-[#24231f]/15 px-4 py-2.5 text-sm font-semibold transition hover:border-[#24231f]/40 sm:px-5"
          href="#coming-soon"
        >
          Coming soon
        </a>
      </nav>
    </header>
  );
}
