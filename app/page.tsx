"use client";

import React, { useEffect, useState, useSyncExternalStore, useRef } from "react";
import Link from "next/link";
import { useRemoteNav } from "./hooks/useRemoteNav";

// Simple local storage keys
const LS_PROFILES = "tamovies_profiles_v1";
const LS_ACTIVE_ID = "tamovies_active_profile_id_v1";

// Rating -> minimum age
const RATING_MIN_AGE: { [k: string]: number } = {
  G: 0,
  PG: 8,
  "PG-13": 13,
  "TV-14": 14,
  "16+": 16,
  R: 17,
  "TV-MA": 17,
};
const ALL_RATINGS = Object.keys(RATING_MIN_AGE);

export function ratingToAge(cert?: string | null): number {
  if (!cert) return 0; // null, undefined, empty → treat as unrestricted

  switch (cert.toUpperCase()) {
    case "TV-Y": return 0;
    case "TV-Y7": return 7;
    case "TV-G": return 0;
    case "TV-PG": return 10;
    case "TV-14": return 14;
    case "TV-MA": return 17;
    case "G": return 0;
    case "PG": return 10;
    case "PG-13": return 13;
    case "R": return 17;
    case "NC-17": return 18;
    case "NR": return 17;
    default: return 0;
  }
}


