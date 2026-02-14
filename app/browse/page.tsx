"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Navigation from "../Navigation";
import { Input } from "@heroui/react";
import { Card } from "@heroui/card";
import OptimizedImg from "../components/OptimizedImg";
import { useActiveProfile } from "../page"; // keep your existing import path to the profile hook

interface Movie {
  id: string;
  title: string;
  year: number;
  poster: string;
  genres: string[];
  rating: number;
  plot: string;
  kind?: "movie" | "tv" | "other";
  usCertificates?: string | null;
}

const PLACEHOLDER = "/placeholder-poster.png";

function ratingToAge(cert?: string | null, fallbackRating?: string | number): number {
  if (!cert) {
    // fallback: if numeric rating >= 18 or contains adult genre/label, restrict; else allow
    if (typeof fallbackRating === "string") {
      const c = fallbackRating.toUpperCase();
      if (c.includes("R") || c.includes("NC-17") || c.includes("TV-MA")) return 17;
    } else if (typeof fallbackRating === "number") {
      if (fallbackRating >= 17) return 17;
    }
    return 0; // allow general content
  }

  const c = cert.toUpperCase().trim();
  if (c === "G") return 0;
  if (c === "PG") return 10;
  if (c === "PG-13") return 13;
  if (c === "R") return 17;
  if (c === "NC-17") return 18;
  if (c === "TV-Y") return 0;
  if (c === "TV-Y7") return 7;
  if (c === "TV-G") return 0;
  if (c === "TV-PG") return 10;
  if (c === "TV-14") return 14;
  if (c === "TV-MA") return 17;
  if (c === "NR") return 18; // unrated = adult
  const m = c.match(/(\d+)\+/);
  if (m) return parseInt(m[1], 10);
  return 0; // unknown → assume general
}



export default function BrowsePage() {
  const profile = useActiveProfile?.(); // expects your hook to return { age, ... }
  const profileAge = profile?.age ?? 0;

  const [query, setQuery] = useState<string>("");
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // read initial ?q= from URL
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const initial = params.get("q") ?? "";
    setQuery(initial);
  }, []);

  // detect tv vs movie
  const detectKind = (it: any) => {
    const low = (s?: string) => (typeof s === "string" ? s.toLowerCase() : "");
    if (/tv|series|episode|show/.test(low(it?.titleType) + " " + low(it?.type) + " " + low(it?.programType) + " " + low(it?.kind)))
      return "tv";
    if (it?.titleType?.text && /tv|series|episode|show/.test(it.titleType.text.toLowerCase())) return "tv";
    if (Array.isArray(it?.genres) && it.genres.some((g: string) => /tv|series/i.test(g))) return "tv";
    return "movie";
  };

  // fetch search results when query changes
  useEffect(() => {
    if (!query) {
      setMovies([]);
      setLoading(false);
      return;
    }

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const fetchMovies = async () => {
      setLoading(true);
      try {
        const url = `https://api.imdbapi.dev/search/titles?query=${encodeURIComponent(query)}`;
        const res = await fetch(url, { signal: controller.signal });
        const data = await res.json();

        // defensive extraction of array
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
            (typeof it.genre === "string" ? it.genre.split(",").map((s: string) => s.trim()) : []) ||
            [];

          const rating = Number(it.rating?.aggregateRating || it.imdbRating || it.rating) || 0;

          const plot = it.plot || it.summary || it.description || it.plotSummary || "";

          // try to pick up any certificate info on the search item (best-effort)
          const possibleCert =
            it.usCertificate ??
            it.us_cert ??
            it.certificate ??
            it.certificates ??
            (typeof it.ratingCertificate === "string" ? it.ratingCertificate : undefined) ??
            undefined;

          const usCertificates = typeof possibleCert === "string"
            ? possibleCert
            : Array.isArray(possibleCert) && possibleCert.length > 0
            ? String(possibleCert[0])
            : undefined;

          return {
            id: String(id),
            title: String(title),
            year: Number(year) || 0,
            poster: String(poster),
            genres,
            rating: Number(rating) || 0,
            plot: String(plot),
            kind: detectKind(it),
            usCertificates,
          } as Movie;
        });

        if (!controller.signal.aborted) {
          setMovies(mapped);
        }
      } catch (err: any) {
        if (err.name !== "AbortError") console.error("Error fetching movies:", err);
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

  // filtered by profile age (profileAge used here)
  const filteredMovies = useMemo(() => {
    if (!movies || movies.length === 0) return [];

    return movies.filter((m) => {
      if (m.rating === 0.0) return false; // skip unrated items

      const requiredAge = ratingToAge(m.usCertificates, m.rating);
      return profileAge >= requiredAge;
    });
  }, [movies, profileAge]);



  // update query via form
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query?.trim();
    if (!q) return;
    if (typeof window !== "undefined") {
      const newUrl = `/browse?q=${encodeURIComponent(q)}`;
      window.history.pushState(null, "", newUrl);
    }
    setQuery(q);
  };

  const goTo = (movie: Movie) => {
    if (!movie) return;
    if (movie.kind === "tv") window.location.href = `/TV/${movie.id}`;
    else window.location.href = `/Movies/${movie.id}`;
  };

  return (
    <>
      <Navigation />
      <div className="pt-[72px] min-h-[70vh] p-6 sm:p-10 bg-[#0b0f1a] text-white">
        <div className="max-w-6xl mx-auto">
          <br></br>
          <br></br>
          <center><h1 className="text-3xl sm:text-4xl font-bold mb-6">Search Movies & TV Shows</h1></center>

          <form className="flex items-center gap-4 mb-8" onSubmit={handleSearch} role="search">
            <Input
              variant="flat"
              radius="md"
              placeholder="Search movies and shows."
              value={query ?? ""}
              onChange={(e: any) => setQuery(e.target.value)}
              classNames={{
                base: "flex-1",
                mainWrapper: "h-[56px] sm:h-[64px] shadow-lg",
                inputWrapper:
                  "flex items-center h-full bg-[#11131a] border border-gray-700 rounded-l-md px-4 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition-all duration-200",
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
          ) : filteredMovies.length === 0 ? (
            <div className="py-12 text-center text-gray-300">No results for your profile age. Try another query.</div>
          ) : (
            <section>
              <h2 className="text-2xl font-semibold mb-4">Results</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6" role="grid" aria-label="search results">
                {filteredMovies.map((m) => (
                  <div key={m.id}>
                    <Card
                      isPressable
                      shadow="lg"
                      onPress={() => goTo(m)}
                      className="overflow-hidden rounded-lg transform hover:scale-105 hover:shadow-2xl transition-transform focus-within:scale-105"
                    >
                      <div
                        tabIndex={0}
                        role="button"
                        onClick={() => goTo(m)}
                        className="relative w-full h-[260px] outline-none transition-all rounded-lg"
                      >
                        <OptimizedImg src={m.poster} alt={m.title} className="w-full h-full object-cover rounded-lg" />
                        <div className="absolute top-2 right-2 bg-black/60 px-2 py-1 text-xs rounded font-semibold">★ {m.rating?.toFixed?.(1) ?? "–"}</div>
                        <div className="absolute bottom-2 left-2 bg-black/70 px-2 py-1 text-xs rounded font-semibold">{m.year || "—"}</div>
                        <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
                          <div className="font-semibold text-sm truncate">{m.title}</div>
                          <div className="text-xs text-gray-300 mt-1 line-clamp-2">{m.genres.join(", ")}</div>
                        </div>
                      </div>
                    </Card>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
