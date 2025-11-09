"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Navigation from "@/app/Navigation";

interface Episode {
  id: string;
  title: string;
  episodeNumber: number;
  season: string; // API uses string seasons like "1", "2", ...
  plot?: string;
  image?: string;
}

interface SeasonItem {
  season: string; // "1", "2", ...
  episodeCount: number;
}

interface TVShow {
  id: string;
  title: string;
  year: number;
  poster: string;
  genres: string[];
  rating: number;
  plot: string;
  usRating?: string;
}

export default function TVShowDetail() {
  const pathname = usePathname();
  const id = pathname.split("/").pop();

  const [show, setShow] = useState<TVShow | null>(null);
  const [seasons, setSeasons] = useState<SeasonItem[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<string | null>(null);
  const [episodesBySeason, setEpisodesBySeason] = useState<Record<string, Episode[]>>({});
  const [selectedEpisode, setSelectedEpisode] = useState<Episode | null>(null);
  const [loading, setLoading] = useState(true);
  const [episodesLoading, setEpisodesLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;
    const loadShowAndSeasons = async () => {
      try {
        setLoading(true);
        setErrorMsg(null);

        // show details
        const res = await fetch(`https://api.imdbapi.dev/titles/${id}`);
        if (!res.ok) throw new Error(`Show not found (status ${res.status})`);
        const data = await res.json();

        setShow({
          id: data.id,
          title: data.primaryTitle || data.originalTitle || "Untitled",
          year: data.startYear || 0,
          poster: data.primaryImage?.url || "/placeholder-poster.png",
          genres: data.genres || [],
          rating: data.rating?.aggregateRating ?? 0,
          plot: data.plot || "No description available.",
        });

        // seasons list (lightweight)
        const seasonsRes = await fetch(`https://api.imdbapi.dev/titles/${id}/seasons`);
        if (!seasonsRes.ok) {
          if (seasonsRes.status === 429) {
            setErrorMsg("Rate limit reached while fetching seasons. Try again later.");
            setSeasons([]);
            return;
          } else {
            const txt = await seasonsRes.text().catch(() => "");
            throw new Error(`Failed to fetch seasons (${seasonsRes.status}): ${txt}`);
          }
        }

        const seasonsJson = await seasonsRes.json();
        const seasonsArray: SeasonItem[] = Array.isArray(seasonsJson.seasons) ? seasonsJson.seasons : [];

        setSeasons(seasonsArray);

        if (seasonsArray.length > 0 && !cancelled) {
          setSelectedSeason(seasonsArray[0].season);
        }
      } catch (err: any) {
        console.error(err);
        setErrorMsg(err?.message ?? "Unknown error");
        setShow(null);
        setSeasons([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadShowAndSeasons();

    return () => {
      cancelled = true;
      fetchAbortRef.current?.abort();
    };
  }, [id]);

  // fetch episodes on-demand when selectedSeason changes (and not cached)
  useEffect(() => {
    if (!id || !selectedSeason) return;

    // if cached, use it (and select first episode if none)
    if (episodesBySeason[selectedSeason] && episodesBySeason[selectedSeason].length > 0) {
      const epList = episodesBySeason[selectedSeason];
      if (!selectedEpisode) setSelectedEpisode(epList[0]);
      return;
    }

    const fetchEpisodes = async () => {
      try {
        setEpisodesLoading(true);
        setErrorMsg(null);
        fetchAbortRef.current?.abort();
        const ac = new AbortController();
        fetchAbortRef.current = ac;

        const url = `https://api.imdbapi.dev/titles/${id}/episodes?season=${encodeURIComponent(selectedSeason)}`;
        const res = await fetch(url, { signal: ac.signal });

        if (!res.ok) {
          if (res.status === 429) {
            setErrorMsg("Rate limit reached while fetching episodes. Wait a bit and try again.");
            setEpisodesBySeason((prev) => ({ ...prev, [selectedSeason]: [] }));
            return;
          } else {
            const txt = await res.text().catch(() => "");
            throw new Error(`Failed to fetch episodes (${res.status}): ${txt}`);
          }
        }

        const json = await res.json();
        const episodesRaw = Array.isArray(json.episodes) ? json.episodes : [];

        const epList: Episode[] = episodesRaw.map((e: any) => ({
          id: e.id,
          title: e.title || `Episode ${e.episodeNumber}`,
          episodeNumber: Number(e.episodeNumber),
          season: e.season ?? selectedSeason,
          plot: e.plot ?? "",
          image: e.primaryImage?.url ?? "/placeholder-poster.png",
        }));

        setEpisodesBySeason((prev) => ({ ...prev, [selectedSeason]: epList }));
        setSelectedEpisode((prev) => (prev && prev.season === selectedSeason ? prev : epList[0] ?? null));
      } catch (err: any) {
        if (err.name === "AbortError") return;
        console.error(err);
        setErrorMsg(err?.message ?? "Error fetching episodes");
        setEpisodesBySeason((prev) => ({ ...prev, [selectedSeason]: [] }));
      } finally {
        setEpisodesLoading(false);
      }
    };

    fetchEpisodes();

    return () => {
      fetchAbortRef.current?.abort();
    };
  }, [id, selectedSeason, episodesBySeason, selectedEpisode]);

  const currentEpisodes = selectedSeason ? episodesBySeason[selectedSeason] ?? [] : [];

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-white">
        Loading…
      </div>
    );
  }

  if (!show) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-white px-6">
        <p className="text-center">Show not found.</p>
        {errorMsg && <p className="text-center text-red-400 mt-2">{errorMsg}</p>}
      </div>
    );
  }

  return (
    <>
      <Navigation />
      <div className="min-h-screen bg-gray-900 text-white px-4 md:px-6 py-8 pt-24">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Left: Video + basic info */}
          <div className="flex-1 space-y-4">
            {/* iframe */}
            <div className="w-full bg-black rounded overflow-hidden">
              {selectedEpisode ? (
                <iframe
                  src={`https://vidsrc.cc/v2/embed/tv/${show.id}/${selectedEpisode.season}/${selectedEpisode.episodeNumber}?autoPlay=false`}
                  style={{ width: "100%", height: "520px" }}
                  sandbox="allow-scripts allow-same-origin"
                  allow="autoplay; fullscreen"
                  title={`${show.title} S${selectedEpisode.season}E${selectedEpisode.episodeNumber}`}
                />
              ) : (
                <div className="w-full h-[520px] flex items-center justify-center bg-gray-800 rounded">
                  <p>{episodesLoading ? "Loading episode..." : "Select a season & episode from the right"}</p>
                </div>
              )}
            </div>

            {/* Show title + summary (below video) */}
            <div className="bg-gray-800 rounded p-4">
              <h2 className="text-2xl font-bold">{show.title} ({show.year})</h2>
              <div className="flex flex-col md:flex-row md:items-center md:gap-4 mt-2">
                <img src={show.poster} alt={show.title} className="w-28 h-auto rounded-lg object-cover hidden md:block" />
                <div>
                  <p className="text-sm"><strong>Rating:</strong> ★ {show.rating.toFixed(1)}</p>
                  <p className="text-sm"><strong>Genres:</strong> {show.genres.join(", ")}</p>
                  <p className="mt-2 text-sm text-gray-300">{show.plot}</p>
                </div>
              </div>
              {errorMsg && <p className="text-sm text-red-400 mt-2">{errorMsg}</p>}
            </div>
          </div>

          {/* Right: Sidebar (Seasons + Episodes) */}
          <aside className="w-full md:w-80 flex-shrink-0">
            <div className="bg-gray-800 rounded p-3 flex flex-col h-[520px]">
              <div className="mb-3">
                <h3 className="text-lg font-semibold">Seasons</h3>
                <select
                  value={selectedSeason ?? ""}
                  onChange={(e) => {
                    const seasonValue = e.target.value;
                    setSelectedSeason(seasonValue);
                    setSelectedEpisode(null); // will be set after episodes fetch
                    setErrorMsg(null);
                  }}
                  className="w-full mt-2 p-2 rounded bg-gray-700 text-white"
                >
                  <option value="" disabled>Select season</option>
                  {seasons.map((s) => (
                    <option key={`season-${s.season}`} value={s.season}>
                      Season {s.season} ({s.episodeCount})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex-1 overflow-y-auto scrollbar-hide pr-1">
                <h4 className="text-sm font-semibold mb-2">Episodes</h4>

                {episodesLoading && (
                  <div className="text-sm text-gray-300 mb-2">Loading episodes…</div>
                )}

                {selectedSeason == null ? (
                  <p className="text-sm text-gray-400">Choose a season to see episodes</p>
                ) : currentEpisodes.length === 0 && !episodesLoading ? (
                  <p className="text-sm text-gray-400">No episodes found (or rate-limited).</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {currentEpisodes.map((ep) => (
                      <button
                        key={ep.id}
                        onClick={() => setSelectedEpisode(ep)}
                        className={`flex items-start gap-3 p-2 rounded hover:bg-gray-700 transition text-left ${
                          selectedEpisode?.id === ep.id ? "ring-2 ring-blue-500 bg-gray-700" : ""
                        }`}
                        aria-pressed={selectedEpisode?.id === ep.id}
                      >
                        <div className="w-20 h-12 bg-gray-700 rounded overflow-hidden flex-shrink-0">
                          <img src={ep.image} alt={ep.title} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-sm truncate">{ep.title}</div>
                          <div className="text-xs text-gray-400">Episode {ep.episodeNumber}</div>
                          <div className="text-xs text-gray-400 line-clamp-2 mt-1">{ep.plot}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-3 text-xs text-gray-400">
                {episodesLoading ? "Loading…" : ""}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
