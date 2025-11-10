// app/Livesports/[id]/page.tsx
import React from "react";
import Link from "next/link";
import Navigation from "../../Navigation";
import { notFound } from "next/navigation";

type Stream = {
  id: string;
  streamNo: number;
  language: string;
  hd: boolean;
  embedUrl: string;
  source: string;
  viewers?: number; // <-- add this
};

type MatchDetail = {
  id: string;
  title?: string;
  teams?: {
    home?: { name?: string; badge?: string };
    away?: { name?: string; badge?: string };
  };
  sources?: Stream[];
};

type ApiWrapper = {
  data?: MatchDetail;
  success?: boolean;
};

export default async function Page({
  params,
  searchParams,
}: {
  params: any;
  searchParams?: any;
}) {
  const resolvedParams = await Promise.resolve(params);
  const resolvedSearch = await Promise.resolve(searchParams);
  const id: string = String(resolvedParams?.id ?? "");
  const requestedStream: string =
    Array.isArray(resolvedSearch?.stream) ? String(resolvedSearch.stream[0]) : (resolvedSearch?.stream as string | undefined) ?? "";

  if (!id) notFound();

  // Fetch match detail
  let detail: MatchDetail | null = null;
  try {
    const res = await fetch(
      `https://livesport.su/api/matches/${encodeURIComponent(id)}/detail`,
      { cache: "no-store" }
    );

    if (res.status === 404) {
      notFound();
    }

    const json: ApiWrapper | any = await res.json().catch(() => ({}));

    if (json && json.data) {
      detail = json.data as MatchDetail;
    } else if (json && (json as MatchDetail).sources) {
      detail = json as MatchDetail;
    } else {
      if (!res.ok) console.error("Livesport detail fetch failed with", res.status);
      else console.warn("Unexpected Livesport response shape:", json);
    }
  } catch (err) {
    console.error("Error fetching match detail:", err);
  }

  const streams: Stream[] = detail?.sources ?? [];
  const selectedStream =
    streams.find((s) => s.id === requestedStream || String(s.streamNo) === requestedStream) ?? streams[0] ?? null;

  return (
    <>
      <Navigation />

      <div className="min-h-screen bg-gray-900 text-white px-4 md:px-6 py-8 pt-24">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row gap-6">
            {/* Left: Video area (no bottom detail) */}
            <div className="flex-1">
              <div className="w-full bg-black rounded overflow-hidden">
                {selectedStream?.embedUrl ? (
                  <iframe
                    src={selectedStream.embedUrl}
                    title={detail?.title ?? `Live ${id}`}
                    style={{ width: "100%", height: "520px", border: 0 }}
                    allow="autoplay; fullscreen; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <div className="p-6 text-center text-gray-300">
                    No embeddable stream available for this match.
                  </div>
                )}
              </div>
            </div>

            {/* Right: Sidebar (poster / teams / stream selector) */}
            <aside className="w-full md:w-80 flex-shrink-0">
              <div className="bg-gray-800 rounded p-3 flex flex-col">
                <div className="flex flex-col items-center mb-3">
                  {/* Team badges / simple poster area */}
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-16 bg-gray-700 rounded overflow-hidden flex items-center justify-center">
                      {detail?.teams?.home?.badge ? (
                        <img src={detail.teams.home!.badge} alt={detail.teams.home?.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-xs text-gray-400 px-2 text-center">Home</div>
                      )}
                    </div>

                    <div className="text-center">
                      <div className="text-sm font-semibold">{detail?.teams?.home?.name ?? "Home"}</div>
                      <div className="text-xs text-gray-400">vs</div>
                      <div className="text-sm font-semibold">{detail?.teams?.away?.name ?? "Away"}</div>
                    </div>

                    <div className="w-16 h-16 bg-gray-700 rounded overflow-hidden flex items-center justify-center">
                      {detail?.teams?.away?.badge ? (
                        <img src={detail.teams.away!.badge} alt={detail.teams.away?.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-xs text-gray-400 px-2 text-center">Away</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Stream selector */}
                <div className="mb-3">
                  <h4 className="text-sm font-semibold mb-2">Streams</h4>
                  {streams.length === 0 ? (
                    <p className="text-sm text-gray-400">No streams available.</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {streams.map((s) => (
                        <Link
                          key={s.id}
                          href={`/Livesports/${encodeURIComponent(id)}?stream=${encodeURIComponent(s.id)}`}
                          className={`px-3 py-2 rounded text-sm text-left ${
                            selectedStream?.id === s.id ? "bg-blue-600" : "bg-gray-700 hover:bg-gray-700/90"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium">{s.language ?? s.source}</div>
                              <div className="text-xs text-gray-400">{s.hd ? "HD" : "SD"} • Stream #{s.streamNo}</div>
                            </div>
                            <div className="text-xs text-gray-300">{s.viewers ?? ""}</div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            </aside>
          </div>
        </div>
      </div>
    </>
  );
}
