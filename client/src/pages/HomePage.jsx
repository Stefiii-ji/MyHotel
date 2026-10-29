import { motion } from "framer-motion";
import { Link } from "react-router-dom";

const steps = [
  {
    number: "01",
    title: "Pick a place",
    description:
      "Start with the Mumbai or Navi Mumbai area that feels right for your next break.",
  },
  {
    number: "02",
    title: "Swipe your way",
    description:
      "Like the stays you love and skip the ones that are not quite your style.",
  },
  {
    number: "03",
    title: "Plan together",
    description:
      "Share the destination, dates, and budget so everyone starts with the same trip plan.",
  },
];

export default function HomePage() {
  return (
    <>
      <section className="page-shell hero-grid pb-16 pt-8 sm:pb-24 sm:pt-12 lg:pb-28 lg:pt-16">
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          initial={{ opacity: 0, y: 18 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
        >
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#65735d]/20 bg-[#65735d]/[0.07] px-3.5 py-2 text-xs font-semibold tracking-wide text-[#52604b]">
            <span
              aria-hidden="true"
              className="size-2 rounded-full bg-[#718568]"
            />
            A new way to plan stays together
          </div>
          <h1 className="max-w-[660px] text-[clamp(3.35rem,7.3vw,6.35rem)] font-semibold leading-[0.98] tracking-[-0.075em]">
            Find a stay.
            <br />
            <span className="font-serif font-normal italic text-[#ef6848]">
              Find your people.
            </span>
          </h1>
          <p className="mt-7 max-w-[500px] text-base leading-7 text-[#68665f] sm:text-lg sm:leading-8">
            Hotel hunting should feel less like homework. StaySwipe helps you
            discover stays around Mumbai and Navi Mumbai and set trip details
            together with your group.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              className="inline-flex items-center gap-3 rounded-full bg-[#3b3933] px-6 py-3.5 text-sm font-semibold text-[#fffaf4] transition-colors duration-200 hover:bg-[#514e46] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#514e46]"
              to="/discover"
            >
              Explore available stays
              <span aria-hidden="true" className="text-lg leading-none">
                ↗
              </span>
            </Link>
            <Link
              className="inline-flex items-center gap-3 rounded-full border border-[#24231f]/15 px-5 py-3.5 text-sm font-semibold transition-colors duration-200 hover:border-[#24231f]/40 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#514e46]"
              to="/groups/new"
            >
              Plan a group
              <span aria-hidden="true" className="text-lg leading-none">↗</span>
            </Link>
            <a
              className="inline-flex items-center gap-3 rounded-full border border-[#24231f]/15 px-5 py-3.5 text-sm font-semibold transition-colors duration-200 hover:border-[#24231f]/40 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#514e46]"
              href="#how-it-works"
            >
              See how it works
              <span aria-hidden="true" className="text-lg leading-none">
                ↗
              </span>
            </a>

          </div>
          <div className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-xs font-medium text-[#77756e]">
            <span className="flex items-center gap-2">
              <span aria-hidden="true" className="text-[#ef6848]">
                ✳
              </span>{" "}
              Mumbai
            </span>
            <span className="flex items-center gap-2">
              <span aria-hidden="true" className="text-[#ef6848]">
                ✳
              </span>{" "}
              Navi Mumbai
            </span>
            <span className="flex items-center gap-2">
              <span aria-hidden="true" className="text-[#ef6848]">
                ✳
              </span>{" "}
              Made for groups
            </span>
          </div>
        </motion.div>

        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="stay-visual"
          initial={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.7, delay: 0.12, ease: "easeOut" }}
        >
          <div aria-hidden="true" className="stay-sun" />
          <div aria-hidden="true" className="stay-horizon" />
          <div aria-hidden="true" className="stay-building" />
          <div className="visual-label">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-[#77756e]">
                  A little preview
                </p>
                <p className="mt-1 text-sm font-semibold">
                  Your next group getaway
                </p>
              </div>
              <span className="rounded-full bg-[#ef6848]/10 px-3 py-1.5 text-xs font-semibold text-[#c55338]">
                Group planning
              </span>
            </div>
          </div>
        </motion.div>
        <p className="sr-only">
          Illustrative artwork only. Hotel records are retrieved from OpenStreetMap where available.
        </p>
      </section>

      <section
        className="border-y border-[#24231f]/[0.08] bg-[#f1eee6]"
        id="how-it-works"
      >
        <div className="page-shell py-16 sm:py-20">
          <div className="max-w-xl">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#ef6848]">
              How it works
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.055em] sm:text-4xl">
              Less scrolling. More agreeing.
            </h2>
            <p className="mt-4 leading-7 text-[#68665f]">
              Choose a destination, share trip details, and let each person
              swipe independently. The group can then compare the stays everyone likes.
            </p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {steps.map((step) => (
              <article
                className="rounded-3xl border border-[#24231f]/[0.08] bg-[#fffdf8] p-6 sm:p-7"
                key={step.number}
              >
                <span className="step-number">{step.number}</span>
                <h3 className="mt-6 text-lg font-semibold tracking-[-0.03em]">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-[#77756e]">
                  {step.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="page-shell py-14 sm:py-20" id="about">
        <div className="flex flex-col gap-5 rounded-[2rem] bg-[#24231f] p-7 text-[#fffaf4] sm:flex-row sm:items-center sm:justify-between sm:p-10">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#f08b70]">
              Data transparency
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.05em] sm:text-3xl">
              Clear choices, honest information.
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">
              Listings use OpenStreetMap community data, whose coverage and details vary.
              Ratings and reviews are not verified. Prices appear only when a configured provider
              returns a matching offer; availability can change. StaySwipe is not a booking service.
            </p>
          </div>
          <Link
            className="inline-flex w-fit shrink-0 rounded-full border border-white/20 px-5 py-3 text-sm font-semibold text-white transition hover:border-white/50"
            to="/discover"
          >
            Explore stays
          </Link>
        </div>
      </section>
    </>
  );
}
