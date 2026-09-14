"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

const AST_COUNT = 120;
const GR_COUNT = 78;
const astPath = (i: number) =>
  `/frames/asteroid/frame_${String(i).padStart(3, "0")}.jpg`;
const grPath = (i: number) =>
  `/frames/greenrivers/frame_${String(i).padStart(3, "0")}.jpg`;

// Fraction of total scroll spent on each beat: the asteroid approach,
// the breakthrough crack, then the green tunnel reveal.
const P_SPLIT = 0.58;
const P_TRANS = 0.06;

function loadSequence(
  count: number,
  pathFor: (i: number) => string,
  onFirstLoaded: () => void
): HTMLImageElement[] {
  const images: HTMLImageElement[] = [];
  for (let i = 1; i <= count; i++) {
    const img = new Image();
    img.src = pathFor(i);
    if (i === 1) img.onload = onFirstLoaded;
    images[i - 1] = img;
  }
  return images;
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  width: number,
  height: number
) {
  if (!img.complete || img.naturalWidth === 0) return;
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
  ctx.drawImage(img, x, y, drawWidth, drawHeight);
}

// Draws `toImg` visible only through a jagged, expanding crack over
// `fromImg` — the rock surface splitting open to reveal what's beneath.
function drawBreakthrough(
  ctx: CanvasRenderingContext2D,
  fromImg: HTMLImageElement,
  toImg: HTMLImageElement,
  width: number,
  height: number,
  t: number
) {
  drawCover(ctx, fromImg, width, height);

  const eased = t * t * (3 - 2 * t);
  const maxRadius = Math.hypot(width, height) * 0.56;
  const radius = eased * maxRadius;
  const cx = width / 2;
  const cy = height / 2;
  const segments = 56;

  ctx.save();
  ctx.beginPath();
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const wobble =
      1 +
      0.18 * Math.sin(angle * 5 + 1.3) +
      0.12 * Math.sin(angle * 9 + 0.4) +
      0.08 * Math.sin(angle * 13 + 2.1);
    const r = radius * wobble;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.clip();
  drawCover(ctx, toImg, width, height);
  ctx.restore();

  const flash = Math.sin(Math.PI * Math.min(1, t * 1.15));
  if (flash > 0) {
    ctx.fillStyle = `rgba(180, 255, 170, ${flash * 0.35})`;
    ctx.fillRect(0, 0, width, height);
  }
}

export function AsteroidScrubHero() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const astImagesRef = useRef<HTMLImageElement[]>([]);
  const grImagesRef = useRef<HTMLImageElement[]>([]);
  const progressRef = useRef(0);
  const readyCountRef = useRef(0);
  const [ready, setReady] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [finished, setFinished] = useState(false);
  const [appsVisible, setAppsVisible] = useState(false);
  const [toolsVisible, setToolsVisible] = useState(false);

  const render = (progress: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { width, height } = canvas;
    const astImages = astImagesRef.current;
    const grImages = grImagesRef.current;

    if (progress < P_SPLIT) {
      const local = progress / P_SPLIT;
      const idx = Math.min(
        AST_COUNT,
        Math.max(1, Math.round(1 + local * (AST_COUNT - 1)))
      );
      ctx.clearRect(0, 0, width, height);
      drawCover(ctx, astImages[idx - 1], width, height);
    } else if (progress < P_SPLIT + P_TRANS) {
      const t = (progress - P_SPLIT) / P_TRANS;
      ctx.clearRect(0, 0, width, height);
      drawBreakthrough(
        ctx,
        astImages[AST_COUNT - 1],
        grImages[0],
        width,
        height,
        t
      );
    } else {
      const local =
        (progress - P_SPLIT - P_TRANS) / (1 - P_SPLIT - P_TRANS);
      const idx = Math.min(
        GR_COUNT,
        Math.max(1, Math.round(1 + local * (GR_COUNT - 1)))
      );
      ctx.clearRect(0, 0, width, height);
      drawCover(ctx, grImages[idx - 1], width, height);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const onFirstLoaded = () => {
      if (cancelled) return;
      readyCountRef.current += 1;
      if (readyCountRef.current === 2) {
        render(progressRef.current);
        setReady(true);
      }
    };
    astImagesRef.current = loadSequence(AST_COUNT, astPath, onFirstLoaded);
    grImagesRef.current = loadSequence(GR_COUNT, grPath, onFirstLoaded);

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
      render(progressRef.current);
    };

    const onScroll = () => {
      const rect = container.getBoundingClientRect();
      const scrollable = rect.height - window.innerHeight;
      const progress =
        scrollable > 0 ? Math.min(1, Math.max(0, -rect.top / scrollable)) : 0;
      progressRef.current = progress;
      render(progress);
      setScrolled(progress > 0.02);
      setFinished(progress > 0.97);
      // "/apps" is glimpsed the instant the crack starts opening; "/tools"
      // takes over as the nearer marker partway through the tunnel.
      setAppsVisible(progress > P_SPLIT);
      setToolsVisible(progress > 0.88);
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
      style={{ height: "650vh" }}
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

        <a
          href="https://linktr.ee/bomoldenhauer?utm_source=linktree_profile_share&ltsid=044edb07-7d48-4ec0-81ad-90e9200405d5"
          target="_blank"
          rel="noopener noreferrer"
          className={`absolute top-24 left-6 rounded bg-black/40 px-3 py-1.5 font-mono text-xs tracking-wider text-cyan-300 backdrop-blur-sm transition-opacity duration-700 hover:bg-black/60 md:left-14 ${
            appsVisible ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
          }`}
          style={{
            textShadow:
              "0 0 6px rgba(103,232,249,0.9), 0 0 18px rgba(103,232,249,0.6), 0 0 32px rgba(34,211,238,0.4)",
          }}
        >
          click for //apps
        </a>

        <a
          href="https://boportfoliov2.vercel.app/"
          target="_blank"
          rel="noopener noreferrer"
          className={`absolute top-[64%] right-6 rounded bg-black/40 px-3 py-1.5 font-mono text-xs tracking-wider text-coral backdrop-blur-sm transition-opacity duration-700 hover:bg-black/60 md:right-14 ${
            toolsVisible ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
          }`}
          style={{
            textShadow:
              "0 0 6px rgba(255,122,104,0.9), 0 0 18px rgba(255,122,104,0.6), 0 0 32px rgba(255,122,104,0.4)",
          }}
        >
          click for //tools
        </a>

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
