"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

const AST_COUNT = 120;
const astPath = (i: number) =>
  `/frames/asteroid/frame_${String(i).padStart(3, "0")}.jpg`;

const TOPO_VIDEO_SRC = "/3D Topography.mp4";
// 00:00 is the grey crater macro view; by ~9.3s the camera has fully
// cleared the rim and the shot settles into a held, static starfield.
const TOPO_SCRUB_SECONDS = 9.3;

const COCKPIT_VIDEO_SRC = "/cockpit.mp4";
// warp-in -> cockpit interior -> "DISCOVERY ALERT!" -> pull back, fade to
// black. Scrub just short of the true end to avoid seeking past it.
const COCKPIT_SCRUB_SECONDS = 7.9;
// How much of the cockpit's own timeline plays out *during* the bridge
// dissolve from the topography scene, in video-seconds.
const BRIDGE_SECONDS = 1.2;

// Total scroll budget, split across the three beats. Asteroid gets 30% of
// the first chunk (matching the old AsteroidScrubHero pacing), topography
// gets the rest of that chunk, cockpit gets its own separate chunk, and the
// bridge dissolve eats into the tail end of the topography chunk.
const P_AST_END = 0.165; // asteroid approach -> topography crossfade point
const P_AST_FADE = 0.0275; // width of that crossfade
const P_TOPO_END = 0.55; // topography reaches its held final frame here
const P_BRIDGE = (BRIDGE_SECONDS / COCKPIT_SCRUB_SECONDS) * (1 - P_TOPO_END);
// The bridge dissolve runs *after* topography is fully settled, not by
// eating into its own scrub, so the crater scene gets its full run first.
const BRIDGE_END = P_TOPO_END + P_BRIDGE;

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

function makeSeekQueue(video: HTMLVideoElement | null, onSeeked: () => void) {
  const state = { pending: null as number | null, seeking: false };
  const request = (t: number) => {
    if (!video) return;
    state.pending = t;
    if (!state.seeking) {
      state.seeking = true;
      video.currentTime = t;
    }
  };
  const handleSeeked = () => {
    if (!video) return;
    state.seeking = false;
    onSeeked();
    const pending = state.pending;
    if (pending !== null && Math.abs(pending - video.currentTime) > 0.02) {
      state.seeking = true;
      video.currentTime = pending;
    }
  };
  return { request, handleSeeked };
}

