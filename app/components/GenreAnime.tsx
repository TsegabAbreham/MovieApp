"use client";
export const dynamic = "force-dynamic";

import { useRef, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Card } from "@heroui/card";
import { Movie } from "../hooks/useMedia";
import { useRemoteNav } from "../hooks/useRemoteNav";
import { useAnimeFetch } from "../hooks/useMedia";
import OptimizedImg from "./OptimizedImg";

interface GenreAnimeProps {
  /**
   * mode: "top" | "recommendations" | "genre" | "search"
   * identifier:
   *  - for "top" and "recommendations": page number as string, e.g. "1"
   *  - for "genre": "<genreId>" or "<genreId>:<page>" (e.g. "10:1")
   *  - for "search": query string (e.g. "naruto")
   */
  mode?: "top" | "recommendations" | "genre" | "search";
  identifier?: string;
}

/** per-row component so we can safely call hook for each row (keeps original style) */
function GenreRow({
  genre,
  movies,
  onCardClick,
}: {
  genre: string;
  movies: Movie[];
  onCardClick: (id: string) => void;
}) {
  const rowRef = useRef<HTMLDivElement | null>(null);

  // Attach the remote nav to this row. This makes left/right work inside the row,
  // and allows up/down from/to other containers to jump here.
  useRemoteNav(rowRef, {
    selector: "a,button,[tabindex='0'],[data-focusable]",
    focusClass: "tv-nav-item",
    loop: false,
    autoScroll: true,
  });

  return (
    <section className="relative z-10">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-2xl gap-4 font-semibold ml-4">{genre}</h2>
        <div className="hidden md:flex gap-2 items-center">
          <button
            className="bg-black/40 hover:bg-black/60 px-3 py-2 rounded"
            onClick={() =>
              rowRef.current?.scrollBy({ left: -rowRef.current.clientWidth * 0.85, behavior: "smooth" })
            }
          >
            ◀
          </button>
          <button
            className="bg-black/40 hover:bg-black/60 px-3 py-2 rounded"
            onClick={() =>
              rowRef.current?.scrollBy({ left: rowRef.current.clientWidth * 0.85, behavior: "smooth" })
            }
          >
            ▶
          </button>
        </div>
      </div>

      <div className="relative">
        <div
          ref={rowRef}
          className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth row-scroll"
          style={{ padding: "16px 56px" }} // 16px top/bottom padding
        >
          {movies.map((m) => (
            <div key={m.id} className="flex-shrink-0 w-[180px] md:w-[220px] row-item">
              {/* make the Card itself focusable */}
              <Card
                tabIndex={0}
                isPressable
                shadow="lg"
                onPress={() => onCardClick(m.id)}
                className="w-[180px] md:w-[220px] overflow-hidden rounded-lg transform transition-transform duration-300 hover:scale-105 hover:shadow-2xl"
              >
                <div className="relative w-full h-[270px] md:h-[320px]">
                  <OptimizedImg src={m.poster} alt={m.title} className="w-full h-full object-cover rounded-lg" />
                  <div className="absolute top-2 right-2 bg-black/60 px-2 py-1 text-xs rounded font-semibold">★ {m.rating.toFixed(1)}</div>
                  <div className="absolute bottom-2 left-2 bg-black/70 px-2 py-1 text-xs rounded font-semibold">{m.year}</div>
                  {m.usCertificates && <div className="absolute top-2 left-2 bg-black/70 px-2 py-1 text-xs rounded font-semibold">{m.usCertificates}</div>}
                </div>
              </Card>
            </div>
          ))}
        </div>

        {/* mobile arrows */}
        <div className="md:hidden absolute left-2 top-1/2 -translate-y-1/2 z-10">
          <button
            className="bg-black/40 hover:bg-black/60 px-3 py-2 rounded"
            onClick={() => rowRef.current?.scrollBy({ left: -rowRef.current.clientWidth * 0.85, behavior: "smooth" })}
          >
            ◀
          </button>
        </div>
        <div className="md:hidden absolute right-2 top-1/2 -translate-y-1/2 z-10">
          <button
            className="bg-black/40 hover:bg-black/60 px-3 py-2 rounded"
            onClick={() => rowRef.current?.scrollBy({ left: rowRef.current.clientWidth * 0.85, behavior: "smooth" })}
          >
            ▶
          </button>
        </div>
      </div>
    </section>
  );
}

/**
 * GenreAnime
 * - Fetches anime from Jikan using useAnimeFetch
 * - Extracts genres from results and renders rows exactly like your Movie `Genre` component
 */
export default function GenreAnime({ mode = "top", identifier = "1" }: GenreAnimeProps) {
  const router = useRouter();
  const pathName = usePathname();

  // fetch anime
  const { movies: fetched, loading } = useAnimeFetch(mode, identifier);

  // remove age limiting for now — just use fetched results
  const allowedMovies = useMemo(() => fetched ?? [], [fetched]);

  // Extract unique genres from allowed movies (same as your original logic)
  const genres = useMemo(() => {
    const allGenres = allowedMovies.flatMap((m) => m.genres ?? []);
    return Array.from(new Set(allGenres.filter(Boolean)));
  }, [allowedMovies]);

  // If still loading and no results yet, return null to match original's behavior of not showing empty rows
  if (loading && (!allowedMovies || allowedMovies.length === 0)) return null;
  if (!genres.length) return null;

  return (
    <>
      {genres.map((genre) => {
        const genreMovies = allowedMovies.filter((m) => (m.genres ?? []).includes(genre));
        return <GenreRow key={genre} genre={genre} movies={genreMovies} onCardClick={(id) => router.push(`${pathName}/${id}`)} />;
      })}
    </>
  );
}
