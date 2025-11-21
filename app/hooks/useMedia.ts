import { useEffect, useState } from "react";

interface Certificate {
  rating: string;
  country: { code: string; name: string };
  attributes?: string[];
}

export interface Movie {
  id: string;
  title: string;
  year: number;
  poster: string;
  genres: string[];
  rating: number;
  plot: string;
  usCertificates?: string | null;
}

export interface MovieOrSeries{
  movieorseries: string;
}

export function useMovieFetch(movieorseries: string) {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const fetchMovies = async () => {
      try {
        const res = await fetch("https://api.imdbapi.dev/titles");
        const data = await res.json();
        if (!mounted) return;

        const basicMovies: Movie[] = (data.titles || [])
          .filter((m: any) => m.type === movieorseries)
          .map((m: any) => ({
            id: m.id,
            title: m.primaryTitle || m.originalTitle || "Untitled",
            year: m.startYear || 0,
            poster: m.primaryImage?.url || "/placeholder-poster.png",
            genres: m.genres || [],
            rating: Number(m.rating?.aggregateRating ?? 0),
            plot: m.plot || "",
            usCertificates: null,
          }));

        const withCerts = await Promise.all(
          basicMovies.map(async (mv) => {
            try {
              const r = await fetch(`https://api.imdbapi.dev/titles/${mv.id}/certificates`);
              if (!r.ok) return mv;

              const certData = await r.json();
              const us =
                certData?.certificates?.find((c: Certificate) => c?.country?.code === "US")?.rating ?? null;

              return { ...mv, usCertificates: us };
            } catch (e) {
              return mv;
            }
          })
        );

        if (!mounted) return;
        setMovies(withCerts);
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

  return { movies, loading };
}
