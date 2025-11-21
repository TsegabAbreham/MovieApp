"use client";
import { useEffect, useRef, useState, useMemo } from "react";
import { useRouter } from "next/navigation";

import { Movie } from "../hooks/useMedia";

interface FeaturedProps {
  movies: Movie[];
}

export default function Featured({ movies }: FeaturedProps) {
  const router = useRouter();
  const featuredCount = 6;
  const featuredMovies = useMemo(
    () => movies.slice(0, Math.min(featuredCount, movies.length)),
    [movies]
  );

  const [featuredIndex, setFeaturedIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const intervalRef = useRef<number | null>(null);
  const featuredTrackRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef({ pressing: false, startX: 0, startTranslate: 0 });

  // --- auto-advance featured with pause handling ---
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

  // --- drag & navigation handlers ---
  function nextFeatured() {
    if (featuredMovies.length === 0) return;
    setFeaturedIndex((i) => (i + 1) % featuredMovies.length);
  }
  function prevFeatured() {
    if (featuredMovies.length === 0) return;
    setFeaturedIndex((i) => (i - 1 + featuredMovies.length) % featuredMovies.length);
  }
  function onFeaturedPointerDown(e: React.PointerEvent) {
    if (!featuredTrackRef.current) return;
    dragRef.current.pressing = true;
    dragRef.current.startX = e.clientX;
    dragRef.current.startTranslate = -featuredIndex * featuredTrackRef.current.clientWidth;
    try { (e.target as Element).setPointerCapture?.(e.pointerId); } catch {}
    setIsPaused(true);
  }
  function onFeaturedPointerMove(e: React.PointerEvent) {
    if (!dragRef.current.pressing || !featuredTrackRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const translate = dragRef.current.startTranslate + dx;
    featuredTrackRef.current.style.transform = `translateX(${translate}px)`;
  }
  function onFeaturedPointerUp(e: React.PointerEvent) {
    if (!featuredTrackRef.current) return;
    dragRef.current.pressing = false;
    try { (e.target as Element).releasePointerCapture?.(e.pointerId); } catch {}
    const width = featuredTrackRef.current.clientWidth;
    const computed = getComputedStyle(featuredTrackRef.current).transform;
    let left = 0;
    try {
      const mat = computed.match(/matrix.*\((.+)\)/)?.[1]?.split(", ");
      left = Math.abs(Number(mat ? mat[4] : 0));
    } catch {}
    const idx = Math.round(left / width);
    const clamped = Math.min(Math.max(idx, 0), Math.max(0, featuredMovies.length - 1));
    setFeaturedIndex(clamped);
    setIsPaused(false);
  }

  if (featuredMovies.length === 0) return null; // nothing to show

  return (
    <section className="relative z-10">
      <h2 className="text-3xl font-semibold mb-4">Featured</h2>
      <div
        className="relative rounded-lg overflow-hidden"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        <div
          ref={featuredTrackRef}
          className="flex transition-transform duration-700 ease-out"
          style={{
            width: `${featuredMovies.length * 100}%`,
            transform: `translateX(-${featuredIndex * (100 / featuredMovies.length)}%)`,
          }}
          onPointerDown={onFeaturedPointerDown}
          onPointerMove={onFeaturedPointerMove}
          onPointerUp={onFeaturedPointerUp}
          onPointerCancel={onFeaturedPointerUp}
        >
          {featuredMovies.map((m) => (
            <div
              key={m.id}
              className="flex-shrink-0 w-full px-2 md:px-6 py-6"
              style={{ width: `${100 / featuredMovies.length}%` }}
            >
              <div
                role="button"
                tabIndex={0}
                onClick={() => router.push(`/Movies/${m.id}`)}
                className="relative rounded-lg overflow-hidden cursor-pointer shadow-2xl hover:scale-[1.015] transition-transform duration-300"
              >
                <img src={m.poster} alt={m.title} className="w-full h-[420px] md:h-[520px] object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent pointer-events-none" />
                <div className="absolute left-6 bottom-6 text-left z-10">
                  <h3 className="text-2xl md:text-4xl font-bold leading-tight">{m.title}</h3>
                  <p className="text-sm md:text-base text-gray-300 mt-2 max-w-[60ch] line-clamp-3">{m.plot}</p>
                  <div className="mt-4 flex items-center gap-3">
                    <div className="px-3 py-1 bg-white/6 rounded text-sm">{m.year}</div>
                    <div className="px-3 py-1 bg-white/6 rounded text-sm">★ {m.rating.toFixed(1)}</div>
                    {m.usCertificates && (
                      <div className="px-3 py-1 bg-white/6 rounded text-sm">{m.usCertificates}</div>
                    )}
                  </div>
                </div>
                <div className="absolute right-6 bottom-6 z-10 flex gap-2">
                  <button onClick={() => router.push(`/Movies/${m.id}`)} className="bg-white text-black px-4 py-2 rounded-md font-semibold">Play</button>
                  <button className="bg-black/40 px-4 py-2 rounded-md border border-white/10">More</button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <button onClick={prevFeatured} aria-label="Previous featured" className="absolute left-5 top-1/2 -translate-y-1/2 z-20 bg-black/50 hover:bg-black/70 text-white px-3 py-2 rounded">◀</button>
        <button onClick={nextFeatured} aria-label="Next featured" className="absolute right-5 top-1/2 -translate-y-1/2 z-20 bg-black/50 hover:bg-black/70 text-white px-3 py-2 rounded">▶</button>

        <div className="absolute left-1/2 -translate-x-1/2 bottom-8 z-20 flex gap-2">
          {featuredMovies.map((_, i) => (
            <button
              key={i}
              onClick={() => setFeaturedIndex(i)}
              className={`w-3 h-3 rounded-full ${i === featuredIndex ? "bg-white" : "bg-white/30"}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
