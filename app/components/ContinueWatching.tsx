"use client";

import React from "react";
import Link from "next/link";
import OptimizedImg from "./OptimizedImg";
import { useActiveProfile, removeContinueWatchingEntry } from "../page";

export default function ContinueWatching() {
  const profile = useActiveProfile();
  const items = (profile && profile.continueWatching) || [];
  if (!profile || items.length === 0) return null;

  const placeholder = "/placeholder-poster.png";

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xl font-semibold">Continue watching</h3>
        <div className="text-sm text-gray-400">Saved to {profile.name}</div>
      </div>

      <div className="flex gap-4 overflow-x-auto py-2 scrollbar-hide">
        {items.map((it: any) => {
          const key = `${it.kind}:${it.mediaId}:${it.season ?? ""}:${it.episode ?? ""}`;
          let href = "/";
          if (it.kind === "movie") href = `/Movies/${it.mediaId}?autoPlay=true`;
          else if (it.kind === "tv") href = `/TV/${it.mediaId}?season=${encodeURIComponent(it.season ?? "1")}&ep=${encodeURIComponent(it.episode ?? "1")}&autoPlay=true`;
          else if (it.kind === "anime") href = `/Anime/${it.mediaId}?ep=${encodeURIComponent(it.episode ?? "1")}&autoPlay=true`;

          return (
            <div key={key} className="min-w-[180px] bg-gray-800 rounded overflow-hidden shadow-lg flex-shrink-0">
              <div className="relative w-[180px] h-[260px] bg-gray-700">
                <OptimizedImg src={it.poster || placeholder} alt={it.title} className="w-full h-full object-cover" />
                <button
                  onClick={() => removeContinueWatchingEntry({ kind: it.kind, mediaId: it.mediaId, season: it.season, episode: it.episode })}
                  className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 p-1 rounded text-white text-xs"
                  aria-label="Remove from continue watching"
                >
                  ✖
                </button>
              </div>
              <div className="p-3">
                <div className="font-medium truncate">{it.title}</div>
                <div className="text-xs text-gray-400 mt-1 truncate">{it.kind === "movie" ? "Movie" : it.kind === "tv" ? `S${it.season} • Ep ${it.episode}` : `Ep ${it.episode}`}</div>
                <div className="mt-3 flex gap-2">
                  <Link href={href} className="flex-1 text-center bg-blue-600 hover:bg-blue-500 text-white py-2 rounded text-sm">Resume</Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
