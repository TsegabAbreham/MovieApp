"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Navigation from "../Navigation";
import { Input } from "@heroui/react";
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

const PLACEHOLDER = "/placeholder-poster.png";

export default function BrowsePage() {
  const [query, setQuery] = useState<string>("");
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Read initial ?q= from URL on mount (client-side only)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const initial = params.get("q") ?? "";
    setQuery(initial);
  }, []);

  // Fetch when query changes (debounce optional)
  useEffect(() => {
    // If query is empty, clear results
    if (!query) {
      setMovies([]);
      setLoading(false);
      return;
    }

    // Abort previous
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const fetchMovies = async () => {
      setLoading(true);
      try {
        const url = `https://api.imdbapi.dev/search/titles?query=${encodeURIComponent(query)}`;
        const res = await fetch(url, { signal: controller.signal });
        const data = await res.json();

        // Defensive parsing for inconsistent response shapes
        let items: any[] = [];
        if (Array.isArray(data)) items = data;
        else if (Array.isArray(data.results)) items = data.results;
        else if (Array.isArray(data.titles)) items = data.titles;
        else if (Array.isArray(data.results?.titles)) items = data.results.titles;
        else if (Array.isArray(data.data)) items = data.data;
        else {
          const arr = Object.values(data).find((v) => Array.isArray(v));
          if (Array.isArray(arr)) items = arr as any[];
        }

        const mapped: Movie[] = (items || []).map((it: any) => {
          const id =
            it.id ||
            it.title?.id ||
            it.imdb_id ||
            it.idTitle ||
            it.ttId ||
            (it.url ? String(it.url).split("/").pop() : undefined) ||
            Math.random().toString(36).slice(2, 9);

          const title =
            it.title ||
            it.primaryTitle ||
            it.name ||
            it.originalTitle ||
            (it.titleText && it.titleText.text) ||
            "Untitled";

          const year =
            Number(it.year || it.startYear || it.releaseYear || it.yearText) ||
            Number(it.year?.slice?.(0, 4)) ||
            0;

          const poster =
            it.image?.url ||
            it.poster ||
            it.primaryImage?.url ||
            it.posterUrl ||
            PLACEHOLDER;

          const genres =
            (Array.isArray(it.genres) && it.genres) ||
            (typeof it.genre === "string"
              ? it.genre.split(",").map((s: string) => s.trim())
              : []) ||
            [];

          const rating =
            Number(it.rating?.aggregateRating || it.imdbRating || it.rating) || 0;

          const plot =
            it.plot ||
            it.summary ||
            it.description ||
            it.plotSummary ||
            "";

          return {
            id: String(id),
            title: String(title),
            year: Number(year) || 0,
            poster: String(poster),
            genres,
            rating: Number(rating) || 0,
            plot: String(plot),
          } as Movie;
        });

        setMovies(mapped);
      } catch (err: any) {
        if (err.name === "AbortError") {
          // ignored
        } else {
          console.error("Error fetching movies:", err);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    fetchMovies();

    return () => {
      controller.abort();
      abortRef.current = null;
    };
  }, [query]);

  // User submits search: update query state and URL (no Next hooks)
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query?.trim();
    if (!q) return;
    // Update URL without reload
    if (typeof window !== "undefined") {
      const newUrl = `/browse?q=${encodeURIComponent(q)}`;
      window.history.pushState(null, "", newUrl);
    }
    // setQuery already has q because input is bound to query; ensure it triggers fetch
    setQuery(q);
  };

  const featured = useMemo(() => movies.slice(0, Math.min(5, movies.length)), [movies]);

  return (
    <>
      <Navigation />
      <div className="pt-[72px] min-h-[70vh] p-6 sm:p-10 bg-[#0b0f1a] text-white">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl sm:text-4xl font-bold mb-6">Search Movies & TV Shows</h1>

          <form className="flex items-center gap-4 mb-8" onSubmit={handleSearch} role="search">
            <Input
              variant="flat"
              radius="md"
              placeholder="Search movies, shows, actors..."
              value={query ?? ""}
              onChange={(e: any) => setQuery(e.target.value)}
              classNames={{
                base: "flex-1",
                mainWrapper: "h-[56px] sm:h-[64px] shadow-lg",
                inputWrapper:
                  "flex items-center h-full bg-[#1f2937] border border-gray-700 rounded-l-md px-4 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition-all duration-200",
                input:
                  "bg-transparent text-white placeholder-gray-400 h-full leading-none py-0 px-0 outline-none text-sm sm:text-base",
              }}
              aria-label="search input"
            />
            <button
              type="submit"
              className="h-[56px] sm:h-[64px] px-6 bg-blue-600 hover:bg-blue-500 transition-colors rounded-r-md text-white font-medium text-sm sm:text-base flex items-center justify-center"
            >
              Search
            </button>
          </form>

          {loading ? (
            <div className="py-12 text-center text-white">Loading movies…</div>
          ) : movies.length === 0 ? (
            <div className="py-12 text-center text-gray-300">No results. Try another query.</div>
          ) : (
            <>
              {featured.length > 0 && (
                <section className="mb-8">
                  <h2 className="text-2xl font-semibold mb-3">Featured</h2>
                  <div className="flex gap-4 overflow-x-auto py-2">
                    {featured.map((m) => (
                      <div key={m.id} className="flex-shrink-0 w-[260px]">
                        <Card className="overflow-hidden rounded-lg cursor-pointer transform hover:scale-[1.02] transition-transform">
                          <div className="relative w-full h-[150px]">
                            <img src={m.poster} alt={m.title} className="w-full h-full object-cover" />
                          </div>
                          <div className="p-3">
                            <div className="font-semibold truncate">{m.title}</div>
                            <div className="text-sm text-gray-300 mt-1">{m.year} • {m.genres.slice(0,2).join(", ")}</div>
                            <div className="mt-2 text-xs text-gray-400 line-clamp-2">{m.plot}</div>
                          </div>
                        </Card>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section>
                <h2 className="text-2xl font-semibold mb-4">Results</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
                  {movies.map((m) => (
                    <div key={m.id}>
                      <Card
                        isPressable
                        shadow="lg"
                        onPress={() => {
                          // simple navigation without next/router to avoid hooks
                          if (typeof window !== "undefined") {
                            window.location.href = `/Movies/${m.id}`;
                          }
                        }}
                        className="overflow-hidden rounded-lg transform hover:scale-105 hover:shadow-2xl transition-transform"
                      >
                        <div className="relative w-full h-[260px]">
                          <img src={m.poster} alt={m.title} className="w-full h-full object-cover" />
                          <div className="absolute top-2 right-2 bg-black/60 px-2 py-1 text-xs rounded font-semibold">★ {m.rating?.toFixed?.(1) ?? "–"}</div>
                          <div className="absolute bottom-2 left-2 bg-black/70 px-2 py-1 text-xs rounded font-semibold">{m.year || "—"}</div>
                        </div>
                        <div className="mt-2 flex flex-col px-3 pb-3">
                          <div className="font-semibold text-sm truncate">{m.title}</div>
                          <div className="text-xs text-gray-300 mt-1 line-clamp-2">{m.genres.join(", ")}</div>
                        </div>
                      </Card>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </>
  );
}