export function ScrollJourneyHero() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const topoVideoRef = useRef<HTMLVideoElement>(null);
  const cockpitVideoRef = useRef<HTMLVideoElement>(null);
  const astImagesRef = useRef<HTMLImageElement[]>([]);
  const progressRef = useRef(0);
  const readyCountRef = useRef(0);
  const primedForIOSRef = useRef(false);

  const [ready, setReady] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const render = () => {
    const canvas = canvasRef.current;
    const topoVideo = topoVideoRef.current;
    const cockpitVideo = cockpitVideoRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { width, height } = canvas;
    const astImages = astImagesRef.current;
    const progress = progressRef.current;

    if (progress < P_AST_END) {
      // Asteroid approach, plus its crossfade into the topography video's
      // opening frame. Never touched past P_AST_END, so a video-readiness
      // hiccup later on can't flash this frozen frame back into view.
      ctx.clearRect(0, 0, width, height);

      const asteroidLocal = Math.min(1, progress / P_AST_END);
      const asteroidIdx = Math.min(
        AST_COUNT,
        Math.max(1, Math.round(1 + asteroidLocal * (AST_COUNT - 1)))
      );
      const asteroidFrame = astImages[asteroidIdx - 1];
      if (asteroidFrame) drawCover(ctx, asteroidFrame, width, height);

      if (
        progress > P_AST_END - P_AST_FADE &&
        topoVideo &&
        topoVideo.readyState >= 2
      ) {
        const fadeT = Math.min(
          1,
          Math.max(0, (progress - (P_AST_END - P_AST_FADE)) / P_AST_FADE)
        );
        ctx.save();
        ctx.globalAlpha = fadeT;
        drawCover(ctx, topoVideo, width, height);
        ctx.restore();
      }
      return;
    }

    if (progress < BRIDGE_END) {
      // Topography phase, including the bridge dissolve near its very end.
      // Topography is the only thing ever drawn here; if the cockpit video
      // isn't ready yet for its overlay, we simply skip the overlay for
      // this frame rather than showing nothing.
      if (!topoVideo || topoVideo.readyState < 2) return;
      ctx.clearRect(0, 0, width, height);
      drawCover(ctx, topoVideo, width, height);

      if (progress > P_TOPO_END && cockpitVideo && cockpitVideo.readyState >= 2) {
        // Bridge dissolve: the topography video's held final frame (drawn
        // above as the base layer) bleeds into the cockpit video through a
        // growing iris mask, screen-blended so bright edges glow through
        // instead of just cutting a hard-edged hole. Starts only once
        // topography has fully reached P_TOPO_END, never before.
        const bridgeT = Math.min(
          1,
          Math.max(0, (progress - P_TOPO_END) / P_BRIDGE)
        );
        const eased = bridgeT * bridgeT * (3 - 2 * bridgeT);
        const maxRadius = Math.hypot(width, height) * 0.6;

        ctx.save();
        ctx.beginPath();
        ctx.arc(width / 2, height / 2, eased * maxRadius, 0, Math.PI * 2);
        ctx.clip();
        ctx.globalCompositeOperation = "screen";
        drawCover(ctx, cockpitVideo, width, height);
        ctx.restore();
      }
      return;
    }

    // Pure cockpit phase. Topography is never drawn again past this point,
    // so a cockpit-readiness hiccup can only hold the last good cockpit
    // frame on screen — it can never fall back to showing topography.
    if (!cockpitVideo || cockpitVideo.readyState < 2) return;
    ctx.clearRect(0, 0, width, height);
    drawCover(ctx, cockpitVideo, width, height);
  };

  useEffect(() => {
    let cancelled = false;
    const onFirstReady = () => {
      if (cancelled) return;
      readyCountRef.current += 1;
      if (readyCountRef.current === 3) {
        render();
        setReady(true);
      }
    };

    astImagesRef.current = loadImageSequence(AST_COUNT, astPath, onFirstReady);

    const topoVideo = topoVideoRef.current;
    const cockpitVideo = cockpitVideoRef.current;
    const onTopoLoaded = () => onFirstReady();
    const onCockpitLoaded = () => onFirstReady();
    topoVideo?.addEventListener("loadeddata", onTopoLoaded);
    cockpitVideo?.addEventListener("loadeddata", onCockpitLoaded);
    topoVideo?.load();
    cockpitVideo?.load();

    return () => {
      cancelled = true;
      topoVideo?.removeEventListener("loadeddata", onTopoLoaded);
      cockpitVideo?.removeEventListener("loadeddata", onCockpitLoaded);
    };
  }, []);

  useEffect(() => {
    const topoQueue = makeSeekQueue(topoVideoRef.current, render);
    const cockpitQueue = makeSeekQueue(cockpitVideoRef.current, render);
    const topoVideo = topoVideoRef.current;
    const cockpitVideo = cockpitVideoRef.current;

    topoVideo?.addEventListener("seeked", topoQueue.handleSeeked);
    cockpitVideo?.addEventListener("seeked", cockpitQueue.handleSeeked);

    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) {
      return () => {
        topoVideo?.removeEventListener("seeked", topoQueue.handleSeeked);
        cockpitVideo?.removeEventListener("seeked", cockpitQueue.handleSeeked);
      };
    }

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
          topoVideo
            ?.play()
            .then(() => topoVideo.pause())
            .catch(() => {});
          cockpitVideo
            ?.play()
            .then(() => cockpitVideo.pause())
            .catch(() => {});
        }

        if (progress >= P_AST_END) {
          const topoLocal = Math.min(
            1,
            Math.max(0, (progress - P_AST_END) / (P_TOPO_END - P_AST_END))
          );
          topoQueue.request(topoLocal * TOPO_SCRUB_SECONDS);
        }

        if (progress > P_TOPO_END) {
          if (progress < BRIDGE_END) {
            const bridgeT = (progress - P_TOPO_END) / P_BRIDGE;
            cockpitQueue.request(bridgeT * BRIDGE_SECONDS);
          } else {
            const cockpitLocal = Math.min(
              1,
              Math.max(0, (progress - BRIDGE_END) / (1 - BRIDGE_END))
            );
            cockpitQueue.request(
              BRIDGE_SECONDS +
                cockpitLocal * (COCKPIT_SCRUB_SECONDS - BRIDGE_SECONDS)
            );
          }
        }

        render();
      },
    });

    return () => {
      window.removeEventListener("resize", resize);
      trigger.kill();
      topoVideo?.removeEventListener("seeked", topoQueue.handleSeeked);
      cockpitVideo?.removeEventListener("seeked", cockpitQueue.handleSeeked);
    };
  }, []);

  return (
    <section
      ref={containerRef}
      className="relative bg-void"
      style={{ height: "1000vh" }}
    >
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        <video
          ref={topoVideoRef}
          src={TOPO_VIDEO_SRC}
          preload="auto"
          muted
          playsInline
          className="sr-only"
          aria-hidden="true"
        />
        <video
          ref={cockpitVideoRef}
          src={COCKPIT_VIDEO_SRC}
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
