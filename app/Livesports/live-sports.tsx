"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Team = { name?: string; badge?: string };
type RawMatch = {
  id?: string;
  title?: string;
  category?: string;
  date?: number | string;
  status?: string;
  is_live?: boolean;
  views?: number;
  importance?: number;
  teams?: { home?: Team; away?: Team };
};
type MatchItem = {
  id: string;
  title: string;
  category: string;
  date?: number | null;
  homeBadge?: string | null;
  awayBadge?: string | null;
  homeName?: string | null;
  awayName?: string | null;
  status?: string;
  isLive?: boolean;
  popularity?: number;
};

export default function Sport() {
  const router = useRouter();

  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedTab, setSelectedTab] = useState<"Live" | "Popular" | "All">("Live");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  useEffect(() => {
    let mounted = true;

    const fetchMatches = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch("https://livesport.su/api/matches/live", {
          headers: { Accept: "application/json" },
        });

        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          throw new Error(`HTTP ${res.status}: ${txt.slice(0, 300)}`);
        }

        const data = await res.json();
        if (!mounted) return;

        const list: RawMatch[] = Array.isArray(data)
          ? data
          : Array.isArray(data.data)
          ? data.data
          : Array.isArray((data as any).matches)
          ? (data as any).matches
          : [];

        const parsed: MatchItem[] = list.map((m: RawMatch, idx) => {
          const home = m.teams?.home;
          const away = m.teams?.away;
          const dateNum =
            typeof m.date === "number"
              ? m.date
              : typeof m.date === "string"
              ? Number(m.date)
              : null;

          return {
            id: String(m.id ?? m.title ?? idx),
            title:
              m.title ??
              (home?.name && away?.name ? `${home.name} vs ${away.name}` : `Match ${idx + 1}`),
            category: (m.category ?? "Other").toString(),
            date: Number.isFinite(Number(dateNum)) ? (Number(dateNum) as number) : null,
            homeBadge: home?.badge ?? null,
            awayBadge: away?.badge ?? null,
            homeName: home?.name ?? null,
            awayName: away?.name ?? null,
            status: m.status ?? "",
            isLive: Boolean(m.is_live) || String(m.status ?? "").toLowerCase() === "live",
            popularity: m.views ?? m.importance ?? Math.round(Math.random() * 100),
          };
        });

        // keep a stable sort by date descending so "All" is meaningful by default
        parsed.sort((a, b) => (b.date ?? 0) - (a.date ?? 0));

        setMatches(parsed);
      } catch (err: any) {
        console.error("Fetch failed:", err);
        if (!mounted) return;
        setError(String(err?.message ?? err));
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    };

    fetchMatches();
    return () => {
      mounted = false;
    };
  }, []);

  const categories = useMemo(() => {
    const set = new Set<string>(matches.map((m) => m.category ?? "Other"));
    return ["All", ...Array.from(set)];
  }, [matches]);

  // safe copy + filtering
  const filteredMatches = useMemo(() => {
    // use a fresh copy so sorting/filtering isn't mutating shared arrays
    let filtered = matches.slice();

    if (selectedTab === "Live") {
      filtered = filtered.filter((m) => m.isLive);
    } else if (selectedTab === "Popular") {
      filtered = filtered.slice().sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));
    } else {
      // "All" - keep default ordering (by date desc from fetch)
      filtered = filtered.slice();
    }

    if (selectedCategory && selectedCategory !== "All") {
      filtered = filtered.filter((m) => m.category === selectedCategory);
    }

    return filtered;
  }, [matches, selectedTab, selectedCategory]);

  const formatDate = (d?: number | null) => {
    if (!d) return "";
    try {
      const dt = new Date(d);
      // nicer short format
      return dt.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  };

  const initialsPlaceholder = (title: string) => {
    const initials = title
      .split(/\s+/)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase() ?? "")
      .join("");
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='320' height='180'><rect width='100%' height='100%' fill='#111827'/><text x='50%' y='50%' font-family='Arial' font-size='48' fill='#9CA3AF' dominant-baseline='middle' text-anchor='middle'>${initials}</text></svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  };

  if (loading)
    return <div className="text-center mt-6 text-gray-400">Loading matches…</div>;
  if (error) return <div className="p-6 text-red-500">Error: {error}</div>;

  return (
    
    <div className="p-6 text-white max-w-6xl mx-auto">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Live Sports</h1>
          <p className="text-sm text-gray-400 mt-1">
            {matches.length} total • {matches.filter(m => m.isLive).length} live
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Tabs */}
          <div className="flex gap-2 bg-gray-800/40 rounded-full p-1">
            {(["Live", "Popular", "All"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setSelectedTab(tab)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium focus:outline-none ${
                  selectedTab === tab ? "bg-blue-600 text-white" : "text-gray-200/80"
                }`}
                aria-pressed={selectedTab === tab}
              >
                {tab}
                {tab === "Live" && (
                  <span className="ml-2 inline-block text-xs font-normal text-red-300">
                    {matches.filter((m) => m.isLive).length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Category select on mobile, chips on desktop */}
          <div className="hidden md:flex gap-2 overflow-auto px-1">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-full text-sm whitespace-nowrap ${
                  selectedCategory === cat ? "bg-blue-600 text-white" : "bg-gray-800/40 text-gray-200"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="md:hidden">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-gray-800/50 text-white p-2 rounded"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {/* Empty / No results */}
      {filteredMatches.length === 0 ? (
        <div className="p-8 bg-gray-800 rounded text-center text-gray-300">
          <p className="mb-2">No matches found for your selection.</p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => {
                setSelectedTab("All");
                setSelectedCategory("All");
              }}
              className="px-4 py-2 bg-blue-600 rounded"
            >
              Reset filters
            </button>
            <span className="text-sm text-gray-500">Try switching tabs or categories</span>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMatches.map((m) => {
            const imgSrc = m.homeBadge ?? m.awayBadge ?? initialsPlaceholder(m.title);
            return (
              <article
                key={m.id}
                onClick={() => router.push(`/Livesports/${encodeURIComponent(m.id)}`)}
                className="cursor-pointer rounded bg-gray-800 overflow-hidden hover:shadow-2xl transition-shadow focus-within:ring-2 focus-within:ring-blue-500"
              >
                <div className="relative w-full h-44 bg-gray-700 overflow-hidden flex items-center">
                  <img
                    src={imgSrc}
                    alt={`${m.title}`}
                    loading="lazy"
                    style={{ objectFit: "cover", width: "100%", height: "100%" }}
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = initialsPlaceholder(m.title);
                    }}
                  />
                  {m.isLive && (
                    <div className="absolute left-3 top-3 inline-flex items-center gap-2 bg-black/60 px-2 py-1 rounded text-xs font-semibold text-red-300">
                      <span className="animate-pulse">●</span> Live
                    </div>
                  )}
                  <div className="absolute right-3 top-3 bg-black/60 px-2 py-1 rounded text-xs text-gray-200">
                    {m.popularity ? `${Math.round(m.popularity)}★` : ""}
                  </div>
                </div>

                <div className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-sm line-clamp-2">{m.title}</h3>
                    <div className="text-xs text-gray-400">{m.category}</div>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
                    <div>{m.date ? formatDate(m.date) : "TBD"}</div>
                    <div className="text-right">
                      {m.homeName || m.awayName ? (
                        <div className="text-[13px] text-gray-300">
                          {m.homeName ?? "—"} <span className="text-gray-400">vs</span> {m.awayName ?? "—"}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
