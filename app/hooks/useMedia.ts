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


