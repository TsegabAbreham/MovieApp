"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@heroui/card";

interface Movie {
  id: string;
  title: string;
  year: number;
  poster: string;
  genres: string[];
  rating: number;
  plot: string;
}

export default function TVshowGallery() {
  const router = useRouter();

  // ----- state & refs (always declared, never conditional) -----
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);

  // featured carousel
  const featuredCount = 5; // how many to pick for featured
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const intervalRef = useRef<number | null>(null);
  const featuredTrackRef = useRef<HTMLDivElement | null>(null);
  const dragStartX = useRef<number | null>(null);

  // genre rows
  const genreRefs = useRef<{ [genre: string]: HTMLDivElement | null }>({});

  // remote / cursor state: row & col
  // row 0 = featured (if present), rows 1.. = genre rows
  const [focusRow, setFocusRow] = useState<number>(0);
  const [focusCol, setFocusCol] = useState<number>(0);

  // ----- fetch movies (runs once) -----
  useEffect(() => {
    let mounted = true;
    const fetchMovies = async () => {
      try {
        const res = await fetch("https://api.imdbapi.dev/titles");
        const data = await res.json();
        if (!mounted) return;
        const movieList: Movie[] = (data.titles || [])
          .filter((m: any) => m.type === "tvSeries")
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
        console.error("Error fetching shows:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchMovies();
    return () => { mounted = false; };
  }, []);

  // Derived arrays (safe to compute during render)
  const featuredMovies = movies.slice(0, Math.min(featuredCount, movies.length));
  const genres = Array.from(new Set(movies.flatMap((m) => m.genres))).filter((g) => g);

  // ----- auto-advance featured carousel -----
  useEffect(() => {
    // cleanup old interval
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!isPaused && featuredMovies.length > 1) {
      intervalRef.current = window.setInterval(() => {
        setFeaturedIndex((i) => (i + 1) % featuredMovies.length);
        // advance focus col if user is focused on featured row
        setFocusRow((r) => {
          if (r === 0) setFocusCol((c) => (c + 1) % Math.max(1, featuredMovies.length));
          return r;
        });
      }, 5000);
    }

    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isPaused, featuredMovies.length]);

  // drag handlers for featured (simple threshold)
  function onFeaturedPointerDown(e: React.PointerEvent) {
    dragStartX.current = e.clientX;
    setIsPaused(true);
    try { (e.target as Element).setPointerCapture?.(e.pointerId); } catch {}
  }
  function onFeaturedPointerUp(e: React.PointerEvent) {
    if (dragStartX.current == null) {
      setIsPaused(false);
      return;
    }
    const dx = e.clientX - dragStartX.current;
    const threshold = 50;
    if (dx > threshold) {
      prevFeatured();
    } else if (dx < -threshold) {
      nextFeatured();
    }
    dragStartX.current = null;
    setIsPaused(false);
    try { (e.target as Element).releasePointerCapture?.(e.pointerId); } catch {}
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

  // ----- keyboard / remote navigation -----
  useEffect(() => {
    // helper clamp
    const clamp = (v:number, min:number, max:number) => Math.max(min, Math.min(max, v));

    const onKey = (ev: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea") return;

      if (ev.key === "ArrowRight") {
        ev.preventDefault();
        if (focusRow === 0 && featuredMovies.length > 0) {
          setFocusCol((c) => clamp(c + 1, 0, Math.max(0, featuredMovies.length - 1)));
          setFeaturedIndex((i) => (i + 1) % Math.max(1, featuredMovies.length));
        } else {
          const gi = clamp(focusRow - 1, 0, Math.max(0, genres.length - 1));
          const items = movies.filter((m) => m.genres.includes(genres[gi]));
          setFocusCol((c) => clamp((c || 0) + 1, 0, Math.max(0, items.length - 1)));
        }
      } else if (ev.key === "ArrowLeft") {
        ev.preventDefault();
        if (focusRow === 0 && featuredMovies.length > 0) {
          setFocusCol((c) => clamp(c - 1, 0, Math.max(0, featuredMovies.length - 1)));
          setFeaturedIndex((i) => (i - 1 + Math.max(1, featuredMovies.length)) % Math.max(1, featuredMovies.length));
        } else {
          const gi = clamp(focusRow - 1, 0, Math.max(0, genres.length - 1));
          const items = movies.filter((m) => m.genres.includes(genres[gi]));
          setFocusCol((c) => clamp((c || 0) - 1, 0, Math.max(0, items.length - 1)));
        }
      } else if (ev.key === "ArrowDown") {
        ev.preventDefault();
        const maxRow = genres.length; // 0..genres.length
        setFocusRow((r) => clamp(r + 1, 0, maxRow));
        setFocusCol(0);
      } else if (ev.key === "ArrowUp") {
        ev.preventDefault();
        setFocusRow((r) => clamp(r - 1, 0, genres.length > 0 ? genres.length : 0));
        setFocusCol(0);
      } else if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        if (focusRow === 0 && featuredMovies[focusCol]) {
          router.push(`/TV/${featuredMovies[focusCol].id}`);
        } else {
          const gi = Math.max(0, focusRow - 1);
          const items = movies.filter((m) => m.genres.includes(genres[gi] || ""));
          const item = items[focusCol];
          if (item) router.push(`/TV/${item.id}`);
        }
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusRow, focusCol, featuredMovies, genres, movies, router]);

  // ----- focus -> scroll into view effect -----
  useEffect(() => {
    const selector = `[data-row="${focusRow}"][data-col="${focusCol}"]`;
    const el = document.querySelector<HTMLElement>(selector);
    if (el) {
      // visual "focus"
      el.focus?.({ preventScroll: true });

      // ensure visible
      if (focusRow === 0) {
        // align featured carousel to focused index
        setFeaturedIndex(Math.max(0, Math.min(focusCol, Math.max(0, featuredMovies.length - 1))));
      } else {
        const genreIndex = focusRow - 1;
        const genreName = genres[genreIndex];
        const container = genreRefs.current[genreName];
        if (container) {
          el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRow, focusCol]);

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

  // ----- render -----
  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-white">
        <p>Loading shows…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white px-6 py-8 space-y-12">
      {/* local CSS to hide webkit scrollbar */}
      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* Featured */}
      {featuredMovies.length > 0 && (
        <section>
          <h2 className="text-2xl font-semibold mb-4">Featured</h2>

          <div
            className="relative overflow-hidden rounded-lg"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
          >
            <div
              ref={featuredTrackRef}
              className="flex transition-transform duration-500 ease-out"
              style={{
                width: `${featuredMovies.length * 100}%`,
                transform: `translateX(-${featuredIndex * (100 / featuredMovies.length)}%)`,
              }}
              onPointerDown={onFeaturedPointerDown}
              onPointerUp={onFeaturedPointerUp}
            >
              {featuredMovies.map((m, idx) => {
                const isFocused = focusRow === 0 && focusCol === idx;
                return (
                  <div
                    key={`featured-${m.id}`}
                    className="flex-shrink-0 w-full px-2 md:px-4 py-6"
                    style={{ width: `${100 / featuredMovies.length}%` }}
                  >
                    <div
                      onClick={() => router.push(`/TV/${m.id}`)}
                      role="button"
                      tabIndex={-1}
                      data-row={0}
                      data-col={idx}
                      className={`relative rounded-lg overflow-hidden cursor-pointer shadow-xl hover:scale-[1.01] transition-transform duration-200 ${isFocused ? "ring-4 ring-white/60" : ""}`}
                    >
                      <img
                        src={m.poster}
                        alt={m.title}
                        className="w-full h-[380px] md:h-[440px] object-cover"
                      />
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

            <button onClick={prevFeatured} className="absolute left-5 top-1/2 -translate-y-1/2 z-20 bg-black/40 hover:bg-black/60 text-white px-3 py-2 rounded">◀</button>
            <button onClick={nextFeatured} className="absolute right-5 top-1/2 -translate-y-1/2 z-20 bg-black/40 hover:bg-black/60 text-white px-3 py-2 rounded">▶</button>

            <div className="absolute left-1/2 -translate-x-1/2 bottom-10 z-20 flex gap-2">
              {featuredMovies.map((_, i) => (
                <button key={`dot-${i}`} onClick={() => { setFeaturedIndex(i); setFocusRow(0); setFocusCol(i); }} className={`w-3 h-3 rounded-full ${i === featuredIndex ? "bg-white" : "bg-white/30"}`} aria-label={`Go to featured ${i+1}`} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Genres */}
      {genres.map((genre, rowIdx) => {
        const genreMovies = movies.filter((m) => m.genres.includes(genre));
        const rowNumber = rowIdx + 1;
        return (
          <section key={genre}>
            <h2 className="text-2xl font-semibold mb-4">{genre}</h2>

            <div className="relative">
              <button onClick={() => {
                scrollGenreRow(genreRefs.current, genre);
                scrollGenre(genre, "left");
              }} className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-black/40 hover:bg-black/60 text-white px-3 py-2 rounded">◀</button>

              <div ref={(el) => {(genreRefs.current[genre] = el)}} className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth py-2">
                {genreMovies.map((movie, colIdx) => {
                  const isFocused = focusRow === rowNumber && focusCol === colIdx;
                  return (
                    <Card
                      key={movie.id}
                      isPressable
                      shadow="lg"
                      onPress={() => router.push(`/TV/${movie.id}`)}
                      className={`w-[160px] flex-shrink-0 overflow-hidden rounded-lg transform transition-transform duration-300 hover:scale-105 hover:shadow-2xl ${isFocused ? "ring-4 ring-white/60" : ""}`}
                      data-row={rowNumber}
                      data-col={colIdx}
                      tabIndex={-1}
                    >
                      <div className="relative w-full h-[220px]">
                        <img src={movie.poster} alt={movie.title} className="w-full h-full object-cover rounded-lg" />
                        <div className="absolute top-2 right-2 bg-black/60 px-2 py-1 text-xs rounded font-semibold">★ {movie.rating.toFixed(1)}</div>
                        <div className="absolute bottom-2 left-2 bg-black/70 px-2 py-1 text-xs rounded font-semibold">{movie.year}</div>
                      </div>

                      <div className="mt-2 flex flex-col px-2 pb-3">
                        <div className="font-semibold text-sm truncate">{movie.title}</div>
                      </div>
                    </Card>
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

  // local helper used by JSX (keeps hooks above)
  function scrollGenre(genre: string, direction: "left" | "right") {
    const container = genreRefs.current[genre];
    if (!container) return;
    const scrollAmount = container.clientWidth * 0.8;
    container.scrollBy({ left: direction === "right" ? scrollAmount : -scrollAmount, behavior: "smooth" });
  }

  // fallback helper (not required, placeholder)
  function scrollGenreRow(refs: { [g: string]: HTMLDivElement | null }, genre: string) {
    // no-op; kept for safety
  }
}
