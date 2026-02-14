"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Navigation from "@/app/Navigation";
import { useActiveProfile, saveContinueWatchingEntry } from "@/app/page";
import { useRemoteNav } from "@/app/hooks/useRemoteNav";

interface Episode {
  id: string;
  title: string;
  episodeNumber: number;
  season?: string;
  plot?: string;
  image?: string;
}

interface Anime {
  id: string;
  title: string;
  year?: number;
  poster?: string;
  genres?: string[];
  rating?: number;
  plot?: string;
}

interface AnimeCast {
  name: string;
  role: string;
  image: string;
}

export default function AnimeDetail() {
  const pathname = usePathname();
  const id = pathname?.split("/").pop(); // anime id (e.g., ani21, imdb123456, etc.)

  const [anime, setAnime] = useState<Anime | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [selectedEpisode, setSelectedEpisode] = useState<Episode | null>(null);
  const [loading, setLoading] = useState(true);
  const [episodesLoading, setEpisodesLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [cast, setCast] = useState<AnimeCast[]>([]);
  const [videoType, setVideoType] = useState<"sub" | "dub">("sub");

  const mainRef = useRef<HTMLDivElement | null>(null);
  const sidebarRef = useRef<HTMLDivElement | null>(null);
  const iframeWrapperRef = useRef<HTMLDivElement | null>(null);

  const profile = useActiveProfile();
  const userAge = profile?.age ?? 0;

  // Remote navigation
  useRemoteNav(mainRef, {
    selector: "a,button,iframe,[data-focusable],select,input,textarea",
    focusClass: "tv-nav-item",
    loop: false,
    autoScroll: true,
  });

  useRemoteNav(sidebarRef, {
    selector: "button, a, select, input, textarea, [data-focusable]",
    focusClass: "tv-nav-item",
    loop: true,
    autoScroll: true,
  });

  useEffect(() => {
    if (!id) return;

    const fetchAnimeData = async () => {
      try {
        setLoading(true);
        setErrorMsg(null);

        // Fetch anime details from Jikan
        const animeRes = await fetch(`https://api.jikan.moe/v4/anime/${id}`);
        if (!animeRes.ok) throw new Error("Anime not found");
        const animeJson = await animeRes.json();

        setAnime({
          id: animeJson.data.mal_id.toString(),
          title: animeJson.data.title,
          poster: animeJson.data.images?.jpg?.large_image_url,
          genres: animeJson.data.genres?.map((g: any) => g.name),
          year: animeJson.data.year,
          rating: animeJson.data.score,
          plot: animeJson.data.synopsis,
        });

        // Episodes list
        const epsRes = await fetch(`https://api.jikan.moe/v4/anime/${id}/episodes`);
        const epsJson = await epsRes.json();
        const epsList: Episode[] = epsJson.data.map((ep: any) => ({
          id: ep.mal_id.toString(),
          title: ep.title,
          episodeNumber: ep.episode_id ?? ep.mal_id,
          image: ep.images?.jpg?.image_url,
        }));
        setEpisodes(epsList);
        // if a query param requests a specific episode, try to select it; otherwise default to first
        try {
          const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
          const epParam = params?.get("ep");
          if (epParam) {
            const match = epsList.find((x: any) => String(x.episodeNumber) === String(epParam) || String(x.id) === String(epParam));
            setSelectedEpisode(match ?? epsList[0] ?? null);
          } else {
            setSelectedEpisode(epsList[0] ?? null);
          }
        } catch (e) {
          setSelectedEpisode(epsList[0] ?? null);
        }

        // Fetch cast/characters
        const castRes = await fetch(`https://api.jikan.moe/v4/anime/${id}/characters`);
        const castJson = await castRes.json();
        const castList: AnimeCast[] = castJson.data.map((c: any) => ({
          name: c.character.name,
          role: c.role,
          image: c.character.images?.jpg?.image_url ?? "/placeholder-poster.png",
        }));
        setCast(castList);
      } catch (err: any) {
        console.error(err);
        setErrorMsg(err?.message ?? "Unknown error");
        setAnime(null);
        setEpisodes([]);
      } finally {
        setLoading(false);
      }
    };

    fetchAnimeData();
  }, [id]);

  // Focus iframe on episode change
  useEffect(() => {
    if (selectedEpisode) {
      setTimeout(() => {
        iframeWrapperRef.current?.focus();
      }, 60);
    }

    // save continue-watching for the active profile when episode changes
    try {
      if (selectedEpisode && anime) {
        saveContinueWatchingEntry({
          mediaId: anime.id,
          kind: "anime",
          title: anime.title,
          poster: anime.poster,
          episode: selectedEpisode.episodeNumber,
          season: selectedEpisode.season ?? undefined,
        });
      }
    } catch (e) {
      console.error("save continue watching (anime) failed", e);
    }
  }, [selectedEpisode, videoType]);

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center text-white">Loading…</div>;
  if (!anime) return <div className="min-h-[60vh] flex items-center justify-center text-white px-6">{errorMsg ?? "Anime not found"}</div>;

  return (
    <>
      <Navigation />
      <div className="min-h-screen bg-gray-900 text-white px-4 md:px-6 py-8 pt-24">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Left: Video + info */}
          <div ref={mainRef} className="flex-1 space-y-4">
            <div
              ref={iframeWrapperRef}
              tabIndex={0}
              data-focusable
              className="w-full bg-black rounded overflow-hidden outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {selectedEpisode ? (
                <iframe
                  src={`https://vidsrc.cc/v2/embed/anime/${anime.id}/${selectedEpisode.episodeNumber}/${videoType}?autoPlay=false`}
                  style={{ width: "100%", height: "520px" }}
                  allow="autoplay; fullscreen"
                  title={`${anime.title} Ep${selectedEpisode.episodeNumber} (${videoType})`}
                />
              ) : (
                <div className="w-full h-[520px] flex items-center justify-center bg-gray-800 rounded">
                  <p>{episodesLoading ? "Loading episode..." : "Select an episode from the right"}</p>
                </div>
              )}
            </div>

            {/* Sub/Dub toggle */}
            {selectedEpisode && (
              <div className="flex gap-2 mt-2">
                <button
                  className={`px-3 py-1 rounded ${videoType === "sub" ? "bg-blue-600" : "bg-gray-700"}`}
                  onClick={() => setVideoType("sub")}
                >
                  Sub
                </button>
                <button
                  className={`px-3 py-1 rounded ${videoType === "dub" ? "bg-blue-600" : "bg-gray-700"}`}
                  onClick={() => setVideoType("dub")}
                >
                  Dub
                </button>
              </div>
            )}

            {/* Anime title & description */}
            <div className="bg-gray-800 rounded p-4">
              <h2 className="text-2xl font-bold">{anime.title} ({anime.year ?? "N/A"})</h2>
              <div className="flex flex-col md:flex-row md:gap-4 mt-2">
                <img src={anime.poster} alt={anime.title} className="w-28 h-auto rounded-lg object-cover hidden md:block" />
                <div>
                  <p className="text-sm"><strong>Genres:</strong> {anime.genres?.join(", ")}</p>
                  <p className="mt-2 text-sm text-gray-300">{anime.plot}</p>
                  {errorMsg && <p className="text-sm text-red-400 mt-2">{errorMsg}</p>}
                </div>
              </div>
            </div>

            {/* Cast */}
            {cast.length > 0 && (
              <div className="bg-gray-800 rounded p-4">
                <h3 className="text-lg font-semibold mb-2">Cast / Characters</h3>
                <div className="flex flex-wrap gap-3">
                  {cast.map((c) => (
                    <div key={c.name} className="flex flex-col items-center w-20">
                      <img src={c.image} alt={c.name} className="w-16 h-16 rounded-full object-cover" />
                      <span className="text-xs text-center truncate">{c.name}</span>
                      <span className="text-xs text-gray-400 truncate">{c.role}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: Episode sidebar */}
          <aside className="w-full md:w-80 flex-shrink-0">
            <div ref={sidebarRef} className="bg-gray-800 rounded p-3 flex flex-col h-[520px]">
              <h4 className="text-sm font-semibold mb-2">Episodes</h4>
              {episodesLoading && <p className="text-sm text-gray-300 mb-2">Loading episodes…</p>}
              {episodes.length === 0 && !episodesLoading && <p className="text-sm text-gray-400">No episodes found.</p>}
              <div className="flex-1 overflow-y-auto scrollbar-hide flex flex-col gap-2 pr-1">
                {episodes.map((ep) => (
                  <button
                    key={ep.id}
                    onClick={() => setSelectedEpisode(ep)}
                    className={`flex items-start gap-3 p-2 rounded hover:bg-gray-700 transition text-left ${
                      selectedEpisode?.id === ep.id ? "ring-2 ring-blue-500 bg-gray-700" : ""
                    }`}
                  >
                    <div className="w-20 h-12 bg-gray-700 rounded overflow-hidden flex-shrink-0">
                      <img src={ep.image} alt={ep.title} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-sm truncate">{ep.title}</div>
                      <div className="text-xs text-gray-400">Episode {ep.episodeNumber}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
