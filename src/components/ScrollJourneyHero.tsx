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

const CONSTELLATION_VIDEO_SRC = "/constellation.mp4";
// A single point of light pulls back into a labeled star map, zooms into
// Orion, reveals a constellation figure, then blows out to a held white
// flash by ~9.5s. Scrub just short of the true end (10.0s).
const CONSTELLATION_SCRUB_SECONDS = 9.7;

const ORB_VIDEO_SRC = "/orb.mp4";
// A robotic palm rises beneath a blazing-white orb that cools into clear
// glass while scattered blob/shard debris gets drawn in and absorbed by
// it. Scrub just short of the true end (3.272s).
const ORB_SCRUB_SECONDS = 3.15;

// How much of the *incoming* scene's own timeline plays out during each
// bridge dissolve, in video-seconds. Shared across all bridges below.
const BRIDGE_SECONDS = 1.2;

// Total scroll budget, split across five beats. Each new scene has been
// added the same way: the entire prior journey gets compressed
// proportionally into a larger total so its own internal pacing never
// changes, only how much of the grand total it now occupies.
const ORIGINAL_SHARE = 1000 / 1900; // asteroid+topo+cockpit's share of the grand total

const P_AST_END = 0.165 * ORIGINAL_SHARE; // asteroid -> topography crossfade
const P_AST_FADE = 0.0275 * ORIGINAL_SHARE; // width of that crossfade
const P_TOPO_END = 0.55 * ORIGINAL_SHARE; // topography reaches its held final frame
const P_BRIDGE =
  (BRIDGE_SECONDS / COCKPIT_SCRUB_SECONDS) * (ORIGINAL_SHARE - P_TOPO_END);
// Every bridge below runs *after* the prior scene is fully settled, not by
// eating into its own scrub, so each scene gets its full run first.
const BRIDGE_END = P_TOPO_END + P_BRIDGE;
const P_COCKPIT_END = ORIGINAL_SHARE; // cockpit reaches its held final frame here

const P_CONSTELLATION_END = 1550 / 1900; // constellation reaches its held white-flash frame here
const P_BRIDGE2 =
  (BRIDGE_SECONDS / CONSTELLATION_SCRUB_SECONDS) *
  (P_CONSTELLATION_END - P_COCKPIT_END);
const BRIDGE2_END = P_COCKPIT_END + P_BRIDGE2;

const P_BRIDGE3 =
  (BRIDGE_SECONDS / ORB_SCRUB_SECONDS) * (1 - P_CONSTELLATION_END);
const BRIDGE3_END = P_CONSTELLATION_END + P_BRIDGE3;

// Mouse parallax on the cockpit view: a whole-frame drift toward the
// cursor, not per-object depth (the footage is a flat pre-rendered video,
// so individual props can't be moved independently). Only active while
// fully inside the cockpit's own viewing window.
const PARALLAX_LERP = 0.08;
const PARALLAX_MAX_PX = 14;
const PARALLAX_MAX_DEG = 0.8;
const PARALLAX_SCALE = 1.035; // headroom so the pan never reveals an edge

// Text timed to a specific timestamp *within the topography video* (not a
// fraction of the topography scroll range), so it lands exactly on the
// terrain -> blue wireframe transition regardless of how P_AST_END /
// P_TOPO_END get tuned later. currentTime 1.2s is the wireframe reveal;
// the plate clears before the camera drops into the crater at ~4.0s.
const topoTimeToProgress = (seconds: number) =>
  P_AST_END + (seconds / TOPO_SCRUB_SECONDS) * (P_TOPO_END - P_AST_END);

// HUD targeting reticle: timed to the asteroid -> topography crossfade
// itself, while the crater surface is still plain (pre-wireframe) — not
// the later wireframe reveal. Starts as the dissolve begins (still on the
// asteroid's own local timeline, before topo currentTime tracking even
// starts) and clears just before the wireframe overtakes the shot at ~1.0s.
const HUD_RETICLE_WINDOW = [
  P_AST_END - P_AST_FADE,
  topoTimeToProgress(0.9),
] as const;
// Locked in place (no bob/drift, unlike a floating plate); the two lines
// type on in sequence across the first slice of the window, then hold
// fully typed (cursor still blinking) before fading out near the end.
const HUD_FADE_EDGE = 0.08; // fraction of its window spent fading in/out
const HUD_TYPE_PORTION = 0.55; // fraction of its window spent typing
const HUD_LINE_1 = "//ENTERING SITE";
const HUD_LINE_2 = "// SCANNING ACTIVITY";

