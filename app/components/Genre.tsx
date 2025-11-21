"use client";

import { useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@heroui/card";
import { Movie } from "../hooks/useMedia";

interface FeaturedProps {
  movies: Movie[];
}

export default function Genre({ movies }: FeaturedProps) {
  const router = useRouter();

  const genres = useMemo(
    () => Array.from(new Set(movies.flatMap((m) => m.genres))).filter((g) => g),
    [movies]
  );

  const genreRefs = useRef<{ [genre: string]: HTMLDivElement | null }>({});

  const scrollGenre = (genre: string, direction: "left" | "right") => {
    const container = genreRefs.current[genre];
    if (!container) return;
    const scrollAmount = container.clientWidth * 0.85;
    container.scrollBy({
      left: direction === "right" ? scrollAmount : -scrollAmount,
      behavior: "smooth",
    });
  };

  return (
    <>
      {genres.map((genre) => {
        const genreMovies = movies.filter((m) => m.genres.includes(genre));
        return (
          <section key={genre} className="relative z-10">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-2xl font-semibold">{genre}</h2>
              <div className="hidden md:flex gap-2 items-center">
                <button
                  onClick={() => scrollGenre(genre, "left")}
                  className="bg-black/40 hover:bg-black/60 px-3 py-2 rounded"
                >
                  ◀
                </button>
                <button
                  onClick={() => scrollGenre(genre, "right")}
                  className="bg-black/40 hover:bg-black/60 px-3 py-2 rounded"
                >
                  ▶
                </button>
              </div>
            </div>

            <div className="relative">
              <div
                ref={(el) => {(genreRefs.current[genre] = el)}}
                className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth py-2 row-scroll"
                style={{ padding: "0 56px" }}
              >
                {genreMovies.map((m) => (
                  <div
                    key={`wrap-${m.id}`}
                    tabIndex={0}
                    onClick={() => router.push(`/Movies/${m.id}`)}
                    className="flex-shrink-0 w-[180px] md:w-[220px] row-item"
                  >
                    <Card
                      isPressable
                      shadow="lg"
                      onPress={() => router.push(`/Movies/${m.id}`)}
                      className="w-[180px] md:w-[220px] overflow-hidden rounded-lg transform transition-transform duration-300 hover:scale-105 hover:shadow-2xl"
                    >
                      <div className="relative w-full h-[270px] md:h-[320px]">
                        <img
                          src={m.poster}
                          alt={m.title}
                          className="w-full h-full object-cover rounded-lg"
                          loading="lazy"
                        />
                        <div className="absolute top-2 right-2 bg-black/60 px-2 py-1 text-xs rounded font-semibold">
                          ★ {m.rating.toFixed(1)}
                        </div>
                        <div className="absolute bottom-2 left-2 bg-black/70 px-2 py-1 text-xs rounded font-semibold">
                          {m.year}
                        </div>
                        {m.usCertificates && (
                          <div className="absolute top-2 left-2 bg-black/70 px-2 py-1 text-xs rounded font-semibold">
                            {m.usCertificates}
                          </div>
                        )}
                      </div>
                    </Card>
                  </div>
                ))}
              </div>

              {/* small arrows for mobile */}
              <div className="md:hidden absolute left-2 top-1/2 -translate-y-1/2 z-10">
                <button
                  onClick={() => scrollGenre(genre, "left")}
                  className="bg-black/40 hover:bg-black/60 px-3 py-2 rounded"
                >
                  ◀
                </button>
              </div>
              <div className="md:hidden absolute right-2 top-1/2 -translate-y-1/2 z-10">
                <button
                  onClick={() => scrollGenre(genre, "right")}
                  className="bg-black/40 hover:bg-black/60 px-3 py-2 rounded"
                >
                  ▶
                </button>
              </div>
            </div>
          </section>
        );
      })}
    </>
  );
}
