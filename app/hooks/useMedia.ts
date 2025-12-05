import { useEffect, useState } from "react";

interface CertificateRaw {
  rating?: string | null;
  certificate?: string | null;
  country?: { code?: string | null; name?: string | null } | string | null;
  [k: string]: any;
}

export interface Movie {
  id: string;
  title: string;
  year: number;
  poster: string;
  genres: string[];
  rating: number;
  plot: string;
  usCertificates: string; // always a string now
}


export function useMovieFetch(movieorseries: string) {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);

  function extractUSRatingFromCertData(certData: any): string {
    if (!certData) return "NR";

    const arr = Array.isArray(certData.certificates) ? certData.certificates : null;
    if (arr) {
      for (const item of arr) {
        if (!item) continue;
        if (typeof item === "object") {
          const country = item.country;
          const code = typeof country === "object" ? country?.code ?? country?.countryCode : country;
          if (typeof code === "string" && code.toUpperCase() === "US") {
            return (item.rating ?? item.certificate ?? "NR");
          }
          const name = typeof country === "object" ? country?.name : undefined;
          if (typeof name === "string" && /United\s?States|USA|U\.S\.A/i.test(name)) {
            return (item.rating ?? item.certificate ?? "NR");
          }
        }
        if (typeof item === "string") {
          const m = item.match(/US[:\s-]*(.+)$/i) ?? item.match(/\((US|USA)\)\s*[:\s-]*(.+)$/i);
          if (m) return (m[1] || m[2] || "NR").trim();
        }
      }
    }

    if (Array.isArray(certData)) {
      for (const item of certData) {
        if (!item) continue;
        if (typeof item === "object") {
          const c = item.country ?? item.countryInfo ?? item.countryCode ?? null;
          const code = typeof c === "object" ? c?.code : c;
          if (typeof code === "string" && code.toUpperCase() === "US") {
            return (item.rating ?? item.certificate ?? "NR");
          }
          const name = typeof c === "object" ? c?.name : c;
          if (typeof name === "string" && /United\s?States|USA|U\.S\.A/i.test(name)) {
            return (item.rating ?? item.certificate ?? "NR");
          }
        }
        if (typeof item === "string") {
          const m = item.match(/US[:\s-]*(.+)$/i);
          if (m) return (m[1] || "NR").trim();
        }
      }
    }

    const possible = certData.usCertificate ?? certData.us_cert ?? certData.us ?? certData["US"];
    if (typeof possible === "string" && possible) return possible;

    if (typeof certData === "object" && certData.rating) {
      const country = certData.country;
      const code = typeof country === "object" ? country?.code : country;
      if (!code || typeof code !== "string" || code.toUpperCase() === "US" || /United\s?States|USA|U\.S\.A/i.test(String(country))) {
        return certData.rating;
      }
    }

    const text = JSON.stringify(certData || "");
    const match = text.match(/\b(G|PG-13|PG|R|NC-17|TV-MA|TV-14|16\+|18\+)\b/i);
    if (match) return match[0];

    return "NR";
  }

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();
    setLoading(true);

    const fetchMovies = async () => {
      try {
        const res = await fetch("https://api.imdbapi.dev/titles", { signal: controller.signal });
        if (!res.ok) throw new Error("Failed to fetch titles list");
        const data = await res.json();
        if (!mounted) return;

        const basicMovies: Movie[] = (data.titles || [])
          .filter((m: any) => m.type === movieorseries)
          .map((m: any) => {
            let usCert: string = "NR";
            try {
              if (m.certificates) usCert = extractUSRatingFromCertData(m.certificates);
              else if (m.certificate) usCert = extractUSRatingFromCertData(m.certificate);
              else if (m.usCertificate) usCert = m.usCertificate ?? "NR";
            } catch (e) {
              usCert = "NR";
            }

            return {
              id: m.id,
              title: m.primaryTitle || m.originalTitle || "Untitled",
              year: m.startYear || 0,
              poster: m.primaryImage?.url || "/placeholder-poster.png",
              genres: m.genres || [],
              rating: Number(m.rating?.aggregateRating ?? 0),
              plot: m.plot || "",
              usCertificates: usCert,
            } as Movie;
          });

        const needsCertFetch = basicMovies.filter((mv) => !mv.usCertificates || mv.usCertificates === "NR");

        const certFetches = await Promise.allSettled(
          needsCertFetch.map(async (mv) => {
            try {
              const r = await fetch(`https://api.imdbapi.dev/titles/${mv.id}/certificates`, { signal: controller.signal });
              if (!r.ok) return mv;
              const certData = await r.json();
              const us = extractUSRatingFromCertData(certData);
              return { ...mv, usCertificates: us ?? "NR" };
            } catch (e) {
              return mv;
            }
          })
        );

        const certMap = new Map<string, string>();
        certFetches.forEach((res) => {
          if (res.status === "fulfilled") {
            const val = res.value as Movie;
            certMap.set(val.id, val.usCertificates ?? "NR");
          }
        });

        const withCerts = basicMovies.map((mv) => {
          if (certMap.has(mv.id)) {
            return { ...mv, usCertificates: certMap.get(mv.id) ?? "NR" };
          }
          return mv;
        });

        if (!mounted) return;
        setMovies(withCerts);
      } catch (err) {
        if ((err as any)?.name !== "AbortError") console.error("Error fetching movies:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchMovies();
    return () => {
      mounted = false;
      controller.abort();
    };
  }, [movieorseries]);

  return { movies, loading };
}