// Every clickable overlay below (GitHub hotspot, project pills, LinkedIn
// CTA) shares one rule: strictly clipped to its own scroll window — hidden
// the instant progress leaves it, from either scroll direction — and once
// triggered, capped to a fixed real-world exposure so it never lingers
// just because the user dwells on that part of the scene.
function timedRevealOpacity(
  shownAt: number | null,
  now: number,
  visibleMs: number,
  fadeMs: number
) {
  if (shownAt === null) return 0;
  const elapsed = now - shownAt;
  if (elapsed < 0) return 0;
  if (elapsed < fadeMs) return elapsed / fadeMs;
  if (elapsed < visibleMs - fadeMs) return 1;
  if (elapsed < visibleMs) return (visibleMs - elapsed) / fadeMs;
  return 0;
}

// GitHub source hotspot: pinned to the thermal crater floor once the camera
// has settled past its drop-in (~4.0s) but before topography starts
// bridging into the cockpit scene. Timed to currentTime, not scroll
// progress, so it always lands on the same visual regardless of how
// P_AST_END / P_TOPO_END get retuned later.
const TOPO_HOTSPOT_WINDOW = [
  topoTimeToProgress(6.0),
  topoTimeToProgress(8.0),
] as const;
const HOTSPOT_VISIBLE_MS = 2600;
const HOTSPOT_FADE_MS = 300;

// Project pills: scattered over the multi-blob thermal readout just before
// the camera's drop-in, each pinned to one of its hotspots. Driven purely
// by scroll progress (not a real-time timer) so they're 100% reliable
// regardless of scroll speed or direction — a fast scroll-through or
// scrolling back upward both still trace the same fade curve, with no
// "did we catch the entry" trigger to miss. Each pill owns an overlapping
// slice of the shared window (as fractions of it) so, scrolled through at
// any speed, all three are guaranteed to be visible at some point, with a
// stretch in the middle where every slice overlaps and all three show at
// once.
const PROJECTS_WINDOW = [
  topoTimeToProgress(2.8),
  topoTimeToProgress(5.0),
] as const;
const PROJECT_FADE_EDGE = 0.3; // fraction of each pill's own slice spent fading in/out
const PROJECT_SLICES = [
  [0, 0.55],
  [0.2, 0.75],
  [0.45, 1],
] as const;
const PROJECT_LINKS = [
  {
    id: "raivalry",
    name: "R//AI//VALRY",
    url: "https://rivalry-insight-engine.lovable.app/",
    left: "82%",
    top: "24%",
  },
  {
    id: "lastonboarder",
    name: "The Last Onboarder",
    url: "https://lastonboarder.lovable.app/",
    left: "20%",
    top: "40%",
  },
  {
    id: "assetify",
    name: "assetify",
    url: "https://serene-clad-90305952.figma.site/",
    left: "80%",
    top: "82%",
  },
] as const;

// "Bo Moldenhauer" title card, in the asteroid approach sequence: it flips
// in, sits flat and fully legible for roughly frames 55-69 of the
// 120-frame sequence, then rotates away as the camera pushes past it.
// Window given in the asteroid sequence's own local progress (0-1),
// matching how asteroidIdx is derived from asteroidLocal in render().
const CARD_REVEAL_LOCAL = [54 / (AST_COUNT - 1), 68 / (AST_COUNT - 1)] as const;
const CARD_REVEAL_WINDOW = [
  CARD_REVEAL_LOCAL[0] * P_AST_END,
  CARD_REVEAL_LOCAL[1] * P_AST_END,
] as const;
// Real-world exposure, not a scroll-progress fraction: once the card's
// window is entered the CTA holds for a fixed span, clipped the instant
// progress leaves the window (either scroll direction), and re-arms only
// after it's exited and re-entered.
const CARD_CTA_VISIBLE_MS = 2600;
const CARD_CTA_FADE_MS = 300;

function fadeInOut(t: number, edge: number) {
  if (t < edge) return t / edge;
  if (t > 1 - edge) return (1 - t) / edge;
  return 1;
}

function LinkedInMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.124 2.062 2.062 0 0 1 0 4.124zM7.114 20.452H3.558V9h3.556v11.452z" />
    </svg>
  );
}

function GithubMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

type CoverSource = HTMLImageElement | HTMLVideoElement;

function isVideoSource(source: CoverSource): source is HTMLVideoElement {
  return "videoWidth" in source;
}

function getCoverRect(
  sw: number,
  sh: number,
  width: number,
  height: number
) {
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

  return {
    x: (width - drawWidth) / 2,
    y: (height - drawHeight) / 2,
    drawWidth,
    drawHeight,
  };
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
  const { x, y, drawWidth, drawHeight } = getCoverRect(sw, sh, width, height);
  ctx.drawImage(source, x, y, drawWidth, drawHeight);
}

