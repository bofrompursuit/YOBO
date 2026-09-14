"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

const FRAME_COUNT = 120;
const framePath = (i: number) =>
  `/frames/asteroid/frame_${String(i).padStart(3, "0")}.jpg`;

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  width: number,
  height: number
) {
  const imgRatio = img.naturalWidth / img.naturalHeight;
  const boxRatio = width / height;
  let drawWidth = width;
  let drawHeight = height;

  if (imgRatio > boxRatio) {
    drawHeight = height;
    drawWidth = height * imgRatio;
  } else {
    drawWidth = width;
    drawHeight = width / imgRatio;
  }

  const x = (width - drawWidth) / 2;
  const y = (height - drawHeight) / 2;
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(img, x, y, drawWidth, drawHeight);
}

export function AsteroidScrubHero() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef<HTMLImageElement[]>([]);
  const frameIndexRef = useRef(0);
  const [ready, setReady] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [finished, setFinished] = useState(false);

  const render = (index: number) => {
    const canvas = canvasRef.current;
    const img = imagesRef.current[index - 1];
    if (!canvas || !img || !img.complete || img.naturalWidth === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawCover(ctx, img, canvas.width, canvas.height);
  };

  useEffect(() => {
    let cancelled = false;
    const images: HTMLImageElement[] = [];

    const first = new Image();
    first.src = framePath(1);
    first.onload = () => {
      if (cancelled) return;
      images[0] = first;
      imagesRef.current = images;
      render(1);
      setReady(true);
    };
    images[0] = first;

    for (let i = 2; i <= FRAME_COUNT; i++) {
      const img = new Image();
      img.src = framePath(i);
      img.onload = () => {
        if (!cancelled && frameIndexRef.current === i) render(i);
      };
      images[i - 1] = img;
    }
    imagesRef.current = images;

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      render(frameIndexRef.current || 1);
    };

    const onScroll = () => {
      const rect = container.getBoundingClientRect();
      const scrollable = rect.height - window.innerHeight;
      const progress =
        scrollable > 0 ? Math.min(1, Math.max(0, -rect.top / scrollable)) : 0;

      const index = Math.min(
        FRAME_COUNT,
        Math.max(1, Math.round(1 + progress * (FRAME_COUNT - 1)))
      );
      if (index !== frameIndexRef.current) {
        frameIndexRef.current = index;
        render(index);
      }
      setScrolled(progress > 0.02);
      setFinished(progress > 0.96);
    };

    resize();
    onScroll();
    window.addEventListener("resize", resize);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", onScroll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section
      ref={containerRef}
      className="relative bg-void"
      style={{ height: "400vh" }}
    >
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full"
          aria-hidden="true"
        />
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center bg-void">
            <span className="text-sm text-mist">Loading orbit&hellip;</span>
          </div>
        )}

        <div
          className={`pointer-events-none absolute top-1/2 right-6 -translate-y-1/2 rounded bg-black/25 px-3 py-1.5 font-mono text-xs tracking-wider text-cyan-300 backdrop-blur-sm transition-opacity duration-700 md:right-14 ${
            scrolled ? "opacity-0" : "opacity-100"
          }`}
          style={{
            textShadow:
              "0 0 6px rgba(103,232,249,0.9), 0 0 18px rgba(103,232,249,0.6), 0 0 32px rgba(34,211,238,0.4)",
          }}
        >
          [initiate //scroll]
        </div>

        <div
          className={`pointer-events-none absolute inset-x-0 bottom-14 flex justify-center transition-opacity duration-700 ${
            finished ? "opacity-100" : "opacity-0"
          }`}
        >
          <Link
            href="/experience"
            className={`border border-paper/30 px-7 py-3 text-sm text-paper backdrop-blur-sm transition-colors hover:border-teal hover:text-teal ${
              finished ? "pointer-events-auto" : "pointer-events-none"
            }`}
          >
            Enter the night
          </Link>
        </div>
      </div>
    </section>
  );
}
