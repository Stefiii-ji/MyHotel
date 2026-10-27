import { motion } from "framer-motion";

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
    title: "Find the overlap",
    description:
      "Plan with friends and see the stays everyone in your group likes.",
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
            Hotel hunting should feel less like homework. StaySwipe is being
            built to help you discover stays around Mumbai and Navi Mumbai, then
            find the ones your whole group loves.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              className="inline-flex items-center gap-3 rounded-full bg-[#3b3933] px-6 py-3.5 text-sm font-semibold text-[#fffaf4] transition-colors duration-200 hover:bg-[#514e46] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#514e46]"
              href="#how-it-works"
            >
              See how it will work
              <span aria-hidden="true" className="text-lg leading-none">
                ↗
              </span>
            </a>

            <span className="text-sm text-[#77756e]">
              Currently in the works
            </span>
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
                Coming soon
              </span>
            </div>
          </div>
        </motion.div>
        <p className="sr-only">
          Illustrative artwork only. StaySwipe does not have live hotel listings
          yet.
        </p>
      </section>

      <section
        className="border-y border-[#24231f]/[0.08] bg-[#f1eee6]"
        id="how-it-works"
      >
        <div className="page-shell py-16 sm:py-20">
          <div className="max-w-xl">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#ef6848]">
              The idea
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.055em] sm:text-4xl">
              Less scrolling. More agreeing.
            </h2>
            <p className="mt-4 leading-7 text-[#68665f]">
              The plan is simple: make choosing a stay feel easy, whether you
              are planning solo or getting the whole group on the same page.
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

      <section className="page-shell py-14 sm:py-20" id="coming-soon">
        <div className="flex flex-col gap-5 rounded-[2rem] bg-[#24231f] p-7 text-[#fffaf4] sm:flex-row sm:items-center sm:justify-between sm:p-10">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#f08b70]">
              Early days
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.05em] sm:text-3xl">
              StaySwipe is under development.
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-white/65">
              Hotel discovery, swiping, and group matching are not available
              yet. This page is a preview of what we are building, not a live
              booking service.
            </p>
          </div>
          <span className="inline-flex w-fit shrink-0 items-center gap-2 rounded-full border border-white/15 px-4 py-2.5 text-sm text-white/80">
            <span
              aria-hidden="true"
              className="size-2 rounded-full bg-[#f08b70]"
            />
            Build in progress
          </span>
        </div>
      </section>
    </>
  );
}
