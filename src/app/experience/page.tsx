import Image from "next/image";
import { ScrollScrubHero } from "@/components/ScrollScrubHero";
import { Reveal } from "@/components/Reveal";

const galleryFrames = [
  { src: "/gallery/tarot.jpg", rotate: "-rotate-2" },
  { src: "/gallery/rabbit-hole.jpg", rotate: "rotate-1" },
  { src: "/gallery/mural-bar.jpg", rotate: "rotate-2" },
  { src: "/gallery/garden.jpg", rotate: "-rotate-1" },
  { src: "/gallery/bokeh.jpg", rotate: "rotate-1" },
];

const steps = [
  {
    n: "01",
    title: "Arrive",
    body: "Walk in and the city stays at the door. Every room looks like somewhere else entirely.",
  },
  {
    n: "02",
    title: "Wander",
    body: "Follow the neon down the rabbit hole, past the mural wall, out to the garden.",
  },
  {
    n: "03",
    title: "Stay",
    body: "Pull a card, order another round. The night moves at its own pace.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-col">
      <ScrollScrubHero />

      <section className="bg-flash px-6 py-24 md:px-16 md:py-32">
        <div className="mx-auto grid max-w-5xl gap-16 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:gap-12">
          <Reveal>
            <h2 className="text-3xl font-medium text-ink md:text-4xl">
              Step inside
            </h2>
            <p className="mt-5 max-w-sm text-base leading-relaxed text-mist md:text-lg">
              Four rooms, four different moods — a neon hallway, a
              mural-soaked bar, a hidden garden, a table where the cards get
              read.
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="grid grid-cols-3 gap-3 md:gap-4">
              {galleryFrames.map((frame, i) => (
                <div
                  key={frame.src}
                  className={`relative aspect-[4/5] overflow-hidden border border-ink/10 bg-void ${frame.rotate} ${
                    i === 0 ? "col-span-2 row-span-2" : ""
                  }`}
                >
                  <Image
                    src={frame.src}
                    alt=""
                    fill
                    sizes="(min-width: 768px) 33vw, 50vw"
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <section className="bg-flash px-6 pb-24 md:px-16 md:pb-32">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <h2 className="max-w-md text-3xl font-medium text-ink md:text-4xl">
              How the night unfolds
            </h2>
          </Reveal>
          <div className="mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
            {steps.map((step, i) => (
              <Reveal key={step.n} delay={i * 0.08}>
                <div className="border-l border-ink/15 pl-6">
                  <span className="text-sm text-mist">{step.n}</span>
                  <h3 className="mt-2 text-xl font-medium text-ink">
                    {step.title}
                  </h3>
                  <p className="mt-3 text-base leading-relaxed text-mist">
                    {step.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-void px-6 py-28 md:px-16 md:py-40">
        <div className="absolute inset-0 opacity-40">
          <Image
            src="/frames/space/frame_115.jpg"
            alt=""
            fill
            sizes="100vw"
            className="object-cover"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-void via-void/70 to-void/20" />
        <Reveal className="relative mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-medium text-paper md:text-5xl">
            Your next night is waiting.
          </h2>
          <p className="mt-5 text-base text-paper/70 md:text-lg">
            Reserve a table and see which room finds you first.
          </p>
          <a
            href="#"
            className="mt-9 inline-flex items-center justify-center bg-coral px-7 py-3 text-base font-medium text-void transition-colors hover:bg-coral/90"
          >
            Reserve a table
          </a>
        </Reveal>
      </section>
    </div>
  );
}
