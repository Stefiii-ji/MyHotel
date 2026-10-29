export default function LoadingPage() {
  return (
    <section aria-busy="true" className="page-shell grid min-h-[50vh] place-content-center text-center">
      <span
        aria-hidden="true"
        className="mx-auto size-8 animate-spin rounded-full border-2 border-[#24231f]/15 border-t-[#ef6848]"
      />
      <h1 className="mt-5 text-xl font-semibold">Loading StaySwipe…</h1>
      <p className="mt-2 text-sm text-[#77756e]">Please wait while we get things ready.</p>
    </section>
  );
}
