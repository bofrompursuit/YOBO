"use client";

import { useEffect, useRef, useState } from "react";
import {
  motion,
  useMotionValueEvent,
  useScroll,
  useTransform,
} from "framer-motion";

const FRAME_COUNT = 120;
const framePath = (i: number) =>
  `/frames/space/frame_${String(i).padStart(3, "0")}.jpg`;

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

export function ScrollScrubHero() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef<HTMLImageElement[]>([]);
  const frameIndexRef = useRef(0);
  const [ready, setReady] = useState(false);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  const frameProgress = useTransform(
    scrollYProgress,
    [0, 1],
    [1, FRAME_COUNT]
  );

  const titleOpacity = useTransform(
    scrollYProgress,
    [0, 0.08, 0.7, 0.8],
    [0, 1, 1, 0]
  );
  const titleY = useTransform(scrollYProgress, [0, 0.08], [16, 0]);
  const taglineOpacity = useTransform(
    scrollYProgress,
    [0.28, 0.38, 0.68, 0.78],
    [0, 1, 1, 0]
  );
  const [scrolled, setScrolled] = useState(false);

  const render = (index: number) => {
    const canvas = canvasRef.current;
    const img = imagesRef.current[index - 1];
    if (!canvas || !img || !img.complete || img.naturalWidth === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawCover(ctx, img, canvas.width, canvas.height);
  };

  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    if (latest > 0.03 !== scrolled) setScrolled(latest > 0.03);
  });

  useMotionValueEvent(frameProgress, "change", (latest) => {
    const index = Math.min(FRAME_COUNT, Math.max(1, Math.round(latest)));
    if (index !== frameIndexRef.current) {
      frameIndexRef.current = index;
      render(index);
    }
  });

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
    if (!canvas) return;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      render(frameIndexRef.current || 1);
    };

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section
      ref={containerRef}
      className="relative bg-void"
      style={{ height: "350vh" }}
    >
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full"
          aria-hidden="true"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(5,7,12,0.15) 0%, rgba(5,7,12,0) 30%, rgba(5,7,12,0.55) 100%)",
          }}
        />
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center bg-void">
            <span className="text-sm text-mist">Loading orbit&hellip;</span>
          </div>
        )}
        <div className="absolute inset-0 flex flex-col justify-end px-6 pb-16 md:px-16 md:pb-24">
          <motion.h1
            style={{ opacity: titleOpacity, y: titleY }}
            className="text-4xl font-medium text-paper md:text-6xl"
          >
            YOBO
          </motion.h1>
          <motion.p
            style={{ opacity: taglineOpacity }}
            className="mt-4 max-w-md text-lg text-paper/80 md:text-xl"
          >
            Some nights are worth holding onto.
          </motion.p>
        </div>
        <div
          className={`absolute bottom-8 left-1/2 -translate-x-1/2 text-xs text-paper/60 transition-opacity duration-500 ${
            scrolled ? "opacity-0" : "opacity-100"
          }`}
        >
          Scroll
        </div>
      </div>
    </section>
  );
}
