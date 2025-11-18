"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@heroui/card";

interface Certificate {
  rating: string;
  country: { code: string; name: string };
  attributes?: string[];
}

interface Movie {
  id: string;
  title: string;
  year: number;
  poster: string;
  genres: string[];
  rating: number;
  plot: string;
  usCertificate?: string | null;
}

export default function TVshowGallery() {
  const router = useRouter();

  // ----- state & refs (always declared, never conditional) -----
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);

  // featured carousel
  const featuredCount = 6; // how many to pick for featured (keeps consistent with MovieGallery)
  const featuredMovies = useMemo(() => movies.slice(0, Math.min(featuredCount, movies.length)), [movies]);

  const [featuredIndex, setFeaturedIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const intervalRef = useRef<number | null>(null);
  const featuredTrackRef = useRef<HTMLDivElement | null>(null);
  const backgroundRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef({ pressing: false, startX: 0, startTranslate: 0 });

  // genre rows
  const genreRefs = useRef<{ [genre: string]: HTMLDivElement | null }>({});

  // remote / cursor state: row & col
  // row 0 = featured (if present), rows 1.. = genre rows
  const [focusRow, setFocusRow] = useState<number>(0);
  const [focusCol, setFocusCol] = useState<number>(0);

  // ----- fetch shows (runs once) -----
  useEffect(() => {
    let mounted = true;
    const fetchMovies = async () => {
      try {
        const res = await fetch("https://api.imdbapi.dev/titles");
        const data = await res.json();
        if (!mounted) return;

        // build base list of TV shows
        const basicShows: Movie[] = (data.titles || [])
          .filter((m: any) => m.type === "tvSeries")
          .map((m: any) => ({
            id: m.id,
            title: m.primaryTitle || m.originalTitle || "Untitled",
            year: m.startYear || 0,
            poster: m.primaryImage?.url || "/placeholder-poster.png",
            genres: m.genres || [],
            rating: Number(m.rating?.aggregateRating ?? 0),
            plot: m.plot || "",
            usCertificate: null,
          }));

        // fetch certificates in parallel and attach US certificate (if any)
        const withCerts = await Promise.all(
          basicShows.map(async (sh) => {
            try {
              const r = await fetch(`https://api.imdbapi.dev/titles/${sh.id}/certificates`);
              if (!r.ok) return sh;
              const certData = await r.json();
              const us = certData?.certificates?.find((c: Certificate) => c?.country?.code === "US")?.rating ?? null;
              return { ...sh, usCertificate: us };
            } catch (e) {
              // if certificate fetch fails, return show without certificate
              return sh;
            }
          })
        );

        if (!mounted) return;
        setMovies(withCerts);
      } catch (err) {
        console.error("Error fetching shows:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchMovies();
    return () => {
      mounted = false;
    };
  }, []);

  // Derived arrays (safe to compute during render)
  const genres = useMemo(() => Array.from(new Set(movies.flatMap((m) => m.genres))).filter((g) => g), [movies]);

  // ----- auto-advance featured carousel -----
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
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isPaused, featuredMovies.length]);

  // ----- pointer drag handlers for featured (GPU transform-based) -----
  function onFeaturedPointerDown(e: React.PointerEvent) {
    if (!featuredTrackRef.current) return;
    dragRef.current.pressing = true;
    dragRef.current.startX = e.clientX;
    // current translate in px
    const width = featuredTrackRef.current.clientWidth;
    // startTranslate expressed in px (negative for left shift)
    dragRef.current.startTranslate = -featuredIndex * width;
    try { (e.target as Element).setPointerCapture?.(e.pointerId); } catch {}
    setIsPaused(true);
  }

  function onFeaturedPointerMove(e: React.PointerEvent) {
    if (!dragRef.current.pressing || !featuredTrackRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const translate = dragRef.current.startTranslate + dx;
    // apply direct transform to avoid React reflow
    featuredTrackRef.current.style.transform = `translateX(${translate}px)`;
  }

  function onFeaturedPointerUp(e: React.PointerEvent) {
    if (!featuredTrackRef.current) return;
    dragRef.current.pressing = false;
    try { (e.target as Element).releasePointerCapture?.(e.pointerId); } catch {}

    const width = featuredTrackRef.current.clientWidth;
    // read computed transform matrix to determine left
    const computed = getComputedStyle(featuredTrackRef.current).transform;
    let left = 0;
    try {
      const mat = computed.match(/matrix.*\((.+)\)/)?.[1]?.split(', ');
      left = Math.abs(Number(mat ? mat[4] : 0));
    } catch {}

    const idx = Math.round(left / width);
    const clamped = Math.min(Math.max(idx, 0), Math.max(0, featuredMovies.length - 1));
    setFeaturedIndex(clamped);
    setIsPaused(false);
    // reset inline transform to controlled percentage (keeps visual consistent)
    featuredTrackRef.current.style.transform = `translateX(-${clamped * (100 / Math.max(1, featuredMovies.length))}%)`;
  }

  function nextFeatured() {
    if (featuredMovies.length === 0) return;
    setFeaturedIndex((i) => (i + 1) % featuredMovies.length);
    setFocusRow(0);
    setFocusCol((c) => (c + 1) % featuredMovies.length);
  }

  function prevFeatured() {
    if (featuredMovies.length === 0) return;
    setFeaturedIndex((i) => (i - 1 + featuredMovies.length) % featuredMovies.length);
    setFocusRow(0);
    setFocusCol((c) => (c - 1 + featuredMovies.length) % featuredMovies.length);
  }

  // update blurred background when featured changes (low-overhead)
  useEffect(() => {
    const current = featuredMovies[featuredIndex];
    if (!backgroundRef.current) return;
    if (current) {
      // try to use a smaller image if available (server-dependent); fallback to full poster
      const lowRes = current.poster + (current.poster.includes('?') ? '&' : '?') + 'w=200';
      backgroundRef.current.style.backgroundImage = `url(${lowRes})`;
      backgroundRef.current.style.opacity = '1';
    } else {
      backgroundRef.current.style.opacity = '0';
    }
  }, [featuredIndex, featuredMovies]);

  // ----- keyboard / remote navigation -----
  useEffect(() => {
    const clamp = (v:number, a:number, b:number) => Math.max(a, Math.min(b, v));
    const onKey = (ev: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;

      if (ev.key === 'ArrowRight') {
        ev.preventDefault();
        if (focusRow === 0 && featuredMovies.length > 0) {
          setFocusCol((c) => clamp(c + 1, 0, Math.max(0, featuredMovies.length - 1)));
          setFeaturedIndex((i) => (i + 1) % Math.max(1, featuredMovies.length));
        } else {
          const gi = Math.max(0, focusRow - 1);
          const items = movies.filter((m) => m.genres.includes(genres[gi] || ''));
          setFocusCol((c) => clamp(c + 1, 0, Math.max(0, items.length - 1)));
        }
      } else if (ev.key === 'ArrowLeft') {
        ev.preventDefault();
        if (focusRow === 0 && featuredMovies.length > 0) {
          setFocusCol((c) => clamp(c - 1, 0, Math.max(0, featuredMovies.length - 1)));
          setFeaturedIndex((i) => (i - 1 + Math.max(1, featuredMovies.length)) % Math.max(1, featuredMovies.length));
        } else {
          const gi = Math.max(0, focusRow - 1);
          const items = movies.filter((m) => m.genres.includes(genres[gi] || ''));
          setFocusCol((c) => clamp(c - 1, 0, Math.max(0, items.length - 1)));
        }
      } else if (ev.key === 'ArrowDown') {
        ev.preventDefault();
        setFocusRow((r) => clamp(r + 1, 0, genres.length));
        setFocusCol(0);
      } else if (ev.key === 'ArrowUp') {
        ev.preventDefault();
        setFocusRow((r) => clamp(r - 1, 0, genres.length));
        setFocusCol(0);
      } else if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        if (focusRow === 0 && featuredMovies[focusCol]) {
          router.push(`/TV/${featuredMovies[focusCol].id}`);
        } else {
          const gi = Math.max(0, focusRow - 1);
          const items = movies.filter((m) => m.genres.includes(genres[gi] || ''));
          const item = items[focusCol];
          if (item) router.push(`/TV/${item.id}`);
        }
      } else if (ev.key === 'Home') {
        ev.preventDefault();
        setFocusCol(0);
      } else if (ev.key === 'End') {
        ev.preventDefault();
        if (focusRow === 0) setFocusCol(Math.max(0, featuredMovies.length - 1));
        else {
          const gi = Math.max(0, focusRow - 1);
          const items = movies.filter((m) => m.genres.includes(genres[gi] || ''));
          setFocusCol(Math.max(0, items.length - 1));
        }
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focusRow, focusCol, featuredMovies, genres, movies, router]);

  // ----- focus scrolling for items & rows -----
  useEffect(() => {
    const selector = `[data-row="${focusRow}"][data-col="${focusCol}"]`;
    const el = document.querySelector<HTMLElement>(selector);
    if (!el) return;

    el.focus({ preventScroll: true });

    if (focusRow === 0) {
      setFeaturedIndex(Math.max(0, Math.min(focusCol, Math.max(0, featuredMovies.length - 1))));
      return;
    }

    const genreIndex = focusRow - 1;
    const genreName = genres[genreIndex];
    const container = genreRefs.current[genreName];
    if (!container) return;

    // smooth center-scroll the focused item
    const containerRect = container.getBoundingClientRect();
    const targetRect = el.getBoundingClientRect();

    const relativeLeft = container.scrollLeft + (targetRect.left - containerRect.left);
    const centerOffset = (container.clientWidth - targetRect.width) / 2;
    const desiredScrollLeft = Math.max(0, relativeLeft - centerOffset);

    container.scrollTo({ left: Math.round(desiredScrollLeft), behavior: 'smooth' });
  }, [focusRow, focusCol, genres, featuredMovies]);

  // ----- init focus after movies load -----
  useEffect(() => {
    if (movies.length === 0) return;
    if (featuredMovies.length > 0) {
      setFocusRow(0);
      setFocusCol(0);
    } else if (genres.length > 0) {
      setFocusRow(1);
      setFocusCol(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movies]);

  // ----- helpers -----
  function scrollGenre(genre: string, direction: 'left' | 'right') {
    const container = genreRefs.current[genre];
    if (!container) return;
    const scrollAmount = container.clientWidth * 0.85;
    container.scrollBy({ left: direction === 'right' ? scrollAmount : -scrollAmount, behavior: 'smooth' });
  }

  // ----- render -----
  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-white">
        <p>Loading shows…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white px-6 py-8 space-y-12 relative overflow-x-hidden">
      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        .focus-ring { box-shadow: 0 0 0 4px rgba(255,255,255,0.12); transform: translateZ(0); }

        /* Featured full-bleed background blur */
        .bg-blur {
          position: absolute;
          inset: 0;
          z-index: 0;
          background-position: center;
          background-size: cover;
          filter: blur(18px) saturate(70%);
          transform: scale(1.05);
          transition: opacity 400ms ease;
          opacity: 0;
        }

        /* scroll snap for rows */
        .row-scroll { scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch; }
        .row-item { scroll-snap-align: center; }
      `}</style>

      <div ref={backgroundRef} className="bg-blur" aria-hidden />

      {/* Featured */}
      {featuredMovies.length > 0 && (
        <section className="relative z-10">
          <h2 className="text-3xl font-semibold mb-4">Featured</h2>

          <div className="relative rounded-lg overflow-hidden" onMouseEnter={() => setIsPaused(true)} onMouseLeave={() => setIsPaused(false)}>
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
              {featuredMovies.map((m, idx) => {
                const focused = focusRow === 0 && focusCol === idx;
                return (
                  <div key={m.id} className="flex-shrink-0 w-full px-2 md:px-6 py-6" style={{ width: `${100 / featuredMovies.length}%` }}>
                    <div
                      role="button"
                      tabIndex={0}
                      data-row={0}
                      data-col={idx}
                      onClick={() => { setFocusRow(0); setFocusCol(idx); router.push(`/TV/${m.id}`); }}
                      onFocus={() => { setFocusRow(0); setFocusCol(idx); }}
                      className={`relative rounded-lg overflow-hidden cursor-pointer shadow-2xl hover:scale-[1.015] transition-transform duration-300 ${focused ? "focus-ring" : ""}`}
                    >
                      <img loading="lazy" src={m.poster} alt={m.title} className="w-full h-[420px] md:h-[520px] object-cover" width={1200} height={700} />

                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent pointer-events-none" />

                      <div className="absolute left-6 bottom-6 text-left z-10">
                        <h3 className="text-2xl md:text-4xl font-bold leading-tight">{m.title}</h3>
                        <p className="text-sm md:text-base text-gray-300 mt-2 max-w-[60ch] line-clamp-3">{m.plot}</p>
                        <div className="mt-4 flex items-center gap-3">
                          <div className="px-3 py-1 bg-white/6 rounded text-sm">{m.year}</div>
                          <div className="px-3 py-1 bg-white/6 rounded text-sm">★ {m.rating.toFixed(1)}</div>
                          {m.usCertificate && <div className="px-3 py-1 bg-white/6 rounded text-sm">{m.usCertificate}</div>}
                        </div>
                      </div>

                      {/* subtle action row */}
                      <div className="absolute right-6 bottom-6 z-10 flex gap-2">
                        <button onClick={() => router.push(`/TV/${m.id}`)} className="bg-white text-black px-4 py-2 rounded-md font-semibold">Play</button>
                        <button className="bg-black/40 px-4 py-2 rounded-md border border-white/10">More</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <button onClick={prevFeatured} aria-label="Previous featured" className="absolute left-5 top-1/2 -translate-y-1/2 z-20 bg-black/50 hover:bg-black/70 text-white px-3 py-2 rounded">◀</button>
            <button onClick={nextFeatured} aria-label="Next featured" className="absolute right-5 top-1/2 -translate-y-1/2 z-20 bg-black/50 hover:bg-black/70 text-white px-3 py-2 rounded">▶</button>

            <div className="absolute left-1/2 -translate-x-1/2 bottom-8 z-20 flex gap-2">
              {featuredMovies.map((_, i) => (
                <button key={i} onClick={() => { setFeaturedIndex(i); setFocusRow(0); setFocusCol(i); }} className={`w-3 h-3 rounded-full ${i === featuredIndex ? "bg-white" : "bg-white/30"}`} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Genres */}
      {genres.map((genre, gi) => {
        const genreMovies = movies.filter((m) => m.genres.includes(genre));
        const rowNumber = gi + 1;
        return (
          <section key={genre} className="relative z-10">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-2xl font-semibold">{genre}</h2>
              <div className="hidden md:flex gap-2 items-center">
                <button onClick={() => scrollGenre(genre, 'left')} className="bg-black/40 hover:bg-black/60 px-3 py-2 rounded">◀</button>
                <button onClick={() => scrollGenre(genre, 'right')} className="bg-black/40 hover:bg-black/60 px-3 py-2 rounded">▶</button>
              </div>
            </div>

            <div className="relative">
              <div ref={(el) => {(genreRefs.current[genre] = el)}} className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth py-2 row-scroll" style={{ padding: '0 56px' }}>
                {genreMovies.map((m, col) => {
                  const focused = focusRow === rowNumber && focusCol === col;
                  return (
                    <div
                      key={`wrap-${m.id}`}
                      data-row={rowNumber}
                      data-col={col}
                      tabIndex={0}
                      onFocus={() => { setFocusRow(rowNumber); setFocusCol(col); }}
                      onClick={() => { setFocusRow(rowNumber); setFocusCol(col); router.push(`/TV/${m.id}`); }}
                      className={`flex-shrink-0 w-[180px] md:w-[220px] row-item ${focused ? "focus-ring" : ""}`}
                    >
                      <Card
                        isPressable
                        shadow="lg"
                        onPress={() => router.push(`/TV/${m.id}`)}
                        className="w-[180px] md:w-[220px] overflow-hidden rounded-lg transform transition-transform duration-300 hover:scale-105 hover:shadow-2xl"
                      >
                        <div className="relative w-full h-[270px]">
                          <img loading="lazy" src={m.poster} alt={m.title} className="w-full h-full object-cover rounded-lg" width={440} height={660} />
                          <div className="absolute top-2 right-2 bg-black/60 px-2 py-1 text-xs rounded font-semibold">★ {m.rating.toFixed(1)}</div>
                          <div className="absolute bottom-2 left-2 bg-black/70 px-2 py-1 text-xs rounded font-semibold">{m.year}</div>
                          <div className="absolute top-2 left-2 bg-black/70 px-2 py-1 text-xs rounded font-semibold">{m.usCertificate}</div>
                        </div>
                      </Card>
                    </div>
                  );
                })}
              </div>

              {/* small arrows for mobile */}
              <div className="md:hidden absolute left-2 top-1/2 -translate-y-1/2 z-10">
                <button onClick={() => scrollGenre(genre, 'left')} className="bg-black/40 hover:bg-black/60 px-3 py-2 rounded">◀</button>
              </div>
              <div className="md:hidden absolute right-2 top-1/2 -translate-y-1/2 z-10">
                <button onClick={() => scrollGenre(genre, 'right')} className="bg-black/40 hover:bg-black/60 px-3 py-2 rounded">▶</button>
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
