"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Navigation from "@/app/Navigation";

import { useActiveProfile } from "@/app/page";
import { ratingToAge } from "@/app/page";

import { useRemoteNav } from "@/app/hooks/useRemoteNav";

interface Episode {
  id: string;
  title: string;
  episodeNumber: number;
  season: string;
  plot?: string;
  image?: string;
}

interface SeasonItem {
  season: string;
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
  usCertificates?: string | null;
}

interface Certificate {
  rating: string;
  country: { code: string; name: string };
  attributes?: string[];
}

export default function TVShowDetail() {
  const pathname = usePathname();
  const id = pathname?.split("/").pop();

  const [show, setShow] = useState<TVShow | null>(null);
  const [seasons, setSeasons] = useState<SeasonItem[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<string | null>(null);
  const [episodesBySeason, setEpisodesBySeason] = useState<Record<string, Episode[]>>({});
  const [selectedEpisode, setSelectedEpisode] = useState<Episode | null>(null);
  const [loading, setLoading] = useState(true);
  const [episodesLoading, setEpisodesLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchAbortRef = useRef<AbortController | null>(null);

  const profile = useActiveProfile();
  const userAge = profile?.age ?? 0;

  const requiredAge = ratingToAge(show?.usCertificates ?? null);
  const canWatch = userAge >= requiredAge;

  // two refs: main area (video + details) and sidebar (seasons + episodes)
  const mainRef = useRef<HTMLDivElement | null>(null);
  const sidebarRef = useRef<HTMLDivElement | null>(null);
  // iframe wrapper so we can programmatically focus it after selecting an episode
  const iframeWrapperRef = useRef<HTMLDivElement | null>(null);

  // remote nav for the main content (iframe + controls)
  useRemoteNav(mainRef, {
    selector: "a,button,iframe,[data-focusable],select,input,textarea",
    focusClass: "tv-nav-item",
    loop: false,
    autoScroll: true,
  });

  // remote nav for the right sidebar (season select + episode buttons)
  useRemoteNav(sidebarRef, {
    selector: "button, a, select, input, textarea, [data-focusable]",
    focusClass: "tv-nav-item",
    loop: true,
    autoScroll: true,
  });

  useEffect(() => {
    if (!id) return;

    let cancelled = false;
    const loadShowAndSeasons = async () => {
      try {
        setLoading(true);
        setErrorMsg(null);

        const res = await fetch(`https://api.imdbapi.dev/titles/${id}`);
        if (!res.ok) throw new Error(`Show not found (status ${res.status})`);
        const data = await res.json();

        // certificate
        let usCert: string | null = null;
        try {
          const certRes = await fetch(`https://api.imdbapi.dev/titles/${id}/certificates`);
          if (certRes.ok) {
            const certJson = await certRes.json();
            const us = certJson?.certificates?.find((c: Certificate) => c?.country?.code === "US");
            usCert = us?.rating ?? null;
          }
        } catch (_) {}

        setShow({
          id: data.id,
          title: data.primaryTitle || data.originalTitle || "Untitled",
          year: data.startYear || 0,
          poster: data.primaryImage?.url || "/placeholder-poster.png",
          genres: data.genres || [],
          rating: data.rating?.aggregateRating ?? 0,
          plot: data.plot || "No description available.",
          usCertificates: usCert,
        });

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

  // episodes fetch when selectedSeason changes
  useEffect(() => {
    if (!id || !selectedSeason) return;

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

        const pageSize = 50;
        const gatheredMap = new Map<string, any>();

        let pageToken: string | null = null;
        let keepGoing = true;

        while (keepGoing) {
          if (ac.signal.aborted) break;

          const tokenParam: string = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "";
          const url = `https://api.imdbapi.dev/titles/${id}/episodes?season=${encodeURIComponent(selectedSeason)}&pageSize=${pageSize}${tokenParam}`;

          const res = await fetch(url, { signal: ac.signal });

          if (!res.ok) {
            if (res.status === 429) {
              setErrorMsg("Rate limit reached while fetching episodes. Some episodes may be missing. Try again later.");
              break;
            }
            let errBody: any = null;
            try { errBody = await res.json(); } catch (e) {}
            if (res.status === 500 && errBody && /decode page token/i.test(String(errBody.message || ""))) {
              setErrorMsg("Invalid paging token received — stopping pagination.");
              break;
            }
            const txt = await res.text().catch(() => "");
            throw new Error(`Failed to fetch episodes (${res.status}): ${txt}`);
          }

          const json = await res.json();

          let pageEpisodes: any[] = [];
          if (Array.isArray(json.episodes)) pageEpisodes = json.episodes;
          else if (Array.isArray(json)) pageEpisodes = json;
          else {
            const arr = Object.values(json).find((v) => Array.isArray(v));
            if (Array.isArray(arr)) pageEpisodes = arr as any[];
          }

          for (const e of pageEpisodes) {
            const eid = e.id || e.episodeId || `${selectedSeason}-${e.episodeNumber}`;
            if (!gatheredMap.has(eid)) gatheredMap.set(eid, e);
          }

          const nextToken = json.nextPageToken || json.pageToken || json.next_token || json.nextPage || (json.pagination && json.pagination.nextPageToken) || null;
          if (nextToken) {
            pageToken = String(nextToken);
            continue;
          }

          if (json.pagination && typeof json.pagination === "object") {
            const cur = Number(json.pagination.page || 0);
            const total = Number(json.pagination.totalPages || json.pagination.total_pages || 0);
            if (total > 0 && cur > 0 && cur < total) {
              pageToken = String(cur + 1);
              continue;
            }
          }

          keepGoing = false;
        }

        const gathered = Array.from(gatheredMap.values());
        const epList: Episode[] = gathered
          .map((e: any, idx: number) => ({
            id: e.id || e.episodeId || `${selectedSeason}-${idx}`,
            title: e.title || `Episode ${e.episodeNumber || idx + 1}`,
            episodeNumber: Number(e.episodeNumber || e.epNumber || idx + 1),
            season: String(e.season ?? selectedSeason),
            plot: e.plot ?? e.description ?? "",
            image: e.primaryImage?.url ?? e.image?.url ?? "/placeholder-poster.png",
          }))
          .sort((a, b) => (Number.isFinite(a.episodeNumber) && Number.isFinite(b.episodeNumber) ? a.episodeNumber - b.episodeNumber : 0));

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

  // when an episode is selected, move focus to the iframe wrapper so the user can interact
  useEffect(() => {
    if (selectedEpisode) {
      // small timeout to allow DOM updates
      setTimeout(() => {
        iframeWrapperRef.current?.focus();
      }, 60);
    }
  }, [selectedEpisode]);

  if (!canWatch) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-white px-6">
        <p className="text-center">You are not old enough to view this content.</p>
      </div>
    );
  }

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
          <div ref={mainRef} className="flex-1 space-y-4">
            {/* iframe area: make wrapper tabbable/focusable so remote nav can land here */}
            <div
              ref={iframeWrapperRef}
              tabIndex={0}
              data-focusable
              aria-label={selectedEpisode ? `${show.title} S${selectedEpisode.season}E${selectedEpisode.episodeNumber}` : `${show.title} video frame`}
              className="w-full bg-black rounded overflow-hidden outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {selectedEpisode ? (
                <iframe
                  src={`https://vidsrc.cc/v2/embed/tv/${show.id}/${selectedEpisode.season}/${selectedEpisode.episodeNumber}?autoPlay=false`}
                  style={{ width: "100%", height: "520px" }}
                  allow="autoplay; fullscreen"
                  title={`${show.title} S${selectedEpisode.season}E${selectedEpisode.episodeNumber}`}
                />
              ) : (
                <div className="w-full h-[520px] flex items-center justify-center bg-gray-800 rounded">
                  <p>{episodesLoading ? "Loading episode..." : "Select a season & episode from the right"}</p>
                </div>
              )}
            </div>

            {/* episode-specific plot/details (only shown in main area, avoids spoilers in sidebar) */}
            {selectedEpisode && (
              <div className="bg-gray-800 rounded p-4">
                <h3 className="text-lg font-semibold">
                  {selectedEpisode.title} — Episode {selectedEpisode.episodeNumber}
                </h3>
                <p className="mt-2 text-sm text-gray-300">{selectedEpisode.plot || "No description available."}</p>
              </div>
            )}

            {/* Show title + summary (below video) */}
            <div className="bg-gray-800 rounded p-4">
              <h2 className="text-2xl font-bold">{show.title} ({show.year})</h2>
              <div className="flex flex-col md:flex-row md:items-center md:gap-4 mt-2">
                <img src={show.poster} alt={show.title} className="w-28 h-auto rounded-lg object-cover hidden md:block" />
                <div>
                  <p className="text-sm"><strong>Rating:</strong> ★ {show.rating.toFixed(1)}</p>
                  <p className="text-sm"><strong>Genres:</strong> {show.genres.join(", ")}</p>
                  <p className="text-sm"><strong>Age rating:</strong> {show.usCertificates}</p>
                  <p className="mt-2 text-sm text-gray-300">{show.plot}</p>
                </div>
              </div>
              {errorMsg && <p className="text-sm text-red-400 mt-2">{errorMsg}</p>}
            </div>
          </div>

          {/* Right: Sidebar (Seasons + Episodes) */}
          <aside className="w-full md:w-80 flex-shrink-0">
            <div ref={sidebarRef} className="bg-gray-800 rounded p-3 flex flex-col h-[520px]">
              <div className="mb-3">
                <h3 className="text-lg font-semibold">Seasons</h3>
                <select
                  value={selectedSeason ?? ""}
                  onChange={(e) => {
                    const seasonValue = e.target.value;
                    setSelectedSeason(seasonValue);
                    setSelectedEpisode(null); // will be set after episodes fetch (and avoid spoilers)
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
                        // keep images and title but hide full plot to avoid spoilers
                      >
                        <div className="w-20 h-12 bg-gray-700 rounded overflow-hidden flex-shrink-0">
                          <img src={ep.image} alt={ep.title} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-sm truncate">{ep.title}</div>
                          <div className="text-xs text-gray-400">Episode {ep.episodeNumber}</div>
                          {/* removed plot preview from the sidebar to avoid spoilers */}
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
