"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Navigation from "@/app/Navigation";
import { useRouter } from "next/navigation";
import OptimizedImg from "../../components/OptimizedImg";
import { useActiveProfile, saveContinueWatchingEntry } from "@/app/page";


interface Movie {
  id: string;
  title: string;
  year: number;
  poster: string;
  genres: string[];
  rating: number;
  plot: string;
  usRating?: string;
}

interface Actor {
  id: string;
  name: string;
  character: string;
  image: string;
}

export default function MovieDetail() {
  const router = useRouter();
  const pathname = usePathname(); // e.g., "/movies/tt1234567"
  const id = pathname?.split("/").pop();

  const [movie, setMovie] = useState<Movie | null>(null);
  const [actors, setActors] = useState<Actor[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const profile = useActiveProfile();
  const wantsAutoPlay = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("autoPlay") === "true";

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;
    const fetchAll = async () => {
      setLoading(true);
      setErrorMsg(null);
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      try {
        // Fetch movie details
        const res = await fetch(`https://api.imdbapi.dev/titles/${encodeURIComponent(id)}`, { signal: ac.signal });
        if (!res.ok) {
          if (res.status === 429) {
            setErrorMsg("Rate limited when fetching movie details. Try again later.");
            setMovie(null);
            setActors([]);
            return;
          }
          const txt = await res.text().catch(() => "");
          throw new Error(`Failed to fetch movie details (${res.status}): ${txt}`);
        }
        const data = await res.json();

        // Optional: fetch US certificate
        let usRating: string | undefined;
        try {
          const certRes = await fetch(`https://api.imdbapi.dev/titles/${encodeURIComponent(id)}/certificates`, { signal: ac.signal });
          if (certRes.ok) {
            const certJson = await certRes.json();
            const us = Array.isArray(certJson.countries) ? certJson.countries.find((c: any) => c.country === "US") : undefined;
            usRating = us?.rating || us?.certification;
          }
        } catch (e) {
          // ignore certificate errors (rate limit etc)
        }

        const movieData: Movie = {
          id: data.id,
          title: data.primaryTitle || data.originalTitle || "Untitled",
          year: data.startYear || 0,
          poster: data.primaryImage?.url || "/placeholder-poster.png",
          genres: data.genres || [],
          rating: data.rating?.aggregateRating ?? 0,
          plot: data.plot || "No description available.",
          usRating,
        };

        if (!cancelled) setMovie(movieData);

        // Fetch credits (actors)
        const creditsRes = await fetch(`https://api.imdbapi.dev/titles/${encodeURIComponent(id)}/credits`, { signal: ac.signal });
        if (!creditsRes.ok) {
          if (creditsRes.status === 429) {
            // rate-limited — still show movieData but no actors
            setErrorMsg("Rate limited when fetching actors. Try again later.");
            setActors([]);
            return;
          } else {
            const txt = await creditsRes.text().catch(() => "");
            throw new Error(`Failed to fetch credits (${creditsRes.status}): ${txt}`);
          }
        }

        const creditsJson = await creditsRes.json();
        // API sometimes wraps credits in { credits: [...] } or returns array directly
        const rawCredits = Array.isArray(creditsJson) ? creditsJson : creditsJson.credits || [];

        const actorList: Actor[] = rawCredits
          .filter((c: any) => c.category === "actor" && c.name)
          .map((c: any) => ({
            id: c.name?.id || `${c.name?.displayName}-${Math.random().toString(36).slice(2,7)}`,
            name: c.name?.displayName || "Unknown",
            character: (c.characters && c.characters[0]) || c.character || "",
            image: c.name?.primaryImage?.url || "/placeholder-poster.png",
          }));

        if (!cancelled) setActors(actorList);
      } catch (err: any) {
        if (err.name === "AbortError") return;
        console.error(err);
        setErrorMsg(err?.message ?? "An error occurred");
        setMovie(null);
        setActors([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchAll();

    return () => {
      cancelled = true;
      abortRef.current?.abort();
    };
  }, [id]);

  // save a continue-watching entry when the movie is loaded and a profile is active
  useEffect(() => {
    if (movie && profile && profile.id) {
      try {
        saveContinueWatchingEntry({ mediaId: movie.id, kind: "movie", title: movie.title, poster: movie.poster });
      } catch (e) {
        console.error("Failed to save continue-watching entry", e);
      }
    }
  }, [movie, profile?.id]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-white">
        Loading…
      </div>
    );
  }

  if (!movie) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-white px-6">
        <p>Movie not found.</p>
        {errorMsg && <p className="text-red-400 mt-2 text-center">{errorMsg}</p>}
      </div>
    );
  }

  function generateCode() {
    // 5-digit numeric code
    return Math.floor(10000 + Math.random() * 90000).toString();
  }

  function startWatchTogether() {
    const code = generateCode();
    // navigate to the watch page
    router.push(`/SyncWatcher/${movie!.id}/${code}`);
  }

  return (
    <>
      <Navigation />
      <div className="min-h-screen bg-gray-900 text-white px-4 md:px-6 py-8 pt-24">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Left: Video + basic lower info */}
          <div className="flex-1 space-y-4">
            <div className="w-full bg-black rounded overflow-hidden">
              <iframe
                src={`https://vidsrc.cc/v2/embed/movie/${movie.id}?autoPlay=${wantsAutoPlay ? "true" : "false"}`}
                style={{ width: "100%", height: "520px" }}
                allow="autoplay; fullscreen"
                title={movie.title}
              />
            </div>

            {/* continue-watching saved client-side when user views this movie */}


            {/* Summary card under the video (desktop shows poster in sidebar; mobile shows summary here) */}
            <div className="bg-gray-800 rounded p-4">
              <h2 className="text-2xl font-bold">{movie.title} ({movie.year})</h2>
              <div className="mt-2 text-sm text-gray-300">
                <p><strong>Rating:</strong> ★ {movie.rating.toFixed(1)}{movie.usRating ? ` | US: ${movie.usRating}` : ""}</p>
                <p className="mt-1"><strong>Genres:</strong> {movie.genres.join(", ")}</p>
                <p className="mt-1"><strong>Genres:</strong> {movie.usRating}</p>
                <p className="mt-3">{movie.plot}</p>
              </div>
              {errorMsg && <p className="text-red-400 mt-3 text-sm">{errorMsg}</p>}
            </div>
          </div>

          {/* Right: Sidebar with poster, details, and actors */}
          <aside className="w-full md:w-80 flex-shrink-0">
            <div className="bg-gray-800 rounded p-3 flex flex-col h-[520px]">
              <div className="flex flex-col items-center mb-3">
                <OptimizedImg src={movie.poster} alt={movie.title} className="w-40 h-auto rounded-lg object-cover" />
                <div className="text-sm text-gray-300 mt-1 text-center">{movie.year}</div>
              </div>

              <div className="mb-3">
                <p className="text-sm"><strong>Rating:</strong> ★ {movie.rating.toFixed(1)}</p>
                {movie.usRating && <p className="text-sm">US Rating: {movie.usRating}</p>}
                <p className="text-sm mt-2"><strong>Genres:</strong> {movie.genres.join(", ")}</p>
              </div>
              <button
                onClick={startWatchTogether}
                className="mt-3 w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded"
              >
                Watch Together
              </button>

              <div className="flex-1 overflow-y-auto pr-1">
                <h4 className="text-sm font-semibold mb-2">Actors</h4>

                {actors.length === 0 ? (
                  <p className="text-sm text-gray-400">No actors found or rate-limited.</p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {actors.map((actor) => (
                      <div key={actor.id} className="flex items-center gap-3">
                        <div className="w-12 h-16 bg-gray-700 rounded overflow-hidden flex-shrink-0">
                          <OptimizedImg src={actor.image} alt={actor.name} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{actor.name}</div>
                          <div className="text-xs text-gray-400 truncate">{actor.character}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