function calculateAge(birthISO: string) {
  if (!birthISO) return 0;
  const birth = new Date(birthISO);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function allowedRatingsForAge(age: number) {
  return ALL_RATINGS.filter((r) => age >= RATING_MIN_AGE[r]);
}

// ---------- Lightweight global store (no external libs) ----------
const Store = (() => {
  let subscribers = new Set<() => void>();
  // cached active profile snapshot (keeps reference stable between calls)
  let current: any = null;

  // initialize cache from localStorage when running in browser
  if (typeof window !== "undefined") {
    try {
      const profilesJson = localStorage.getItem(LS_PROFILES);
      const profiles = profilesJson ? JSON.parse(profilesJson) : [];
      const activeId = localStorage.getItem(LS_ACTIVE_ID);
      current = profiles.find((p: any) => p.id === activeId) ?? null;
    } catch (e) {
      current = null;
    }
  }

  function notify() {
    subscribers.forEach((s) => s());
  }

  function subscribe(fn: () => void) {
    subscribers.add(fn);
    return () => subscribers.delete(fn);
  }

  function getSnapshot() {
    // return the cached object reference (React expects stable identity when nothing changed)
    return current;
  }

  function setActiveId(id: string | null) {
    if (id === null) {
      localStorage.removeItem(LS_ACTIVE_ID);
      current = null;
    } else {
      localStorage.setItem(LS_ACTIVE_ID, id);
      try {
        const profiles = JSON.parse(localStorage.getItem(LS_PROFILES) || "[]");
        current = profiles.find((p: any) => p.id === id) ?? null;
      } catch (e) {
        current = null;
      }
    }
    notify();
  }

  function refreshFromStorage() {
    try {
      const profiles = JSON.parse(localStorage.getItem(LS_PROFILES) || "[]");
      const activeId = localStorage.getItem(LS_ACTIVE_ID);
      const newCurrent = profiles.find((p: any) => p.id === activeId) ?? null;
      // only update and notify when the active id changed (keeps identity stable otherwise)
      if ((current && current.id) !== (newCurrent && newCurrent.id)) {
        current = newCurrent;
        notify();
      } else {
        current = newCurrent;
      }
    } catch (e) {
      current = null;
      notify();
    }
  }

  return { subscribe, getSnapshot, setActiveId, refreshFromStorage };
})();

export function useActiveProfile() {
  const snapshot = useSyncExternalStore(Store.subscribe, Store.getSnapshot, () => null);
  return snapshot;
}

export function getActiveProfile() {
  return Store.getSnapshot();
}

export function setActiveProfileId(id: string | null) {
  Store.setActiveId(id);
}

// ---------- Helper functions to manage profiles in localStorage ----------
function readProfiles() {
  try {
    const raw = localStorage.getItem(LS_PROFILES);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function writeProfiles(profiles: any[]) {
  localStorage.setItem(LS_PROFILES, JSON.stringify(profiles));
}

export function createProfile({ name, birthdate }: { name: string; birthdate: string }) {
  const id = String(Date.now());
  const age = calculateAge(birthdate);
  const allowed = allowedRatingsForAge(age);
  const p = { id, name, birthdate, age, allowedRatings: allowed };
  const profiles = readProfiles();
  profiles.push(p);
  writeProfiles(profiles);
  // set as active and notify subscribers
  Store.setActiveId(p.id);
  return p;
}

export function deleteProfileById(id: string) {
  const profiles = readProfiles().filter((p: any) => p.id !== id);
  writeProfiles(profiles);
  const active = localStorage.getItem(LS_ACTIVE_ID);
  if (active === id) {
    localStorage.removeItem(LS_ACTIVE_ID);
    // update store
    Store.setActiveId(null);
  } else {
    // refresh cached snapshot in case profiles changed
    Store.refreshFromStorage();
  }
}

// ---------- Main component (profile selection UI) ----------
export default function ProfileSelectionPage() {
  const [profiles, setProfiles] = useState(() => {
    if (typeof window === "undefined") return [];
    return readProfiles();
  });
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(LS_ACTIVE_ID);
  });

  const activeProfile = useActiveProfile();

  // modal state
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [error, setError] = useState("");

  // ref for remote navigation (TV / remote-control support)
  const navRef = useRef<HTMLDivElement | null>(null);

  // initialize remote nav hook — selector includes the profile tiles and interactive controls
  useRemoteNav(navRef, {
    selector: ".profile-tile, .add-profile, button, a, [data-navbar-right-item]",
    focusClass: "tv-nav-item",
    loop: true,
    autoScroll: true,
  });

  useEffect(() => {
    const handler = () => setProfiles(readProfiles());
    // also listen to storage events from other tabs
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  function refreshProfiles() {
    setProfiles(readProfiles());
    setSelectedId(localStorage.getItem(LS_ACTIVE_ID));
  }

  function handleCreate() {
    setError("");
    if (!name.trim()) return setError("Enter a name");
    if (!birthdate) return setError("Choose birthdate");
    const p = createProfile({ name: name.trim(), birthdate });
    writeProfiles(readProfiles());
    setName("");
    setBirthdate("");
    setShowModal(false);
    refreshProfiles();
    // auto-select newly created profile
    localStorage.setItem(LS_ACTIVE_ID, p.id);
    Store.setActiveId(p.id);
    setSelectedId(p.id);
  }

  function handleSelect(id: string) {
    localStorage.setItem(LS_ACTIVE_ID, id);
    Store.setActiveId(id);
    setSelectedId(id);
  }

  function handleDelete(id: string) {
    if (!confirm("Delete this profile?")) return;
    deleteProfileById(id);
    refreshProfiles();
  }

  return (
    <main ref={navRef} className="min-h-screen bg-black text-white px-6 py-12 flex items-center justify-center">
      <div className="max-w-5xl w-full">
        <h1 className="text-4xl font-extrabold mb-6">Who's watching?</h1>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
          {profiles.length === 0 && (
            <div className="col-span-full text-gray-400">No profiles yet — create one to get started.</div>
          )}

          {profiles.map((p: any) => (
            <div
              key={p.id}
              tabIndex={0}
              onClick={() => handleSelect(p.id)}
              className={`profile-tile group cursor-pointer select-none p-4 rounded-lg bg-gray-900 hover:scale-105 transform transition shadow-lg relative flex flex-col items-center gap-3 outline-none ring-0 focus:ring-2 focus:ring-indigo-500 ${selectedId === p.id ? "ring-4 ring-indigo-600" : ""}`}>

              <div className="w-28 h-28 rounded-full bg-gray-700 flex items-center justify-center text-2xl font-semibold">
                {p.name.split(" ").map((s: string) => s[0]).slice(0,2).join("")}
              </div>

              <div className="text-center">
                <div className="font-medium">{p.name}</div>
                <div className="text-xs text-gray-400">Age {p.age}</div>
              </div>

              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }}
                aria-label="Delete profile"
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition bg-gray-800 p-1 rounded">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H3a1 1 0 100 2h14a1 1 0 100-2h-2V3a1 1 0 00-1-1H6zm2 6a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 10-2 0v6a1 1 0 102 0V8z" clipRule="evenodd" />
                </svg>
              </button>

            </div>
          ))}

          {/* Add profile tile */}
          <div
            onClick={() => setShowModal(true)}
            tabIndex={0}
            className="add-profile cursor-pointer p-4 rounded-lg bg-gray-900 hover:scale-105 transform transition shadow-lg flex flex-col items-center gap-3 justify-center">
            <div className="w-28 h-28 rounded-full border-2 border-dashed border-gray-600 flex items-center justify-center text-3xl">+</div>
            <div className="text-center">Add Profile</div>
          </div>
        </div>

        <div className="mt-8 flex items-center gap-4">
          <button
            onClick={() => { setSelectedId(null); setActiveProfileId(null); }}
            className="px-4 py-2 rounded bg-gray-800 hover:bg-gray-700">Sign out / Clear selection</button>

          <Link href="/Movies" className={`px-4 py-2 rounded font-semibold ${selectedId ? "bg-indigo-600 hover:bg-indigo-500" : "bg-gray-700 text-gray-400 cursor-not-allowed"}`} onClick={(e) => { if (!selectedId) e.preventDefault(); }}>
              Continue to Browse
            </Link>
        </div>

        {/* modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
            <div className="bg-gray-900 rounded-lg p-6 w-full max-w-md">
              <h2 className="text-xl font-semibold mb-3">Create profile</h2>
              <label className="block mb-2 text-sm">Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="w-full mb-3 p-2 rounded bg-gray-800" />

              <label className="block mb-2 text-sm">Birthdate</label>
              <input type="date" value={birthdate} onChange={(e) => setBirthdate(e.target.value)} className="w-full mb-3 p-2 rounded bg-gray-800" />

              <div className="text-xs text-gray-400 mb-3">We use birthdate to determine the appropriate allowed ratings for this profile. It won't be shared.</div>

              {error && <div className="text-red-400 mb-2">{error}</div>}

              <div className="flex gap-3 justify-end">
                <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded bg-gray-700">Cancel</button>
                <button onClick={handleCreate} className="px-4 py-2 rounded bg-indigo-600">Create</button>
              </div>
            </div>
          </div>
        )}

        {/* small helper showing active profile and allowed ratings */}
        {activeProfile && (
          <div className="mt-8 text-sm text-gray-300">
            <div>Active: <span className="font-medium">{activeProfile.name}</span> — Age {activeProfile.age}</div>
            <div className="mt-1">Allowed ratings: <span className="font-medium">{(activeProfile.allowedRatings || []).join(", ")}</span></div>
          </div>
        )}

      </div>
    </main>
  );
}
