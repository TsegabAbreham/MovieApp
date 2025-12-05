"use client";
export const dynamic = "force-dynamic";

import React, { useEffect, useRef, useState, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";

import { ratingToAge } from "../page";
import { useRemoteNav } from "../hooks/useRemoteNav";
import { useAnimeFetch } from "../hooks/useMedia";
import Loading from "./loading";

interface FeaturedAnimeProps {
  /**
   * mode: "top" | "recommendations" | "genre" | "search"
   * identifier:
   *  - for "top" and "recommendations": page number as string, e.g. "1"
   *  - for "genre": "<genreId>" or "<genreId>:<page>" (e.g. "10:1")
   *  - for "search": query string (e.g. "naruto")
   */
  mode?: "top" | "recommendations" | "genre" | "search";
  identifier?: string;
  age?: number; // optional parent-provided age filter (uses ratingToAge)
  featuredCount?: number;
}

export default function FeaturedAnime({
  mode = "top",
  identifier = "1",
  age = 0,
  featuredCount = 6,
}: FeaturedAnimeProps) {
  const router = useRouter();
  const pathName = usePathname();

  // fetch anime depending on requested mode
  const { movies: fetched, loading } = useAnimeFetch(mode, identifier);

const featuredMovies = useMemo(() => {
  if (!fetched || fetched.length === 0) return [];
  return fetched.slice(0, Math.min(featuredCount, fetched.length));
}, [fetched, featuredCount]);


  // --- slider state and refs (kept the same behavior as your Featured component) ---
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);

  // Attach remote nav same as movies component
  useRemoteNav(viewportRef, {
    selector: "div[role='button'][tabindex='0']",
    focusClass: "row-item",
    loop: true,
    autoScroll: false,
  });

  // sizing
  const slideWidthRef = useRef<number>(0);
  const gap = 20;
  const containerPadding = 48;

  // transform px
  const translateRef = useRef<number>(0);

  // dragging state
  const dragRef = useRef({
    pressing: false,
    startX: 0,
    startTranslate: 0,
    pointerId: 0,
  });

  // auto-advance interval
  const intervalRef = useRef<number | null>(null);

  // compute layout & initial translate
  function computeLayout() {
    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!viewport || !track) return;

    const vw = viewport.clientWidth;
    const slideWidth = Math.min(Math.round(vw * 0.66), 980);
    slideWidthRef.current = slideWidth;

    const trackWidth = featuredMovies.length * (slideWidth + gap) - gap;
    track.style.width = `${trackWidth}px`;

    const centerOffset = (vw - slideWidth) / 2;
    const newTranslate = -featuredIndex * (slideWidth + gap) + centerOffset;
    translateRef.current = newTranslate;
    track.style.transform = `translateX(${newTranslate}px)`;
  }

  useEffect(() => {
    computeLayout();
    const onResize = () => computeLayout();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [featuredMovies.length, featuredIndex]);

  // keep translate in sync when index changes (smooth)
  useEffect(() => {
    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!viewport || !track) return;
    const vw = viewport.clientWidth;
    const slideW = slideWidthRef.current || Math.min(Math.round(vw * 0.66), 980);
    const centerOffset = (vw - slideW) / 2;
    const target = -featuredIndex * (slideW + gap) + centerOffset;
    track.style.transition = "transform 700ms cubic-bezier(.2,.9,.2,1)";
    translateRef.current = target;
    track.style.transform = `translateX(${target}px)`;
    const t = setTimeout(() => {
      if (track) track.style.transition = "";
    }, 720);
    return () => clearTimeout(t);
  }, [featuredIndex]);

  // auto-advance
  useEffect(() => {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (!isPaused && featuredMovies.length > 1) {
      intervalRef.current = window.setInterval(() => {
        setFeaturedIndex((i) => (i + 1) % featuredMovies.length);
      }, 5000);
    }
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [isPaused, featuredMovies.length]);

  // next / prev helpers
  function nextFeatured() {
    if (featuredMovies.length === 0) return;
    setFeaturedIndex((i) => (i + 1) % featuredMovies.length);
  }
  function prevFeatured() {
    if (featuredMovies.length === 0) return;
    setFeaturedIndex((i) => (i - 1 + featuredMovies.length) % featuredMovies.length);
  }

  // pointer handlers for dragging
  function onPointerDown(e: React.PointerEvent) {
    if (!trackRef.current || !viewportRef.current) return;
    dragRef.current.pressing = true;
    dragRef.current.startX = e.clientX;
    dragRef.current.startTranslate = translateRef.current;
    dragRef.current.pointerId = e.pointerId;
    try {
      (e.target as Element).setPointerCapture?.(e.pointerId);
    } catch {}
    setIsPaused(true);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragRef.current.pressing || !trackRef.current || !viewportRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const newTranslate = dragRef.current.startTranslate + dx;
    translateRef.current = newTranslate;
    trackRef.current.style.transition = ""; // cancel CSS transition while dragging
    trackRef.current.style.transform = `translateX(${newTranslate}px)`;
  }
  function onPointerUp(e: React.PointerEvent) {
    if (!trackRef.current || !viewportRef.current) return;
    dragRef.current.pressing = false;
    try {
      (e.target as Element).releasePointerCapture?.(e.pointerId);
    } catch {}
    // decide nearest index
    const vw = viewportRef.current.clientWidth;
    const slideW = slideWidthRef.current || Math.min(Math.round(vw * 0.66), 980);
    const centerOffset = (vw - slideW) / 2;
    const raw = -translateRef.current + centerOffset; // how far from start in px
    const idx = Math.round(raw / (slideW + gap));
    const clamped = Math.min(Math.max(idx, 0), Math.max(0, featuredMovies.length - 1));
    setFeaturedIndex(clamped);
    setIsPaused(false);
  }

  // sync remote focus -> index
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const onFocusIn = (ev: FocusEvent) => {
      const target = ev.target as HTMLElement | null;
      if (!target) return;
      if (!vp.contains(target)) return;
      const slide = target.closest<HTMLElement>("[data-featured-index]");
      if (!slide) return;
      const idxRaw = slide.dataset.featuredIndex;
      if (!idxRaw) return;
      const idx = Number(idxRaw);
      if (!Number.isNaN(idx) && idx !== featuredIndex) {
        setFeaturedIndex(idx);
      }
    };
    vp.addEventListener("focusin", onFocusIn);
    return () => vp.removeEventListener("focusin", onFocusIn);
  }, [featuredIndex, featuredMovies.length]);

  if (loading && featuredMovies.length === 0) return <div><Loading/></div>;
  if (featuredMovies.length === 0) return null;

  return (
    <section className="relative z-10 px-4 md:px-8 lg:px-12">
      <h2 className="text-3xl font-semibold mb-6">Featured Anime</h2>

      <div
        className="relative rounded-2xl overflow-hidden"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        {/* side shadow overlays */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-36 md:w-48 bg-gradient-to-r from-black/60 to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-36 md:w-48 bg-gradient-to-l from-black/60 to-transparent" />

        {/* viewport */}
        <div
          ref={viewportRef}
          className="relative overflow-hidden"
          style={{ padding: `0 ${containerPadding}px` }}
        >
          <div
            ref={trackRef}
            className="flex items-stretch select-none"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            style={{ willChange: "transform", touchAction: "pan-y" }}
          >
            {featuredMovies.map((m, idx) => {
              const isActive = idx === featuredIndex;
              return (
                <div
                  key={m.id}
                  data-featured-index={idx}
                  className="flex-shrink-0 px-2 py-6"
                  style={{
                    width: slideWidthRef.current || undefined,
                    marginRight: idx === featuredMovies.length - 1 ? 0 : gap,
                  }}
                >
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => router.push(`${pathName}/${m.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") router.push(`${pathName}/${m.id}`);
                    }}
                    className={`relative rounded-2xl overflow-hidden cursor-pointer transition-transform duration-400 ease-out ${
                      isActive ? "shadow-2xl" : "shadow-xl"
                    }`}
                    style={{
                      transform: isActive ? "scale(1)" : "scale(0.94)",
                      transitionProperty: "transform, box-shadow",
                      transitionDuration: "420ms",
                      boxShadow: isActive
                        ? "0 30px 60px rgba(0,0,0,0.55)"
                        : "0 18px 40px rgba(0,0,0,0.45)",
                    }}
                  >
                    <img
                      src={m.poster}
                      alt={m.title}
                      className="w-full h-[420px] md:h-[520px] object-cover"
                      style={{ display: "block" }}
                      draggable={false}
                    />

                    {/* gradient for depth */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent pointer-events-none" />

                    {/* info area */}
                    <div className="absolute left-6 bottom-6 text-left z-10 max-w-[60ch]">
                      <h3 className={`text-2xl md:text-4xl font-bold leading-tight ${isActive ? "" : "opacity-80"}`}>
                        {m.title}
                      </h3>
                      <p className="text-sm md:text-base text-gray-300 mt-2 max-w-[60ch] line-clamp-3">{m.plot}</p>

                      <div className="mt-4 flex items-center gap-3">
                        <div className="px-3 py-1 bg-white/6 rounded text-sm">{m.year}</div>
                        <div className="px-3 py-1 bg-white/6 rounded text-sm">★ {m.rating.toFixed(1)}</div>
                        {m.usCertificates && (
                          <div className="px-3 py-1 bg-white/6 rounded text-sm">{m.usCertificates}</div>
                        )}
                      </div>
                    </div>

                    {/* controls */}
                    <div className="absolute right-6 bottom-6 z-10 flex gap-2">
                      <button
                        onClick={(ev) => {
                          ev.stopPropagation();
                          router.push(`${pathName}/anime/${m.id}`);
                        }}
                        className="bg-white text-black px-4 py-2 rounded-md font-semibold"
                      >
                        Play
                      </button>

                      <button
                        onClick={(ev) => {
                          ev.stopPropagation();
                          // placeholder for more actions (open details modal, etc.)
                        }}
                        className="bg-black/40 px-4 py-2 rounded-md border border-white/10"
                      >
                        More
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* previous / next controls */}
        <button
          onClick={prevFeatured}
          aria-label="Previous featured"
          className="absolute left-3 top-1/2 -translate-y-1/2 z-30 bg-black/50 hover:bg-black/70 text-white px-3 py-2 rounded-full shadow-md"
        >
          ◀
        </button>
        <button
          onClick={nextFeatured}
          aria-label="Next featured"
          className="absolute right-3 top-1/2 -translate-y-1/2 z-30 bg-black/50 hover:bg-black/70 text-white px-3 py-2 rounded-full shadow-md"
        >
          ▶
        </button>

        {/* pips */}
        <div className="absolute left-1/2 -translate-x-1/2 bottom-6 z-30 flex gap-2">
          {featuredMovies.map((_, i) => (
            <button
              key={i}
              onClick={() => setFeaturedIndex(i)}
              aria-label={`Go to featured ${i + 1}`}
              className={`w-3 h-3 rounded-full ${i === featuredIndex ? "bg-white" : "bg-white/30"}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
