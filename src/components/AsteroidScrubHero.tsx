"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

const AST_COUNT = 120;
const astPath = (i: number) =>
  `/frames/asteroid/frame_${String(i).padStart(3, "0")}.jpg`;

const VIDEO_SRC = "/3D Topography.mp4";
// 00:00 is the grey crater macro view; by ~9.3s the camera has fully
// cleared the rim and the shot settles into a held, static starfield
// (identical frames from ~8.8s to the file's end at 9.4s) — that's the
// true "into the night sky" resting point, so the scrub ends there
// instead of cutting off mid-climb.
const VIDEO_SCRUB_SECONDS = 9.3;

// Fraction of total scroll spent on the asteroid approach before the
// topography video takes over, and the width of the crossfade between them.
const P_SPLIT = 0.3;
const P_FADE = 0.05;

type CoverSource = HTMLImageElement | HTMLVideoElement;

function isVideoSource(source: CoverSource): source is HTMLVideoElement {
  return "videoWidth" in source;
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  source: CoverSource,
  width: number,
  height: number
) {
  const sw = isVideoSource(source) ? source.videoWidth : source.naturalWidth;
  const sh = isVideoSource(source) ? source.videoHeight : source.naturalHeight;
  if (!sw || !sh) return;

  const srcRatio = sw / sh;
  const boxRatio = width / height;
  let drawWidth = width;
  let drawHeight = height;

  if (srcRatio > boxRatio) {
    drawHeight = height;
    drawWidth = height * srcRatio;
  } else {
    drawWidth = width;
    drawHeight = width / srcRatio;
  }

  const x = (width - drawWidth) / 2;
  const y = (height - drawHeight) / 2;
  ctx.drawImage(source, x, y, drawWidth, drawHeight);
}

function loadImageSequence(
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

export function AsteroidScrubHero() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const astImagesRef = useRef<HTMLImageElement[]>([]);
  const progressRef = useRef(0);
  const readyCountRef = useRef(0);
  const pendingVideoTimeRef = useRef<number | null>(null);
  const seekingRef = useRef(false);
  const primedForIOSRef = useRef(false);

  const [ready, setReady] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const render = () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { width, height } = canvas;
    const astImages = astImagesRef.current;
    const progress = progressRef.current;

    if (progress < P_SPLIT) {
      // Asteroid approach, plus its crossfade into the video's opening frame.
      // Never touched once we're past P_SPLIT, so a video-readiness hiccup
      // later on can't cause a flash back to this frozen asteroid frame.
      ctx.clearRect(0, 0, width, height);

      const asteroidLocal = Math.min(1, progress / P_SPLIT);
      const asteroidIdx = Math.min(
        AST_COUNT,
        Math.max(1, Math.round(1 + asteroidLocal * (AST_COUNT - 1)))
      );
      const asteroidFrame = astImages[asteroidIdx - 1];
      if (asteroidFrame) drawCover(ctx, asteroidFrame, width, height);

      if (progress > P_SPLIT - P_FADE && video && video.readyState >= 2) {
        const fadeT = Math.min(
          1,
          Math.max(0, (progress - (P_SPLIT - P_FADE)) / P_FADE)
        );
        ctx.save();
        ctx.globalAlpha = fadeT;
        drawCover(ctx, video, width, height);
        ctx.restore();
      }
    } else if (video && video.readyState >= 2) {
      // Pure video phase. If a seek is momentarily unsettled and the video
      // isn't ready, leave the canvas showing the last good frame instead
      // of redrawing anything else over it.
      ctx.clearRect(0, 0, width, height);
      drawCover(ctx, video, width, height);
    }
  };

  const requestVideoTime = (t: number) => {
    const video = videoRef.current;
    if (!video) return;
    pendingVideoTimeRef.current = t;
    if (!seekingRef.current) {
      seekingRef.current = true;
      video.currentTime = t;
    }
  };

  useEffect(() => {
    let cancelled = false;
    const onFirstReady = () => {
      if (cancelled) return;
      readyCountRef.current += 1;
      if (readyCountRef.current === 2) {
        render();
        setReady(true);
      }
    };

    astImagesRef.current = loadImageSequence(AST_COUNT, astPath, onFirstReady);

    const video = videoRef.current;
    if (video) {
      const onLoadedData = () => onFirstReady();
      video.addEventListener("loadeddata", onLoadedData);
      video.load();
      return () => {
        cancelled = true;
        video.removeEventListener("loadeddata", onLoadedData);
      };
    }

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onSeeked = () => {
      seekingRef.current = false;
      render();
      const pending = pendingVideoTimeRef.current;
      if (pending !== null && Math.abs(pending - video.currentTime) > 0.02) {
        seekingRef.current = true;
        video.currentTime = pending;
      }
    };

    video.addEventListener("seeked", onSeeked);
    return () => video.removeEventListener("seeked", onSeeked);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    gsap.registerPlugin(ScrollTrigger);

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      render();
    };

    resize();
    window.addEventListener("resize", resize);

    const trigger = ScrollTrigger.create({
      trigger: container,
      start: "top top",
      end: "bottom bottom",
      scrub: 1,
      onUpdate: (self) => {
        const progress = self.progress;
        progressRef.current = progress;
        setScrolled(progress > 0.02);

        // iOS Safari won't seek a <video> reliably until it has been
        // primed by a play/pause cycle triggered from a user gesture;
        // the first scroll tick is close enough to count.
        if (!primedForIOSRef.current) {
          primedForIOSRef.current = true;
          const video = videoRef.current;
          video
            ?.play()
            .then(() => video.pause())
            .catch(() => {});
        }

        if (progress >= P_SPLIT) {
          const localVideo = Math.min(
            1,
            Math.max(0, (progress - P_SPLIT) / (1 - P_SPLIT))
          );
          requestVideoTime(localVideo * VIDEO_SCRUB_SECONDS);
        }

        render();
      },
    });

    return () => {
      window.removeEventListener("resize", resize);
      trigger.kill();
    };
  }, []);

  return (
    <section
      ref={containerRef}
      className="relative bg-void"
      style={{ height: "550vh" }}
    >
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        <video
          ref={videoRef}
          src={VIDEO_SRC}
          preload="auto"
          muted
          playsInline
          className="sr-only"
          aria-hidden="true"
        />
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
      </div>
    </section>
  );
}
