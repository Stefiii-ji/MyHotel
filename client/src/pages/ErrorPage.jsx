import { Link } from 'react-router-dom';

export default function ErrorPage() {
  return (
    <section className="page-shell grid min-h-[50vh] place-content-center text-center">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#ef6848]">Something went wrong</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em]">We could not load that page.</h1>
      <p className="mt-3 text-[#77756e]">Please try again in a little while.</p>
      <Link className="mx-auto mt-6 font-semibold text-[#c55338] underline underline-offset-4" to="/">
        Back to StaySwipe
      </Link>
    </section>
  );
}
