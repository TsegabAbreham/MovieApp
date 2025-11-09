"use client";

import { Navbar, NavbarBrand, NavbarContent, NavbarItem, Link } from "@heroui/react";
import { usePathname } from "next/navigation";

export const SearchIcon = ({ size = 24, strokeWidth = 1.5, width, height, ...props }) => (
  <svg
    aria-hidden="true"
    fill="none"
    focusable="false"
    height={height || size}
    role="presentation"
    viewBox="0 0 24 24"
    width={width || size}
    {...props}
  >
    <path
      d="M11.5 21C16.7467 21 21 16.7467 21 11.5C21 6.25329 16.7467 2 11.5 2C6.25329 2 2 6.25329 2 11.5C2 16.7467 6.25329 21 11.5 21Z"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={strokeWidth}
    />
    <path
      d="M22 22L20 20"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={strokeWidth}
    />
  </svg>
);

export default function Navigation() {
  const pathname = usePathname();

  return (
    <Navbar shouldHideOnScroll className="bg-gray-900 shadow-md px-6 py-3 fixed w-full z-50">
      {/* Brand */}
      <NavbarBrand>
        <img src="/favicon.ico" alt="MovieApp Logo" className="h-8 w-8 mr-2 inline-block" />
      </NavbarBrand>

      {/* Centered links */}
      <NavbarContent justify="center" className="hidden sm:flex gap-6">
        <NavbarItem isActive={pathname.toLowerCase() === "/movies"}>
          <Link
            href="/Movies"
            className={`transition-colors ${
              pathname.toLowerCase() === "/movies"
                ? "text-white border-b-2 border-blue-500"
                : "hover:text-blue-400"
            }`}
          >
            Movies
          </Link>
        </NavbarItem>
        <NavbarItem isActive={pathname.toLowerCase() === "/tv"}>
          <Link
            href="/TV"
            className={`transition-colors ${
              pathname.toLowerCase() === "/tv"
                ? "text-white border-b-2 border-blue-500"
                : "hover:text-blue-400"
            }`}
          >
            TV Shows
          </Link>
        </NavbarItem>
        <NavbarItem isActive={pathname.toLowerCase() === "/livesports"}>
          <Link
            href="/Livesports"
            className={`transition-colors ${
              pathname.toLowerCase() === "/livesports"
                ? "text-white border-b-2 border-blue-500"
                : "hover:text-blue-400"
            }`}
          >
            Live Sports
          </Link>
        </NavbarItem>
      </NavbarContent>

      {/* Right side: search icon */}
      <NavbarContent justify="end" className="flex items-center gap-4 ml-auto">
        <NavbarItem
          className={`hidden lg:flex ${
            pathname.toLowerCase() === "/browse"
              ? "text-white border-b-2 border-blue-500"
              : "hover:text-blue-400"
          }`}
          isActive={pathname.toLowerCase() === "/browse"}
        >
          <Link
            href="/browse"
            className="transition-colors text-white text-[16px] font-medium hover:text-blue-400"
          >
            <SearchIcon size={20} />
          </Link>
        </NavbarItem>
      </NavbarContent>
    </Navbar>
  );
}
