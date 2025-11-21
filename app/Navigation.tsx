"use client";
export const dynamic = "force-dynamic";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Navbar, NavbarBrand, NavbarContent, NavbarItem } from "@heroui/react";
import { useActiveProfile } from "./page";

interface LetterSquareProps {
  letter: string;
  size?: number;
  bgColor?: string;
  textColor?: string;
  border?: string;
}

const LetterSquare: React.FC<LetterSquareProps> = ({
  letter,
  size = 40,
  bgColor = "#4f46e5",
  textColor = "white",
  border = "2px solid rgba(0,0,0,0.2)",
}) => (
  <div
    aria-hidden
    style={{
      width: size,
      height: size,
      minWidth: size,
      minHeight: size,
      backgroundColor: bgColor,
      color: textColor,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: size * 0.55,
      fontWeight: 700,
      border,
      borderRadius: 6,
    }}
    className="select-none"
  >
    {letter}
  </div>
);

export default function Navigation() {
  const pathname = (usePathname() || "/").toLowerCase();
  const profile = useActiveProfile();
  const firstLetter = String(profile?.name ?? "A").charAt(0).toUpperCase();

  const items = [
    { key: "movies", label: "Movies", href: "/Movies", match: pathname.startsWith("/movies") },
    { key: "tv", label: "TV Shows", href: "/TV", match: pathname.startsWith("/tv") },
    { key: "livesports", label: "Live Sports", href: "/Livesports", match: pathname.startsWith("/livesports") },
  ];

  return (
    <Navbar shouldHideOnScroll className="fixed top-0 left-0 right-0 z-50 bg-gray-900/95 backdrop-blur-md shadow-md">
      <div className="w-full max-w-6xl mx-auto flex items-center justify-between px-4 py-3">
        {/* Left: Logo */}
        <NavbarBrand>
          <Link href="/" className="flex items-center gap-3">
            <div className="hidden sm:block">
              <div className="text-lg font-extrabold leading-tight text-indigo-400">
                TAMovies
              </div>
            </div>
          </Link>
        </NavbarBrand>

        {/* Center menu */}
        <NavbarContent className="hidden sm:flex justify-center flex-1 absolute left-1/2 transform -translate-x-1/2">
          <nav className="flex gap-6">
            {items.map((it) => {
              const active = Boolean(it.match);
              return (
                <NavbarItem key={it.key} className="relative px-1">
                  <Link
                    href={it.href}
                    aria-current={active ? "page" : undefined}
                    className={`inline-block px-2 py-2 text-sm font-medium transition-colors ${
                      active ? "text-white" : "text-gray-300 hover:text-white"
                    }`}
                  >
                    {it.label}
                    {/* bottom indicator */}
                    <span
                      className={`absolute left-0 right-0 bottom-0 mx-auto h-0.5 rounded-full transition-all duration-200 ${
                        active ? "w-full bg-blue-500 opacity-100" : "w-0 bg-transparent opacity-0"
                      }`}
                    />
                  </Link>
                </NavbarItem>
              );
            })}
          </nav>
        </NavbarContent>

        {/* Right: Search + Profile */}
        <NavbarContent justify="end" className="flex items-center gap-3">
          {/* Search */}
          <NavbarItem>
            <Link
              href="/browse"
              className="p-2 rounded text-gray-200 hover:text-white transition-colors"
            >
              <svg
                aria-hidden
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="inline-block"
              >
                <circle cx="11.5" cy="11.5" r="8.5" />
                <path d="M21 21L18 18" />
              </svg>
            </Link>
          </NavbarItem>

          {/* Profile */}
          <NavbarItem>
            <Link href="/profile">
              <LetterSquare letter={firstLetter} size={36} />
            </Link>
          </NavbarItem>
        </NavbarContent>
      </div>
    </Navbar>
  );
}
