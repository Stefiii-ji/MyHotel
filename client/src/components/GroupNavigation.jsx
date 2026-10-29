import { Link } from 'react-router-dom';

export default function GroupNavigation({ groupId }) {
  const links = [
    { to: `/groups/${groupId}`, label: 'Lobby' },
    { to: `/groups/${groupId}/swipe`, label: 'Swipe stays' },
    { to: `/groups/${groupId}/progress`, label: 'Progress' },
    { to: `/groups/${groupId}/matches`, label: 'Matches' },
  ];

  return (
    <nav aria-label="Group navigation" className="flex flex-wrap gap-2">
      {links.map((link) => (
        <Link
          className="rounded-full border border-[#24231f]/15 px-4 py-2.5 text-sm font-semibold transition hover:border-[#24231f]/40"
          key={link.to}
          to={link.to}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
