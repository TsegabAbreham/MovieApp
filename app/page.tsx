"use client";

import { Navbar, NavbarBrand, NavbarContent, NavbarItem, Link, Button } from "@heroui/react";
import Navigation from "./Navigation";

export default function App() {
  return (
    <>
    <main className="min-h-screen bg-gray-900 text-white px-6 py-12">
      <div className="max-w-6xl mx-auto">
        {/* Hero */}
        <header className="grid md:grid-cols-2 gap-8 items-center mb-12">
          <div>
            <h1 className="text-4xl md:text-5xl font-extrabold leading-tight mb-4">Welcome to <span className="text-indigo-400">TAMovies</span></h1>
            <p className="text-lg text-gray-300 mb-6">A lightweight, privacy-focused movie browsing experience — browse curated movies and jump straight into trailers or details. Built for keyboards and TV remotes.</p>

            <div className="flex gap-4">
              <Link href="/Movies">
                <a className="inline-block px-6 py-3 rounded-lg bg-gray-800 hover:bg-gray-700 font-semibold">Browse movies</a>
              </Link>
            </div>
          </div>
        </header>

        {/* Features */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-4">What you can do</h2>
          <div className="grid md:grid-cols-3 gap-6">

            <div className="p-6 rounded-lg bg-gray-800">
              <h3 className="font-semibold mb-2">Age filtering</h3>
              <p className="text-sm text-gray-300">Movies are filtered using region-aware certificates (US ratings). Select Adults to see mature titles like <em>R</em> or Kids to hide them.</p>
            </div>

            <div className="p-6 rounded-lg bg-gray-800">
              <h3 className="font-semibold mb-2">Remote-first UI</h3>
              <p className="text-sm text-gray-300">Designed for TV remotes and keyboards — arrow navigation, focus rings, and large tappable controls make it simple on big screens.</p>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-gray-800 pt-6 text-sm text-gray-400">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
            <div>© {new Date().getFullYear()} TAMovies — Built by Tsegab Moges</div>
            <div className="flex gap-4">
              <p>Notice: All the movies are not stored in this website, they come from third-party website.</p>
            </div>
          </div>
        </footer>
      </div>
    </main>
    </>
  );
}
