export default function HotelFilters({
  area,
  onAreaChange,
  locality,
  onLocalityChange,
  type,
  onTypeChange,
}) {
  return (
    <section aria-label="Filter OpenStreetMap accommodation" className="rounded-3xl border border-[#24231f]/[0.08] bg-[#fffdf8] p-4 sm:p-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block text-xs font-semibold text-[#68665f]">
          City / region
          <select
            className="mt-2 block h-11 w-full rounded-xl border border-[#24231f]/15 bg-[#fffdf8] px-3 text-sm text-[#24231f] focus:border-[#ef6848] focus:outline-none focus:ring-2 focus:ring-[#ef6848]/20"
            onChange={(event) => onAreaChange(event.target.value)}
            value={area}
          >
            <option value="">All areas</option>
            <option value="Mumbai">Mumbai</option>
            <option value="Navi Mumbai">Navi Mumbai</option>
          </select>
        </label>
        <label className="block text-xs font-semibold text-[#68665f]">
          Locality
          <input
            className="mt-2 block h-11 w-full rounded-xl border border-[#24231f]/15 bg-[#fffdf8] px-3 text-sm text-[#24231f] focus:border-[#ef6848] focus:outline-none focus:ring-2 focus:ring-[#ef6848]/20"
            onChange={(event) => onLocalityChange(event.target.value)}
            placeholder="e.g. Vashi"
            type="search"
            value={locality}
          />
        </label>
        <label className="block text-xs font-semibold text-[#68665f]">
          Accommodation type
          <select
            className="mt-2 block h-11 w-full rounded-xl border border-[#24231f]/15 bg-[#fffdf8] px-3 text-sm text-[#24231f] focus:border-[#ef6848] focus:outline-none focus:ring-2 focus:ring-[#ef6848]/20"
            onChange={(event) => onTypeChange(event.target.value)}
            value={type}
          >
            <option value="">All types</option>
            <option value="hotel">Hotel</option>
            <option value="guest_house">Guest house</option>
            <option value="hostel">Hostel</option>
            <option value="motel">Motel</option>
            <option value="apartment">Apartment</option>
          </select>
        </label>
      </div>
    </section>
  );
}
