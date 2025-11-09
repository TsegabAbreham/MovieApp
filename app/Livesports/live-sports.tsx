"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Team = {
  name?: string;
  badge?: string;
};

type RawMatch = {
  id?: string;
  title?: string;
  category?: string;
  date?: number | string;
  status?: string;
  is_live?: boolean;
  views?: number;
  importance?: number;
  teams?: {
    home?: Team;
    away?: Team;
  };
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
  const [selectedCategory, setSelectedCategory] = useState<string | "All">("All");

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
              (home?.name && away?.name
                ? `${home.name} vs ${away.name}`
                : `Match ${idx + 1}`),
            category: (m.category ?? "Other").toString(),
            date: Number.isFinite(dateNum) ? (dateNum as number) : null,
            homeBadge: home?.badge ?? null,
            awayBadge: away?.badge ?? null,
            homeName: home?.name ?? null,
            awayName: away?.name ?? null,
            status: m.status ?? "",
            isLive: m.is_live ?? m.status?.toLowerCase() === "live",
            popularity: m.views ?? m.importance ?? Math.random() * 100,
          };
        });

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
    const set = new Set<string>(matches.map((m) => m.category));
    return ["All", ...Array.from(set)];
  }, [matches]);

  // Filter matches based on top tab and category
  const filteredMatches = useMemo(() => {
    let filtered = [...matches];

    if (selectedTab === "Live") {
      filtered = filtered.filter((m) => m.isLive);
    } else if (selectedTab === "Popular") {
      filtered = filtered.sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));
    }

    if (selectedCategory !== "All") {
      filtered = filtered.filter((m) => m.category === selectedCategory);
    }

    return filtered;
  }, [matches, selectedTab, selectedCategory]);

  const formatDate = (d?: number | null) => {
    if (!d) return "";
    try {
      const dt = new Date(d);
      return dt.toLocaleString();
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
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='320' height='180'><rect width='100%' height='100%' fill='#1f2937'/><text x='50%' y='50%' font-family='Arial' font-size='48' fill='#9CA3AF' dominant-baseline='middle' text-anchor='middle'>${initials}</text></svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  };

  if (loading) return <div className="text-center mt-6 text-gray-400">Loading matches…</div>;
  if (error) return <div className="p-6 text-red-500">Error: {error}</div>;

  return (
    <div className="p-6 text-white">
      <h1 className="text-2xl font-bold mb-4">Live Sports</h1>

      {/* Tabs: Live / Popular / All */}
      <div className="flex gap-3 mb-6">
        {["Live", "Popular", "All"].map((tab) => (
          <button
            key={tab}
            onClick={() => setSelectedTab(tab as any)}
            className={`px-4 py-1.5 rounded-full ${
              selectedTab === tab ? "bg-blue-600" : "bg-gray-700"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Category bar */}
      <nav className="mb-6 flex gap-3 overflow-auto">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1 rounded-full whitespace-nowrap ${
              selectedCategory === cat ? "bg-blue-600" : "bg-gray-800/40"
            }`}
          >
            {cat}
          </button>
        ))}
      </nav>

      {/* Matches Grid */}
      {filteredMatches.length === 0 ? (
        <div className="text-gray-400">No matches found.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMatches.map((m) => {
            const imgSrc = m.homeBadge ?? m.awayBadge ?? initialsPlaceholder(m.title);
            return (
              <article
                key={m.id}
                onClick={() => router.push(`/sport/${encodeURIComponent(m.id)}`)}
                className="cursor-pointer rounded bg-gray-800 overflow-hidden hover:shadow-lg transition-shadow"
              >
                <div className="w-full h-44 bg-gray-700 overflow-hidden flex items-center justify-center">
                  <img
                    src={imgSrc}
                    alt={`${m.title}`}
                    loading="lazy"
                    style={{ objectFit: "cover", width: "100%", height: "100%" }}
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = initialsPlaceholder(m.title);
                    }}
                  />
                </div>
                <div className="p-3">
                  <div className="font-semibold flex justify-between">
                    <span>{m.title}</span>
                    {m.isLive ? (
                      <span className="text-red-500 text-xs ml-2">● Live</span>
                    ) : null}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">{m.category}</div>
                  {m.date && (
                    <div className="text-xs text-gray-500 mt-1">{formatDate(m.date)}</div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