// Where the orb sits within its own source frame (not canvas space), so
// the absorption iris can be centered exactly on it regardless of how the
// video gets cropped to cover different viewport aspect ratios. Measured
// directly from the source frame (connected-component centroid of the
// brightest blob at t=0): x=0.4991, y=0.4328.
const ORB_CENTER_X_FRAC = 0.5;
const ORB_CENTER_Y_FRAC = 0.433;

// Radius guaranteeing full coverage from an arbitrary (possibly off-center)
// point, computed from its distance to the farthest canvas corner.
function maxRadiusFrom(cx: number, cy: number, width: number, height: number) {
  const corners: [number, number][] = [
    [0, 0],
    [width, 0],
    [0, height],
    [width, height],
  ];
  return Math.max(...corners.map(([x, y]) => Math.hypot(x - cx, y - cy)));
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
  const constellationVideoRef = useRef<HTMLVideoElement>(null);
  const orbVideoRef = useRef<HTMLVideoElement>(null);
  const topoText1Ref = useRef<HTMLDivElement>(null);
  const hudLine1Ref = useRef<HTMLSpanElement>(null);
  const hudLine2Ref = useRef<HTMLSpanElement>(null);
  const hudCursor1Ref = useRef<HTMLSpanElement>(null);
  const hudCursor2Ref = useRef<HTMLSpanElement>(null);
  const hotspotRef = useRef<HTMLDivElement>(null);
  const hotspotShownAtRef = useRef<number | null>(null);
  const hotspotInWindowPrevRef = useRef(false);
  const linkedInCtaRef = useRef<HTMLAnchorElement>(null);
  const cardCtaShownAtRef = useRef<number | null>(null);
  const cardInWindowPrevRef = useRef(false);
  const projectPillRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const astImagesRef = useRef<HTMLImageElement[]>([]);
  const progressRef = useRef(0);
  const readyCountRef = useRef(0);
  const primedForIOSRef = useRef(false);
  const parallaxTargetRef = useRef({ x: 0, y: 0 });
  const parallaxSmoothRef = useRef({ x: 0, y: 0 });
  const parallaxAppliedRef = useRef({ x: 0, y: 0 });

  const [ready, setReady] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeProject, setActiveProject] = useState<{
    label: string;
    url: string;
  } | null>(null);

  const render = () => {
    const canvas = canvasRef.current;
    const topoVideo = topoVideoRef.current;
    const cockpitVideo = cockpitVideoRef.current;
    const constellationVideo = constellationVideoRef.current;
    const orbVideo = orbVideoRef.current;
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

    if (progress < BRIDGE2_END) {
      // Cockpit phase, including its own bridge dissolve into the
      // constellation scene near the very end. Same rule as before:
      // cockpit is the only thing ever drawn here, and the incoming scene
      // only overlays once cockpit has fully reached P_COCKPIT_END.
      if (!cockpitVideo || cockpitVideo.readyState < 2) return;
      ctx.clearRect(0, 0, width, height);
      drawCover(ctx, cockpitVideo, width, height);

      if (
        progress > P_COCKPIT_END &&
        constellationVideo &&
        constellationVideo.readyState >= 2
      ) {
        const bridgeT = Math.min(
          1,
          Math.max(0, (progress - P_COCKPIT_END) / P_BRIDGE2)
        );
        const eased = bridgeT * bridgeT * (3 - 2 * bridgeT);
        const maxRadius = Math.hypot(width, height) * 0.6;

        ctx.save();
        ctx.beginPath();
        ctx.arc(width / 2, height / 2, eased * maxRadius, 0, Math.PI * 2);
        ctx.clip();
        ctx.globalCompositeOperation = "screen";
        drawCover(ctx, constellationVideo, width, height);
        ctx.restore();
      }
      return;
    }

    if (progress < BRIDGE3_END) {
      // Constellation phase, including its own bridge dissolve into the
      // orb scene near the very end. Same rule as before: constellation is
      // the only thing ever drawn here, and the orb only overlays once
      // constellation has fully reached its held white-flash frame.
      if (!constellationVideo || constellationVideo.readyState < 2) return;
      ctx.clearRect(0, 0, width, height);
      drawCover(ctx, constellationVideo, width, height);

      if (
        progress > P_CONSTELLATION_END &&
        orbVideo &&
        orbVideo.readyState >= 2 &&
        orbVideo.videoWidth &&
        orbVideo.videoHeight
      ) {
        // Centered on the orb's own on-screen position (not canvas
        // center), so the white flash reads as coalescing directly into
        // it rather than an off-target reveal.
        const orbRect = getCoverRect(
          orbVideo.videoWidth,
          orbVideo.videoHeight,
          width,
          height
        );
        const centerX = orbRect.x + ORB_CENTER_X_FRAC * orbRect.drawWidth;
        const centerY = orbRect.y + ORB_CENTER_Y_FRAC * orbRect.drawHeight;

        const bridgeT = Math.min(
          1,
          Math.max(0, (progress - P_CONSTELLATION_END) / P_BRIDGE3)
        );
        const eased = bridgeT * bridgeT * (3 - 2 * bridgeT);
        const maxRadius = maxRadiusFrom(centerX, centerY, width, height);

        // Normal compositing here, not "screen": the constellation base is
        // blown-out white, and screen(anything, white) always renders back
        // to white regardless of what's on top, silently hiding the orb
        // entirely. Plain source-over lets the circle read as an actual
        // porthole into the orb scene, swallowing the white void as it grows.
        ctx.save();
        ctx.beginPath();
        ctx.arc(centerX, centerY, eased * maxRadius, 0, Math.PI * 2);
        ctx.clip();
        drawCover(ctx, orbVideo, width, height);
        ctx.restore();
      }
      return;
    }

    // Pure orb phase. Nothing else is ever drawn again past this point, so
    // a readiness hiccup can only hold the last good frame.
    if (!orbVideo || orbVideo.readyState < 2) return;
    ctx.clearRect(0, 0, width, height);
    drawCover(ctx, orbVideo, width, height);
  };

  useEffect(() => {
    let cancelled = false;
    const onFirstReady = () => {
      if (cancelled) return;
      readyCountRef.current += 1;
      if (readyCountRef.current === 5) {
        render();
        setReady(true);
      }
    };

    astImagesRef.current = loadImageSequence(AST_COUNT, astPath, onFirstReady);

    const topoVideo = topoVideoRef.current;
    const cockpitVideo = cockpitVideoRef.current;
    const constellationVideo = constellationVideoRef.current;
    const orbVideo = orbVideoRef.current;
    const onTopoLoaded = () => onFirstReady();
    const onCockpitLoaded = () => onFirstReady();
    const onConstellationLoaded = () => onFirstReady();
    const onOrbLoaded = () => onFirstReady();
    topoVideo?.addEventListener("loadeddata", onTopoLoaded);
    cockpitVideo?.addEventListener("loadeddata", onCockpitLoaded);
    constellationVideo?.addEventListener("loadeddata", onConstellationLoaded);
    orbVideo?.addEventListener("loadeddata", onOrbLoaded);
    topoVideo?.load();
    cockpitVideo?.load();
    constellationVideo?.load();
    orbVideo?.load();

    return () => {
      cancelled = true;
      topoVideo?.removeEventListener("loadeddata", onTopoLoaded);
      cockpitVideo?.removeEventListener("loadeddata", onCockpitLoaded);
      constellationVideo?.removeEventListener(
        "loadeddata",
        onConstellationLoaded
      );
      orbVideo?.removeEventListener("loadeddata", onOrbLoaded);
    };
  }, []);

  useEffect(() => {
    const topoQueue = makeSeekQueue(topoVideoRef.current, render);
    const cockpitQueue = makeSeekQueue(cockpitVideoRef.current, render);
    const constellationQueue = makeSeekQueue(
      constellationVideoRef.current,
      render
    );
    const orbQueue = makeSeekQueue(orbVideoRef.current, render);
    const topoVideo = topoVideoRef.current;
    const cockpitVideo = cockpitVideoRef.current;
    const constellationVideo = constellationVideoRef.current;
    const orbVideo = orbVideoRef.current;

    topoVideo?.addEventListener("seeked", topoQueue.handleSeeked);
    cockpitVideo?.addEventListener("seeked", cockpitQueue.handleSeeked);
    constellationVideo?.addEventListener(
      "seeked",
      constellationQueue.handleSeeked
    );
    orbVideo?.addEventListener("seeked", orbQueue.handleSeeked);

    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) {
      return () => {
        topoVideo?.removeEventListener("seeked", topoQueue.handleSeeked);
        cockpitVideo?.removeEventListener("seeked", cockpitQueue.handleSeeked);
        constellationVideo?.removeEventListener(
          "seeked",
          constellationQueue.handleSeeked
        );
        orbVideo?.removeEventListener("seeked", orbQueue.handleSeeked);
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
          constellationVideo
            ?.play()
            .then(() => constellationVideo.pause())
            .catch(() => {});
          orbVideo
            ?.play()
            .then(() => orbVideo.pause())
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
              Math.max(
                0,
                (progress - BRIDGE_END) / (P_COCKPIT_END - BRIDGE_END)
              )
            );
            cockpitQueue.request(
              BRIDGE_SECONDS +
                cockpitLocal * (COCKPIT_SCRUB_SECONDS - BRIDGE_SECONDS)
            );
          }
        }

        if (progress > P_COCKPIT_END) {
          if (progress < BRIDGE2_END) {
            const bridgeT = (progress - P_COCKPIT_END) / P_BRIDGE2;
            constellationQueue.request(bridgeT * BRIDGE_SECONDS);
          } else {
            const constellationLocal = Math.min(
              1,
              Math.max(
                0,
                (progress - BRIDGE2_END) / (P_CONSTELLATION_END - BRIDGE2_END)
              )
            );
            constellationQueue.request(
              BRIDGE_SECONDS +
                constellationLocal *
                  (CONSTELLATION_SCRUB_SECONDS - BRIDGE_SECONDS)
            );
          }
        }

        if (progress > P_CONSTELLATION_END) {
          if (progress < BRIDGE3_END) {
            const bridgeT = (progress - P_CONSTELLATION_END) / P_BRIDGE3;
            orbQueue.request(bridgeT * BRIDGE_SECONDS);
          } else {
            const orbLocal = Math.min(
              1,
              Math.max(0, (progress - BRIDGE3_END) / (1 - BRIDGE3_END))
            );
            orbQueue.request(
              BRIDGE_SECONDS + orbLocal * (ORB_SCRUB_SECONDS - BRIDGE_SECONDS)
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
      constellationVideo?.removeEventListener(
        "seeked",
        constellationQueue.handleSeeked
      );
      orbVideo?.removeEventListener("seeked", orbQueue.handleSeeked);
    };
  }, []);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      parallaxTargetRef.current = {
        x: (e.clientX / window.innerWidth) * 2 - 1,
        y: (e.clientY / window.innerHeight) * 2 - 1,
      };
    };
    const onMouseLeave = () => {
      parallaxTargetRef.current = { x: 0, y: 0 };
    };

    window.addEventListener("mousemove", onMouseMove);
    document.documentElement.addEventListener("mouseleave", onMouseLeave);

    let rafId: number;
    const tick = () => {
      const target = parallaxTargetRef.current;
      const smooth = parallaxSmoothRef.current;
      smooth.x += (target.x - smooth.x) * PARALLAX_LERP;
      smooth.y += (target.y - smooth.y) * PARALLAX_LERP;

      // Only drift during the two flat-footage phases (asteroid approach,
      // cockpit interior) and only once each has fully settled into its
      // own viewing window; otherwise relax back toward zero so the effect
      // never bleeds into a crossfade or the other scenes.
      const progress = progressRef.current;
      const inAsteroid = progress < P_AST_END - P_AST_FADE;
      const inCockpit = progress >= BRIDGE_END && progress < P_COCKPIT_END;
      const parallaxActive = inAsteroid || inCockpit;
      const applied = parallaxAppliedRef.current;
      const wantX = parallaxActive ? smooth.x : 0;
      const wantY = parallaxActive ? smooth.y : 0;
      applied.x += (wantX - applied.x) * PARALLAX_LERP;
      applied.y += (wantY - applied.y) * PARALLAX_LERP;

      const canvas = canvasRef.current;
      if (canvas) {
        const px = applied.x * PARALLAX_MAX_PX;
        const py = applied.y * PARALLAX_MAX_PX;
        const deg = applied.x * PARALLAX_MAX_DEG;
        canvas.style.transform = `scale(${PARALLAX_SCALE}) translate(${px}px, ${py}px) rotate(${deg}deg)`;
      }

      // HUD targeting reticle: locked in place; types on across the first
      // slice of its window, then holds fully typed (cursor still
      // blinking) before fading out near the end.
      const text1El = topoText1Ref.current;
      const line1El = hudLine1Ref.current;
      const line2El = hudLine2Ref.current;
      const cursor1El = hudCursor1Ref.current;
      const cursor2El = hudCursor2Ref.current;
      if (text1El && line1El && line2El && cursor1El && cursor2El) {
        const [start1, end1] = HUD_RETICLE_WINDOW;
        if (progress <= start1 || progress >= end1) {
          text1El.style.opacity = "0";
        } else {
          const t = (progress - start1) / (end1 - start1);
          text1El.style.opacity = String(fadeInOut(t, HUD_FADE_EDGE));

          const typeT = Math.min(1, t / HUD_TYPE_PORTION);
          const totalChars = HUD_LINE_1.length + HUD_LINE_2.length;
          const charsShown = Math.round(typeT * totalChars);
          const line1Shown = Math.min(HUD_LINE_1.length, charsShown);
          const line2Shown = Math.min(
            HUD_LINE_2.length,
            Math.max(0, charsShown - HUD_LINE_1.length)
          );
          line1El.textContent = HUD_LINE_1.slice(0, line1Shown);
          line2El.textContent = HUD_LINE_2.slice(0, line2Shown);

          const line1Done = line1Shown >= HUD_LINE_1.length;
          cursor1El.style.opacity = line1Done ? "0" : "";
          cursor2El.style.opacity = line1Done ? "" : "0";
        }
      }

      // GitHub hotspot: hard-clipped to its own scroll window from either
      // scroll direction, and once triggered, capped to a fixed real-world
      // exposure rather than staying up for as long as the user dwells
      // there. Re-arms only after the window is exited and re-entered.
      const now = performance.now();
      const hotspotEl = hotspotRef.current;
      if (hotspotEl) {
        const [hsStart, hsEnd] = TOPO_HOTSPOT_WINDOW;
        const inHotspotWindow = progress > hsStart && progress < hsEnd;
        if (inHotspotWindow && !hotspotInWindowPrevRef.current) {
          hotspotShownAtRef.current = now;
        }
        if (!inHotspotWindow) {
          hotspotShownAtRef.current = null;
        }
        hotspotInWindowPrevRef.current = inHotspotWindow;

        const visible = timedRevealOpacity(
          hotspotShownAtRef.current,
          now,
          HOTSPOT_VISIBLE_MS,
          HOTSPOT_FADE_MS
        );
        hotspotEl.style.opacity = String(visible);
        hotspotEl.style.transform = `translate(-50%, -50%) scale(${0.85 + visible * 0.15})`;
        hotspotEl.style.pointerEvents = visible > 0.05 ? "auto" : "none";
      }

      // LinkedIn CTA: same hard-clip + fixed-exposure rule as the GitHub
      // hotspot above, timed to the "Bo Moldenhauer" card's reveal window.
      const ctaEl = linkedInCtaRef.current;
      if (ctaEl) {
        const [cardStart, cardEnd] = CARD_REVEAL_WINDOW;
        const inCardWindow = progress > cardStart && progress < cardEnd;
        if (inCardWindow && !cardInWindowPrevRef.current) {
          cardCtaShownAtRef.current = now;
        }
        if (!inCardWindow) {
          cardCtaShownAtRef.current = null;
        }
        cardInWindowPrevRef.current = inCardWindow;

        const opacity = timedRevealOpacity(
          cardCtaShownAtRef.current,
          now,
          CARD_CTA_VISIBLE_MS,
          CARD_CTA_FADE_MS
        );
        ctaEl.style.opacity = String(opacity);
        ctaEl.style.pointerEvents = opacity > 0.05 ? "auto" : "none";
      }

      // Project pills: driven purely by where progress currently sits in
      // PROJECTS_WINDOW — no real-time timer to miss, so scrolling fast,
      // slow, up, or down all reliably show (and hide) each one at the
      // same scroll position every time.
      const [projStart, projEnd] = PROJECTS_WINDOW;
      const projSpan = projEnd - projStart;
      PROJECT_LINKS.forEach((_, i) => {
        const pillEl = projectPillRefs.current[i];
        if (!pillEl) return;
        const [sliceStartFrac, sliceEndFrac] = PROJECT_SLICES[i];
        const sliceStart = projStart + sliceStartFrac * projSpan;
        const sliceEnd = projStart + sliceEndFrac * projSpan;
        let pillOpacity = 0;
        if (progress > sliceStart && progress < sliceEnd) {
          const t = (progress - sliceStart) / (sliceEnd - sliceStart);
          pillOpacity = fadeInOut(t, PROJECT_FADE_EDGE);
        }
        pillEl.style.opacity = String(pillOpacity);
        pillEl.style.pointerEvents = pillOpacity > 0.05 ? "auto" : "none";
      });

      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      document.documentElement.removeEventListener("mouseleave", onMouseLeave);
      cancelAnimationFrame(rafId);
    };
  }, []);

  useEffect(() => {
    if (!activeProject) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActiveProject(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeProject]);

  return (
    <section
      ref={containerRef}
      className="relative bg-void"
      style={{ height: "1900vh" }}
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
        <video
          ref={constellationVideoRef}
          src={CONSTELLATION_VIDEO_SRC}
          preload="auto"
          muted
          playsInline
          className="sr-only"
          aria-hidden="true"
        />
        <video
          ref={orbVideoRef}
          src={ORB_VIDEO_SRC}
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

        <div
          ref={topoText1Ref}
          className="pointer-events-none absolute"
          style={{
            left: "40%",
            top: "26%",
            opacity: 0,
            transform: "translate(-50%, -50%)",
          }}
        >
          <div
            className="text-left"
            style={{
              fontFamily: "var(--font-hud), 'Share Tech Mono', 'Courier New', monospace",
              fontWeight: 700,
              color: "#3fc5ff",
              letterSpacing: "0.18em",
              fontSize: "clamp(1.1rem, 3.4vw, 2rem)",
              textShadow:
                "0 0 6px #3fc5ff, 0 0 16px #3fc5ff, 0 0 32px rgba(63,197,255,0.7), 0 3px 10px rgba(0,4,20,0.95), 0 0 46px rgba(0,10,40,0.8)",
              animation: "hud-flicker 2s ease-in-out infinite",
            }}
          >
            <p className="whitespace-nowrap">
              <span className="underline underline-offset-4">
                <span ref={hudLine1Ref} />
              </span>
              <span
                ref={hudCursor1Ref}
                aria-hidden="true"
                className="ml-1 inline-block align-middle"
                style={{
                  width: "0.2em",
                  height: "1em",
                  background: "#3fc5ff",
                  boxShadow: "0 0 10px #3fc5ff, 0 2px 6px rgba(0,4,20,0.9)",
                  animation: "terminal-cursor-blink 1s steps(1) infinite",
                }}
              />
            </p>
            <p className="mt-2 whitespace-nowrap">
              <span className="underline underline-offset-4">
                <span ref={hudLine2Ref} />
              </span>
              <span
                ref={hudCursor2Ref}
                aria-hidden="true"
                className="ml-1 inline-block align-middle"
                style={{
                  width: "0.2em",
                  height: "1em",
                  background: "#3fc5ff",
                  boxShadow: "0 0 10px #3fc5ff, 0 2px 6px rgba(0,4,20,0.9)",
                  animation: "terminal-cursor-blink 1s steps(1) infinite",
                }}
              />
            </p>
          </div>
        </div>

        {/* In-world node: pinned over the thermal crater floor, visible
            only for the currentTime window it's timed to (see
            TOPO_HOTSPOT_WINDOW). Positioned as a viewport-relative overlay
            rather than projected 3D surface space, since the topography
            shot is pre-rendered video with no live camera matrix to
            project onto. */}
        <div
          ref={hotspotRef}
          className="absolute z-20"
          style={{
            left: "50%",
            top: "54%",
            opacity: 0,
            transform: "translate(-50%, -50%) scale(0.85)",
            pointerEvents: "none",
            willChange: "opacity, transform",
          }}
        >
          <button
            type="button"
            onClick={() =>
              setActiveProject({
                label: "github.com/bofrompursuit",
                url: "https://github.com/bofrompursuit",
              })
            }
            className="flex items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2 font-mono text-[11px] font-semibold tracking-wider backdrop-blur-md transition-transform duration-300 hover:scale-105 md:text-xs"
            style={{
              color: "#eafeff",
              borderColor: "rgba(0,240,255,0.7)",
              background:
                "linear-gradient(135deg, rgba(0,50,70,0.55), rgba(0,12,22,0.4))",
              boxShadow:
                "0 0 14px rgba(0,240,255,0.55), 0 0 34px rgba(0,240,255,0.25), inset 0 0 14px rgba(0,240,255,0.15)",
              textShadow: "0 0 8px rgba(0,240,255,0.8)",
            }}
          >
            <GithubMark className="h-3.5 w-3.5 shrink-0" />
            <span>⚡ EXPLORE SOURCE // GITHUB</span>
          </button>
        </div>

        {/* Project pills: scattered over the multi-blob thermal readout,
            each faded in/out purely by scroll position within its own
            slice of PROJECTS_WINDOW (see PROJECT_SLICES). Same
            viewport-relative positioning approach as the hotspot above. */}
        {PROJECT_LINKS.map((project, i) => (
          <button
            key={project.id}
            ref={(el) => {
              projectPillRefs.current[i] = el;
            }}
            type="button"
            onClick={() =>
              setActiveProject({ label: project.name, url: project.url })
            }
            className="absolute z-20 rounded-2xl border px-4 py-2 text-center font-mono font-semibold tracking-wider backdrop-blur-md transition-transform duration-300 hover:scale-105"
            style={{
              left: project.left,
              top: project.top,
              opacity: 0,
              transform: "translate(-50%, -50%)",
              pointerEvents: "none",
              willChange: "opacity",
              color: "#eafeff",
              borderColor: "rgba(0,240,255,0.7)",
              background:
                "linear-gradient(135deg, rgba(0,50,70,0.55), rgba(0,12,22,0.4))",
              boxShadow:
                "0 0 14px rgba(0,240,255,0.55), 0 0 34px rgba(0,240,255,0.25), inset 0 0 14px rgba(0,240,255,0.15)",
              textShadow: "0 0 8px rgba(0,240,255,0.8)",
            }}
          >
            <span className="block text-[9px] tracking-[0.25em] text-cyan-200/70">
              CHECK OUT
            </span>
            <span className="block whitespace-nowrap text-[11px] md:text-xs">
              {project.name}
            </span>
          </button>
        ))}

        {activeProject && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-6"
            style={{ background: "rgba(2,10,16,0.75)", backdropFilter: "blur(6px)" }}
            onClick={() => setActiveProject(null)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label={`External link: ${activeProject.label}`}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-md rounded-lg border p-6 font-mono"
              style={{
                borderColor: "rgba(0,240,255,0.6)",
                background:
                  "repeating-linear-gradient(0deg, rgba(0,240,255,0.06) 0px, rgba(0,240,255,0.06) 1px, transparent 1px, transparent 24px), repeating-linear-gradient(90deg, rgba(0,240,255,0.06) 0px, rgba(0,240,255,0.06) 1px, transparent 1px, transparent 24px), rgba(2,16,24,0.92)",
                boxShadow:
                  "0 0 24px rgba(0,240,255,0.35), 0 0 60px rgba(0,240,255,0.15), inset 0 0 30px rgba(0,240,255,0.08)",
              }}
            >
              <span
                className="pointer-events-none absolute -top-px -left-px h-4 w-4 border-t-2 border-l-2"
                style={{ borderColor: "#00f0ff" }}
              />
              <span
                className="pointer-events-none absolute -top-px -right-px h-4 w-4 border-t-2 border-r-2"
                style={{ borderColor: "#00f0ff" }}
              />
              <span
                className="pointer-events-none absolute -bottom-px -left-px h-4 w-4 border-b-2 border-l-2"
                style={{ borderColor: "#00f0ff" }}
              />
              <span
                className="pointer-events-none absolute -bottom-px -right-px h-4 w-4 border-b-2 border-r-2"
                style={{ borderColor: "#00f0ff" }}
              />

              <button
                type="button"
                onClick={() => setActiveProject(null)}
                className="absolute top-3 right-3 text-[11px] tracking-wider text-cyan-300 transition-opacity hover:opacity-70"
                style={{ textShadow: "0 0 8px rgba(0,240,255,0.8)" }}
              >
                [X] CLOSE
              </button>

              <p className="text-[11px] tracking-[0.2em] text-cyan-400/80">
                {"// EXTERNAL LINK DETECTED"}
              </p>
              <h3
                className="mt-2 text-lg font-semibold"
                style={{ color: "#eafeff", textShadow: "0 0 10px rgba(0,240,255,0.7)" }}
              >
                Explore the Source
              </h3>
              <p className="mt-2 break-all text-xs text-mist/80">
                {activeProject.label}
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-4">
                <a
                  href={activeProject.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded border px-4 py-2 text-xs font-semibold tracking-wider transition-transform hover:scale-105"
                  style={{
                    color: "#031014",
                    borderColor: "#00f0ff",
                    background: "#00f0ff",
                    boxShadow: "0 0 18px rgba(0,240,255,0.6)",
                  }}
                >
                  OPEN LINK &#8599;
                </a>
                <button
                  type="button"
                  onClick={() => setActiveProject(null)}
                  className="text-xs tracking-wider text-mist/70 transition-colors hover:text-cyan-300"
                >
                  Return to Planet YoBo
                </button>
              </div>
            </div>
          </div>
        )}

        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center bg-void">
            <span className="text-sm text-mist">Loading orbit&hellip;</span>
          </div>
        )}

        <div
          className={`pointer-events-none absolute top-1/2 right-6 -translate-y-1/2 rounded bg-black/25 px-3 py-1.5 font-mono text-xs tracking-wider text-[#39ff14] backdrop-blur-sm transition-opacity duration-700 md:right-14 ${
            scrolled ? "opacity-0" : "opacity-100"
          }`}
          style={{
            textShadow:
              "0 0 6px rgba(57,255,20,0.9), 0 0 18px rgba(57,255,20,0.6), 0 0 32px rgba(57,255,20,0.4)",
          }}
        >
          [initiate //scroll]
        </div>

        {/* Pinned just below-right of the "Bo Moldenhauer" title card in the
            asteroid approach; see CARD_REVEAL_WINDOW for its timing. Fixed
            viewport-relative percentages, same approach as the GitHub
            hotspot above, since the card lives in pre-rendered footage with
            no live camera matrix to project onto. */}
        <a
          ref={linkedInCtaRef}
          href="https://www.linkedin.com/in/bomoldenhauer/"
          target="_blank"
          rel="noopener noreferrer"
          className="absolute z-20 flex items-center gap-1.5 rounded bg-black/25 px-3 py-1.5 font-mono text-xs tracking-wider text-[#39ff14] backdrop-blur-sm transition-transform duration-300 hover:scale-105 hover:text-white hover:shadow-[0_0_10px_rgba(57,255,20,0.85),0_0_28px_rgba(57,255,20,0.5)]"
          style={{
            left: "58%",
            top: "68%",
            opacity: 0,
            pointerEvents: "none",
            textShadow:
              "0 0 6px rgba(57,255,20,0.9), 0 0 18px rgba(57,255,20,0.6), 0 0 32px rgba(57,255,20,0.4)",
          }}
        >
          <LinkedInMark className="h-3 w-3" />
          Click //LINKEDIN
        </a>
      </div>
    </section>
  );
}
