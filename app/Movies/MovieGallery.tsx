"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@heroui/card";

interface Certificate {
  rating: string;
  country: { code: string; name: string };
}

interface Movie {
  id: string;
  title: string;
  year: number;
  poster: string;
  genres: string[];
  rating: number;
  plot: string;
  usCertificates?: string;
}

export default function MovieGallery() {
  const router = useRouter();

  // data + loading
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);

  // derived
  const featuredCount = 5;
  const featuredMovies = useMemo(
    () => movies.slice(0, Math.min(featuredCount, movies.length)),
    [movies]
  );
  const genres = useMemo(
    () => Array.from(new Set(movies.flatMap((m) => m.genres))).filter((g) => g),
    [movies]
  );

  // featured state
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const intervalRef = useRef<number | null>(null);
  const featuredTrackRef = useRef<HTMLDivElement | null>(null);

  // drag support
  const dragRef = useRef({ pressing: false, startX: 0, startTranslate: 0 });

  // refs for genre rows
  const genreRefs = useRef<{ [genre: string]: HTMLDivElement | null }>({});

  // roving focus: row 0 = featured, row 1.. = genres
  const [focusRow, setFocusRow] = useState<number>(0);
  const [focusCol, setFocusCol] = useState<number>(0);

  useEffect(() => {
    let mounted = true;
    const fetchMovies = async () => {
      try {
        const res = await fetch("https://api.imdbapi.dev/titles");
        const data = await res.json();
        if (!mounted) return;
        const movieList: Movie[] = (data.titles || [])
          .filter((m: any) => m.type === "movie")
          .map((m: any) => ({
            id: m.id,
            title: m.primaryTitle || m.originalTitle || "Untitled",
            year: m.startYear || 0,
            poster: m.primaryImage?.url || "/placeholder-poster.png",
            genres: m.genres || [],
            rating: m.rating?.aggregateRating || 0,
            plot: m.plot || "",
          }));
        setMovies(movieList);
      } catch (err) {
        console.error("Error fetching movies:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchMovies();
    return () => {
      mounted = false;
    };
  }, []);

  // auto-advance featured
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

  // keyboard / remote navigation
  useEffect(() => {
    const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
    const onKey = (ev: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea") return;

      if (ev.key === "ArrowRight") {
        ev.preventDefault();
        if (focusRow === 0 && featuredMovies.length > 0) {
          setFocusCol((c) => clamp(c + 1, 0, Math.max(0, featuredMovies.length - 1)));
          setFeaturedIndex((i) => (i + 1) % Math.max(1, featuredMovies.length));
        } else {
          const gi = Math.max(0, focusRow - 1);
          const items = movies.filter((m) => m.genres.includes(genres[gi] || ""));
          setFocusCol((c) => clamp(c + 1, 0, Math.max(0, items.length - 1)));
        }
      } else if (ev.key === "ArrowLeft") {
        ev.preventDefault();
        if (focusRow === 0 && featuredMovies.length > 0) {
          setFocusCol((c) => clamp(c - 1, 0, Math.max(0, featuredMovies.length - 1)));
          setFeaturedIndex((i) => (i - 1 + Math.max(1, featuredMovies.length)) % Math.max(1, featuredMovies.length));
        } else {
          const gi = Math.max(0, focusRow - 1);
          const items = movies.filter((m) => m.genres.includes(genres[gi] || ""));
          setFocusCol((c) => clamp(c - 1, 0, Math.max(0, items.length - 1)));
        }
      } else if (ev.key === "ArrowDown") {
        ev.preventDefault();
        setFocusRow((r) => clamp(r + 1, 0, genres.length));
        setFocusCol(0);
      } else if (ev.key === "ArrowUp") {
        ev.preventDefault();
        setFocusRow((r) => clamp(r - 1, 0, genres.length));
        setFocusCol(0);
      } else if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        if (focusRow === 0 && featuredMovies[focusCol]) {
          router.push(`/Movies/${featuredMovies[focusCol].id}`);
        } else {
          const gi = Math.max(0, focusRow - 1);
          const items = movies.filter((m) => m.genres.includes(genres[gi] || ""));
          const item = items[focusCol];
          if (item) router.push(`/Movies/${item.id}`);
        }
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusRow, focusCol, featuredMovies, genres, movies, router]);

  // when focus changes -> focus DOM node and center it inside container
  useEffect(() => {
    const selector = `[data-row="${focusRow}"][data-col="${focusCol}"]`;
    const el = document.querySelector<HTMLElement>(selector);
    if (!el) return;

    // focus without letting browser scroll automatically
    el.focus({ preventScroll: true });

    if (focusRow === 0) {
      // sync featured index
      setFeaturedIndex(Math.max(0, Math.min(focusCol, Math.max(0, featuredMovies.length - 1))));
      return;
    }

    // center the focused element inside the genre container
    const genreIndex = focusRow - 1;
    const genreName = genres[genreIndex];
    const container = genreRefs.current[genreName];
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const targetRect = el.getBoundingClientRect();

    // compute where to scroll: current scroll + (targetLeft - containerLeft) - centerOffset
    const relativeLeft = container.scrollLeft + (targetRect.left - containerRect.left);
    const centerOffset = (container.clientWidth - targetRect.width) / 2;
    const desiredScrollLeft = Math.max(0, relativeLeft - centerOffset);

    container.scrollTo({ left: Math.round(desiredScrollLeft), behavior: "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRow, focusCol]);

  // initial focus after load
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

  // featured controls
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

  // featured drag handlers
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
    const transform = getComputedStyle(featuredTrackRef.current).transform;
    let left = 0;
    try {
      const mat = transform.match(/matrix.*\((.+)\)/)?.[1]?.split(", ");
      left = Math.abs(Number(mat ? mat[4] : 0));
    } catch {}
    const idx = Math.round(left / width);
    const clamped = Math.min(Math.max(idx, 0), Math.max(0, featuredMovies.length - 1));
    setFeaturedIndex(clamped);
    setIsPaused(false);
  }

  // scroll helper for arrow buttons
  const scrollGenre = (genre: string, direction: "left" | "right") => {
    const container = genreRefs.current[genre];
    if (!container) return;
    const scrollAmount = container.clientWidth * 0.8;
    container.scrollBy({ left: direction === "right" ? scrollAmount : -scrollAmount, behavior: "smooth" });
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-white">
        <p>Loading movies…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white px-6 py-8 space-y-12">
      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        .focus-ring { box-shadow: 0 0 0 4px rgba(255,255,255,0.12); transform: translateZ(0); }
      `}</style>

      {/* Featured */}
      {featuredMovies.length > 0 && (
        <section>
          <h2 className="text-2xl font-semibold mb-4">Featured</h2>

          <div className="relative overflow-hidden rounded-lg" onMouseEnter={() => setIsPaused(true)} onMouseLeave={() => setIsPaused(false)}>
            <div
              ref={featuredTrackRef}
              className="flex transition-transform duration-500 ease-out"
              style={{
                width: `${featuredMovies.length * 100}%`,
                transform: `translateX(-${featuredIndex * (100 / featuredMovies.length)}%)`,
              }}
              onPointerDown={onFeaturedPointerDown}
              onPointerMove={onFeaturedPointerMove}
              onPointerUp={onFeaturedPointerUp}
            >
              {featuredMovies.map((m, idx) => {
                const focused = focusRow === 0 && focusCol === idx;
                return (
                  <div key={m.id} className="flex-shrink-0 w-full px-2 md:px-4 py-6" style={{ width: `${100 / featuredMovies.length}%` }}>
                    <div
                      role="button"
                      tabIndex={0}
                      data-row={0}
                      data-col={idx}
                      onClick={() => { setFocusRow(0); setFocusCol(idx); router.push(`/Movies/${m.id}`); }}
                      onFocus={() => { setFocusRow(0); setFocusCol(idx); }}
                      className={`relative rounded-lg overflow-hidden cursor-pointer shadow-xl hover:scale-[1.01] transition-transform duration-200 ${focused ? "focus-ring" : ""}`}
                    >
                      <img src={m.poster} alt={m.title} className="w-full h-[380px] md:h-[440px] object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/75 to-transparent pointer-events-none" />
                      <div className="absolute left-6 bottom-6 text-left">
                        <h3 className="text-2xl md:text-3xl font-bold">{m.title}</h3>
                        <p className="text-sm text-gray-300 mt-1 max-w-[60ch] line-clamp-2">{m.plot}</p>
                        <div className="mt-3 flex items-center gap-3">
                          <div className="px-3 py-1 bg-black/50 rounded text-sm">{m.year}</div>
                          <div className="px-3 py-1 bg-black/50 rounded text-sm">★ {m.rating.toFixed(1)}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <button onClick={prevFeatured} aria-label="Previous featured" className="absolute left-5 top-1/2 -translate-y-1/2 z-20 bg-black/40 hover:bg-black/60 text-white px-3 py-2 rounded">◀</button>
            <button onClick={nextFeatured} aria-label="Next featured" className="absolute right-5 top-1/2 -translate-y-1/2 z-20 bg-black/40 hover:bg-black/60 text-white px-3 py-2 rounded">▶</button>

            <div className="absolute left-1/2 -translate-x-1/2 bottom-10 z-20 flex gap-2">
              {featuredMovies.map((_, i) => (
                <button key={i} onClick={() => { setFeaturedIndex(i); setFocusRow(0); setFocusCol(i); }} className={`w-3 h-3 rounded-full ${i === featuredIndex ? "bg-white" : "bg-white/30"}`} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Genre rows */}
      {genres.map((genre, gi) => {
        const genreMovies = movies.filter((m) => m.genres.includes(genre));
        const rowNumber = gi + 1; // row 1..
        return (
          <section key={genre}>
            <h2 className="text-2xl font-semibold mb-4">{genre}</h2>

            <div className="relative">
              <button onClick={() => scrollGenre(genre, "left")} className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-black/40 hover:bg-black/60 text-white px-3 py-2 rounded">◀</button>

              <div ref={(el) => {(genreRefs.current[genre] = el)}} className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth py-2">
                {genreMovies.map((m, col) => {
                  const focused = focusRow === rowNumber && focusCol === col;
                  return (
                    <div
                      key={`wrap-${m.id}`}
                      data-row={rowNumber}
                      data-col={col}
                      tabIndex={0}
                      onFocus={() => { setFocusRow(rowNumber); setFocusCol(col); }}
                      onClick={() => { setFocusRow(rowNumber); setFocusCol(col); router.push(`/Movies/${m.id}`); }}
                      className={`flex-shrink-0 w-[160px] ${focused ? "focus-ring" : ""}`}
                    >
                      <Card
                        isPressable
                        shadow="lg"
                        onPress={() => router.push(`/Movies/${m.id}`)}
                        className="w-[160px] overflow-hidden rounded-lg transform transition-transform duration-300 hover:scale-105 hover:shadow-2xl"
                      >
                        <div className="relative w-full h-[220px]">
                          <img src={m.poster} alt={m.title} className="w-full h-full object-cover rounded-lg" />
                          <div className="absolute top-2 right-2 bg-black/60 px-2 py-1 text-xs rounded font-semibold">★ {m.rating.toFixed(1)}</div>
                          <div className="absolute bottom-2 left-2 bg-black/70 px-2 py-1 text-xs rounded font-semibold">{m.year}</div>
                        </div>
                        <div className="mt-2 flex flex-col px-2 pb-3">
                          <div className="font-semibold text-sm truncate">{m.title}</div>
                        </div>
                      </Card>
                    </div>
                  );
                })}
              </div>

              <button onClick={() => scrollGenre(genre, "right")} className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-black/40 hover:bg-black/60 text-white px-3 py-2 rounded">▶</button>
            </div>
          </section>
        );
      })}
    </div>
  );
}