export type AnimeFetchType =
  | "top"
  | "recommendations"
  | "genre"
  | "search";

/**
 * useAnimeFetch
 * - Mirrors the shape and return contract of your useMovieFetch hook so you can use it alongside movie/tv hooks.
 * - Supports fetching `top` anime, `recommendations` (general recommended anime), `genre` (by genre id) and `search` (query string).
 *
 * Usage examples:
 *  useAnimeFetch('top', '1')                 // top anime, page=1
 *  useAnimeFetch('recommendations', '1')     // recommendations page=1
 *  useAnimeFetch('genre', '10')              // anime filtered by genre id 10 (Fantasy)
 *  useAnimeFetch('search', 'naruto')         // search for "naruto"
 */
export function useAnimeFetch(
  fetchType: AnimeFetchType = "top",
  identifier?: string
) {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);

  function mapJikanItemToMovie(item: any): Movie {
    // many endpoints return slightly different shapes; try common properties first
    const id = String(item.mal_id ?? item.id ?? "");
    const title =
      item.title || (Array.isArray(item.titles) && item.titles[0]?.title) ||
      item.name || "Untitled";

    let year = 0;
    if (typeof item.year === "number") year = item.year;
    else if (item.aired?.from) {
      try {
        const d = new Date(item.aired.from);
        if (!Number.isNaN(d.getFullYear())) year = d.getFullYear();
      } catch (e) {}
    } else if (item.broadcast?.string) {
      // no reliable year here
    }

    const poster =
      item.images?.jpg?.large_image_url ||
      item.images?.webp?.large_image_url ||
      item.image_url ||
      item.poster ||
      "/placeholder-poster.png";

    const genres: string[] =
      (Array.isArray(item.genres) && item.genres.map((g: any) => g.name)) ||
      (Array.isArray(item.genres) && item.genres.map((g: any) => g)) ||
      [];

    const rating = Number(item.score ?? item.rating ?? 0) || 0;
    const plot = item.synopsis ?? item.plot ?? "";

    return {
      id,
      title,
      year,
      poster,
      genres,
      rating,
      plot,
      usCertificates: "NR",
    };
  }

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();
    setLoading(true);

    const buildUrl = () => {
      const page = identifier && fetchType !== "search" ? identifier : undefined;
      switch (fetchType) {
        case "top":
          // optional page number in identifier
          return `https://api.jikan.moe/v4/top/anime${page ? `?page=${encodeURIComponent(page)}` : ""}`;
        case "recommendations":
          // recommendations endpoint supports paging
          return `https://api.jikan.moe/v4/recommendations/anime${page ? `?page=${encodeURIComponent(page)}` : ""}`;
        case "genre":
          // identifier expected to be a MAL genre id (eg. 1=Action, 10=Fantasy)
          // Jikan supports filtering via query on /anime?genres=<id>
          // optionally allow page using identifier like "<genreId>:<page>"
          {
            const parts = (identifier || "").split(":");
            const genreId = parts[0] || "";
            const pageNum = parts[1] || "1";
            // use the search/listing endpoint filtered by genre
            return `https://api.jikan.moe/v4/anime?genres=${encodeURIComponent(
              genreId
            )}&page=${encodeURIComponent(pageNum)}`;
          }
        case "search":
          // identifier is the query string; default to blank search if missing
          const q = encodeURIComponent(identifier || "");
          return `https://api.jikan.moe/v4/anime?q=${q}&limit=25`;
        default:
          return `https://api.jikan.moe/v4/top/anime`;
      }
    };

    const fetchAnime = async () => {
      try {
        const url = buildUrl();
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error(`Jikan fetch failed: ${res.status}`);
        const json = await res.json();
        if (!mounted) return;

        const data = json.data ?? [];

        // recommendations endpoint returns items shaped differently (each item has an `entry` array)
        if (fetchType === "recommendations") {
          // flatten recommendation entries to unique anime entries
          const flattened: any[] = [];
          for (const rec of data) {
            const entries = rec.entry ?? [];
            for (const e of entries) flattened.push(e);
          }
          const mapped = flattened.map(mapJikanItemToMovie);
          // dedupe by id
          const dedup = Array.from(new Map(mapped.map((m) => [m.id, m])).values());
          setMovies(dedup);
          return;
        }

        // normal list endpoints (top, search, genre filtered) return anime objects directly
        const mapped = (Array.isArray(data) ? data : []).map(mapJikanItemToMovie);
        setMovies(mapped);
      } catch (err) {
        if ((err as any)?.name !== "AbortError") console.error("Error fetching anime:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchAnime();

    return () => {
      mounted = false;
      controller.abort();
    };
  }, [fetchType, identifier]);

  return { movies, loading };
}
