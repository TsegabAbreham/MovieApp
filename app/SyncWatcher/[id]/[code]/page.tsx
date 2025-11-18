"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";

/**
 * SyncWatcher page.tsx
 *
 * Server expectations (minimal):
 * - Accepts join: { type: "join", room, clientId, username }
 * - Sends presence: { type: "presence", participants: [{clientId, username}], hostId }
 * - Sends user-joined / user-left messages when people join/leave
 * - Forwards start messages: { type: "start", startAt, clientId, season?, episode? }
 * - Broadcasts host messages: { type: "host", isHost: boolean }
 */

type Participant = { clientId: string; username: string };
type WSMsg = { type: string; [k: string]: any };

export default function SyncWatcherPage() {
  const { id, code } = useParams() as { id: string; code: string };

  // refs
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const clientIdRef = useRef<string>(Math.random().toString(36).slice(2, 9));
  const startTimerRef = useRef<number | null>(null);

  // local UI state
  const [username, setUsername] = useState<string | null>(null);
  const [showUsernamePrompt, setShowUsernamePrompt] = useState(false);

  const [connected, setConnected] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);

  // title / tv info
  const [title, setTitle] = useState<string>("Loading…");
  const [isTv, setIsTv] = useState(false);
  const [year, setYear] = useState<number | null>(null);
  const [poster, setPoster] = useState<string | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [plot, setPlot] = useState<string | null>(null);
  const [seasons, setSeasons] = useState<{ season: string; episodeCount: number }[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<string | null>(null);
  const [episodes, setEpisodes] = useState<{ id: string; title: string; episodeNumber: number }[]>([]);
  const [selectedEpisode, setSelectedEpisode] = useState<number | null>(null);
  const [tvLoading, setTvLoading] = useState(false);

  // countdown
  const [countdown, setCountdown] = useState<number | null>(null);

  // simple JSON parse helper
  const safeParse = (s: any) => {
    try { return JSON.parse(s); } catch { return null; }
  };

  // prompt username once
  useEffect(() => {
    if (!username) setShowUsernamePrompt(true);
  }, [username]);

  // fetch title info once
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`https://api.imdbapi.dev/titles/${encodeURIComponent(id)}`);
        if (!res.ok) throw new Error("Title not found");
        const data = await res.json();
        if (cancelled) return;

        const t = data.primaryTitle || data.originalTitle || data.title || "Untitled";
        const y = Number(data.startYear || data.year || 0) || null;
        const p = data.primaryImage?.url ?? null;
        const r = Number(data.rating?.aggregateRating ?? 0) || null;
        const pl = data.plot ?? null;
        setTitle(t);
        setYear(y);
        setPoster(p);
        setRating(r);
        setPlot(pl);

        const titleType = String(data.titleType || data.type || "").toLowerCase();
        const isTvLike = titleType.includes("tv") || data.titleType === "tvSeries" || data.type === "tvSeries";
        setIsTv(Boolean(isTvLike));

        if (isTvLike) {
          try {
            setTvLoading(true);
            const sres = await fetch(`https://api.imdbapi.dev/titles/${encodeURIComponent(id)}/seasons`);
            if (sres.ok) {
              const sjson = await sres.json();
              const sarr = Array.isArray(sjson.seasons) ? sjson.seasons : [];
              const mapped = sarr.map((s: any) => ({ season: String(s.season), episodeCount: s.episodeCount || 0 }));
              setSeasons(mapped);
              if (mapped.length > 0) setSelectedSeason(mapped[0].season);
            }
          } catch (e) {
            console.error("Failed to fetch seasons", e);
          } finally {
            setTvLoading(false);
          }
        }
      } catch (e) {
        console.error("Title fetch failed", e);
        setTitle("Unknown");
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  // fetch episodes when selectedSeason changes (only for TV)
  useEffect(() => {
    if (!isTv || !id || !selectedSeason) return;
    let cancelled = false;
    (async () => {
      setTvLoading(true);
      try {
        const res = await fetch(`https://api.imdbapi.dev/titles/${encodeURIComponent(id)}/episodes?season=${encodeURIComponent(selectedSeason)}&pageSize=200`);
        if (!res.ok) throw new Error("Episodes fetch failed");
        const json = await res.json();
        let arr: any[] = [];
        if (Array.isArray(json.episodes)) arr = json.episodes;
        else if (Array.isArray(json)) arr = json;
        else {
          const found = Object.values(json).find(v => Array.isArray(v));
          if (Array.isArray(found)) arr = found as any[];
        }
        const eps = (arr || []).map((e: any, idx: number) => ({
          id: e.id || `${selectedSeason}-${idx}`,
          title: e.title || `Episode ${e.episodeNumber || idx + 1}`,
          episodeNumber: Number(e.episodeNumber ?? e.epNumber ?? idx + 1),
        })).sort((a,b) => a.episodeNumber - b.episodeNumber);
        if (!cancelled) {
          setEpisodes(eps);
          setSelectedEpisode(eps[0]?.episodeNumber ?? null);
        }
      } catch (e) {
        console.error("Episodes error", e);
        setEpisodes([]);
      } finally {
        setTvLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, selectedSeason, isTv]);

  // --- WebSocket connect (only depends on room code + username) ---
  useEffect(() => {
    if (!code) return;
    if (!username) return;

    // avoid double connections
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      console.log("[sync] ws already open, skipping reconnect");
      return;
    }

    const WS_URL = process.env.NEXT_PUBLIC_SYNC_WS || "ws://localhost:8080";
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;
    // expose for debugging
    // @ts-ignore
    window.__syncWs = ws;

    console.log("[sync] connecting to", WS_URL, "room", code, "clientId", clientIdRef.current);

    let didSendJoin = false;

    ws.onopen = () => {
      console.log("[sync] ws open");
      setConnected(true);
      if (!didSendJoin) {
        const joinMsg = { type: "join", room: code, clientId: clientIdRef.current, username };
        try {
          ws.send(JSON.stringify(joinMsg));
          didSendJoin = true;
          console.log("[sync] sent join", joinMsg);
        } catch (e) {
          console.error("[sync] send join failed", e);
        }
      }
    };

    ws.onmessage = (ev) => {
      const data = safeParse(ev.data) as WSMsg | null;
      if (!data || !data.type) return;
      // presence (full state)
      if (data.type === "presence" && Array.isArray((data as any).participants)) {
        setParticipants(((data as any).participants as Participant[]).slice());
        if ((data as any).hostId) setIsHost((data as any).hostId === clientIdRef.current);
        return;
      }
      // user-joined
      if (data.type === "user-joined") {
        setParticipants(prev => {
          if (prev.find(p => p.clientId === (data as any).clientId)) return prev;
          return [...prev, { clientId: (data as any).clientId, username: (data as any).username }];
        });
        return;
      }
      // user-left
      if (data.type === "user-left") {
        setParticipants(prev => prev.filter(p => p.clientId !== (data as any).clientId));
        return;
      }
      // host assignment
      if (data.type === "host") {
        setIsHost(Boolean((data as any).isHost));
        return;
      }
      // start: schedule countdown + set episode/season (if tv)
      if (data.type === "start") {
        const startAt = Number((data as any).startAt || 0);
        if (isNaN(startAt) || startAt <= 0) return;
        // if tv, update selected season/episode (non-host)
        if (isTv && (data as any).season) {
          setSelectedSeason(String((data as any).season));
          setSelectedEpisode(Number((data as any).episode ?? selectedEpisode));
        }
        // schedule countdown
        const tickFn = () => {
          const left = Math.max(0, Math.ceil((startAt - Date.now()) / 1000));
          setCountdown(left);
          if (left <= 0) {
            // reload iframe with autoPlay=true
            const iframe = iframeRef.current;
            if (iframe) {
              const base = isTv
                ? `https://vidsrc.cc/v2/embed/tv/${id}/${(data as any).season ?? selectedSeason}/${(data as any).episode ?? selectedEpisode}`
                : `https://vidsrc.cc/v2/embed/movie/${id}`;
              const newSrc = `${base}?autoPlay=true&_sync=${Date.now()}`;
              iframe.src = "about:blank";
              setTimeout(() => { iframe.src = newSrc; }, 50);
            }
            setCountdown(null);
            if (startTimerRef.current) {
              window.clearInterval(startTimerRef.current);
              startTimerRef.current = null;
            }
          }
        };
        // clear previous timer
        if (startTimerRef.current) {
          window.clearInterval(startTimerRef.current);
          startTimerRef.current = null;
        }
        tickFn();
        startTimerRef.current = window.setInterval(tickFn, 500);
        return;
      }
      // legacy reload message -> just reload with autoPlay
      if (data.type === "reload") {
        const iframe = iframeRef.current;
        if (!iframe) return;
        const base = isTv
          ? `https://vidsrc.cc/v2/embed/tv/${id}/${selectedSeason}/${selectedEpisode}`
          : `https://vidsrc.cc/v2/embed/movie/${id}`;
        const newSrc = `${base}?autoPlay=true&_sync=${Date.now()}`;
        iframe.src = "about:blank";
        setTimeout(() => { iframe.src = newSrc; }, 50);
        return;
      }

      // other messages (play/pause/seek) forwarded to iframe (may be ignored by vidsrc)
      if (["play", "pause", "seek"].includes(data.type)) {
        const win = iframeRef.current?.contentWindow;
        if (!win) return;
        win.postMessage({ type: "VIDEO_COMMAND", command: data.type, time: (data as any).time ?? 0 }, "*");
      }
    };

    ws.onclose = () => {
      console.log("[sync] ws closed");
      setConnected(false);
      setIsHost(false);
      // clear presence locally (server will send presence later when others join/leave)
      // do not auto reconnect aggressively; effect will reconnect if code/username stable and socketRef cleared
      if (wsRef.current === ws) wsRef.current = null;
    };

    ws.onerror = (err) => {
      console.error("[sync] ws error", err);
      setConnected(false);
    };

    // cleanup
    return () => {
      try {
        if (wsRef.current === ws) {
          if (ws.readyState === WebSocket.OPEN) ws.close();
          wsRef.current = null;
        }
      } catch (_) {}
      // @ts-ignore
      window.__syncWs = null;
    };
  }, [code, username]); // <= only recreate on code or username change

  // request presence helper
  const requestPresence = () => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: "presence:get", room: code, clientId: clientIdRef.current }));
  };

  // Host triggers a start: send 'start' message with startAt and optional tv info
  const hostStart = (countdownSeconds = 5) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const startAt = Date.now() + Math.max(1, countdownSeconds) * 1000;
    const msg: any = { type: "start", startAt, clientId: clientIdRef.current, room: code };
    if (isTv) {
      msg.season = selectedSeason;
      msg.episode = selectedEpisode;
    }
    ws.send(JSON.stringify(msg));
    // local immediate handling (optimistic) — server should broadcast back but handle locally for snappy UX
    const synthetic = { ...msg };
    // reuse onmessage handling by simply calling the effect logic manually:
    // We'll fake receiving it by directly handling the same logic used for start:
    const startAtMs = startAt;
    if (startTimerRef.current) { window.clearInterval(startTimerRef.current); startTimerRef.current = null; }
    const tickFn = () => {
      const left = Math.max(0, Math.ceil((startAtMs - Date.now()) / 1000));
      setCountdown(left);
      if (left <= 0) {
        const iframe = iframeRef.current;
        if (!iframe) return;
        const base = isTv
          ? `https://vidsrc.cc/v2/embed/tv/${id}/${msg.season ?? selectedSeason}/${msg.episode ?? selectedEpisode}`
          : `https://vidsrc.cc/v2/embed/movie/${id}`;
        const newSrc = `${base}?autoPlay=true&_sync=${Date.now()}`;
        iframe.src = "about:blank";
        setTimeout(() => { iframe.src = newSrc; }, 50);
        setCountdown(null);
        if (startTimerRef.current) { window.clearInterval(startTimerRef.current); startTimerRef.current = null; }
      }
    };
    tickFn();
    startTimerRef.current = window.setInterval(tickFn, 500);
  };

  // UI: username prompt
  const UsernamePrompt = () => {
    const [val, setVal] = useState("");
    const submit = () => {
      const v = (val || "").trim() || "Anon";
      setUsername(v);
      setShowUsernamePrompt(false);
    };
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
        <div className="bg-white dark:bg-gray-800 rounded p-6 w-96">
          <h3 className="text-lg font-semibold mb-2">Enter a username</h3>
          <input value={val} onChange={(e) => setVal(e.target.value)} className="w-full p-2 rounded border" placeholder="Your name" />
          <div className="flex gap-2 mt-4 justify-end">
            <button onClick={() => { setUsername("Anon"); setShowUsernamePrompt(false); }} className="px-3 py-1 rounded bg-gray-200">Skip</button>
            <button onClick={submit} className="px-3 py-1 rounded bg-blue-600 text-white">Join</button>
          </div>
        </div>
      </div>
    );
  };

  // UI: participants list
  const ParticipantsPanel = () => (
    <div className="bg-gray-800 rounded p-3">
      <h4 className="text-sm font-semibold mb-2">People ({participants.length})</h4>
      <ul className="space-y-2 text-sm">
        {participants.map(p => (
          <li key={p.clientId} className="flex items-center justify-between">
            <span>{p.username}{p.clientId === clientIdRef.current ? " (you)" : ""}</span>
            {p.clientId === clientIdRef.current && <span className="px-2 py-0.5 text-xs bg-gray-600 rounded">You</span>}
            {isHost && p.clientId === clientIdRef.current && <span className="px-2 py-0.5 text-xs bg-green-700 rounded ml-2">Host</span>}
          </li>
        ))}
      </ul>
    </div>
  );

  const TvControls = () => (
    <div className="bg-gray-800 rounded p-3 space-y-2">
      <h4 className="text-sm font-semibold">Episode controls (host)</h4>
      <div>
        <label className="text-xs">Season</label>
        <select value={selectedSeason ?? ""} onChange={(e) => setSelectedSeason(e.target.value)} className="w-full mt-1 p-2 rounded bg-gray-700">
          {seasons.map(s => <option key={s.season} value={s.season}>Season {s.season} ({s.episodeCount})</option>)}
        </select>
      </div>
      <div>
        <label className="text-xs">Episode</label>
        <select value={selectedEpisode ?? ""} onChange={(e) => setSelectedEpisode(Number(e.target.value))} className="w-full mt-1 p-2 rounded bg-gray-700">
          {episodes.map(ep => <option key={ep.id} value={ep.episodeNumber}>E{ep.episodeNumber} — {ep.title}</option>)}
        </select>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-900 text-white px-4 md:px-6 py-8 pt-20">
      {showUsernamePrompt && <UsernamePrompt />}

      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4">
          <div className="bg-gray-800 rounded p-4">
            <div className="flex items-start gap-4">
              {poster && <img src={poster} alt={title} className="w-20 h-28 object-cover rounded hidden md:block" />}
              <div>
                <h1 className="text-2xl font-bold">{title} {year ? `(${year})` : ""}</h1>
                <div className="text-sm text-gray-300">Rating: {rating ? `★ ${rating.toFixed(1)}` : "N/A"}</div>
                <div className="text-xs text-gray-400 mt-2">{plot}</div>
              </div>
            </div>
          </div>

          <div className="bg-black rounded overflow-hidden">
            <iframe
              ref={iframeRef}
              src={isTv && selectedSeason && selectedEpisode
                ? `https://vidsrc.cc/v2/embed/tv/${id}/${selectedSeason}/${selectedEpisode}?autoPlay=false`
                : `https://vidsrc.cc/v2/embed/movie/${id}?autoPlay=false`
              }
              style={{ width: "100%", height: 520 }}
              sandbox="allow-scripts allow-same-origin allow-forms allow-pointer-lock allow-presentation allow-popups"
              allow="autoplay; fullscreen; picture-in-picture"
              title={`SyncWatcher ${title}`}
            />
          </div>

          <div className="flex items-center gap-4">
            <div>WebSocket: <span className="font-semibold">{connected ? "Connected" : "Disconnected"}</span></div>
            <div>Role: <span className="font-semibold">{isHost ? "Host" : "Participant"}</span></div>
            {countdown != null && <div className="ml-auto text-lg font-bold">Starting in {countdown}s</div>}
          </div>
        </div>

        <aside className="space-y-4">
          <ParticipantsPanel />

          {isTv ? (
            isHost ? <TvControls /> : (
              <div className="bg-gray-800 rounded p-3">
                <h4 className="text-sm font-semibold">Episode (host controlled)</h4>
                <div className="text-sm mt-2">Season: {selectedSeason ?? "-"}</div>
                <div className="text-sm">Episode: {selectedEpisode ?? "-"}</div>
              </div>
            )
          ) : (
            <div className="bg-gray-800 rounded p-3">
              <h4 className="text-sm font-semibold">Movie</h4>
              <div className="text-sm mt-2">Single video</div>
            </div>
          )}

          <div className="bg-gray-800 rounded p-3">
            <h4 className="text-sm font-semibold">Controls</h4>
            {isHost ? (
              <>
                <div className="mt-2">
                  <label className="text-xs">Countdown seconds</label>
                  <input type="number" defaultValue={5} id="startSec" className="w-full mt-1 p-2 rounded bg-gray-700" />
                </div>
                <button
                  onClick={() => {
                    const el = document.getElementById("startSec") as HTMLInputElement|null;
                    const secs = el ? Math.max(1, Number(el.value) || 5) : 5;
                    hostStart(secs);
                  }}
                  className="mt-3 w-full px-3 py-2 bg-blue-600 rounded hover:bg-blue-700"
                >
                  Start Video (host)
                </button>
              </>
            ) : (
              <div className="text-sm text-gray-400 mt-2">Only the host can change episode / start the video.</div>
            )}

            <div className="mt-3">
              <button onClick={requestPresence} className="px-3 py-2 bg-gray-700 rounded w-full">Refresh participants</button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
