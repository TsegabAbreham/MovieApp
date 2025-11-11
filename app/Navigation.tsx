"use client";
export const dynamic = "force-dynamic";

import { Navbar, NavbarBrand, NavbarContent, NavbarItem } from "@heroui/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export const SearchIcon = ({
  size = 24,
  strokeWidth = 1.5,
  width,
  height,
  ...props
}: {
  size?: number;
  strokeWidth?: number;
  width?: number | string;
  height?: number | string;
  [key: string]: any;
}) => (
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
  const pathname = (usePathname() || "/").toLowerCase();

  return (
    // added relative so absolutely-positioned center menu can align to the navbar
    <Navbar shouldHideOnScroll className="relative bg-gray-900 shadow-md px-6 py-3 fixed w-full z-50">
      <NavbarBrand>
        {/* smaller, vertically-centered title, clickable to home */}
        <Link href="/" className="flex items-center gap-3">
          <span className="text-2xl md:text-3xl font-extrabold leading-tight">
            <span className="text-indigo-400">TAMovies</span>
          </span>
        </Link>
      </NavbarBrand>

      {/* center menu: absolute-centered like Netflix/Prime (hidden on very small screens) */}
      <NavbarContent
        justify="center"
        className="hidden sm:flex gap-6 absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-auto"
      >
        <NavbarItem isActive={pathname.startsWith("/Movies")}>
          <Link
            href="/Movies"
            className={`transition-colors ${
              pathname.startsWith("/Movies") ? "text-white border-b-2 border-blue-500" : "hover:text-blue-400"
            }`}
          >
            Movies
          </Link>
        </NavbarItem>

        <NavbarItem isActive={pathname.startsWith("/TV")}>
          <Link
            href="/TV"
            className={`transition-colors ${
              pathname.startsWith("/TV") ? "text-white border-b-2 border-blue-500" : "hover:text-blue-400"
            }`}
          >
            TV Shows
          </Link>
        </NavbarItem>

        <NavbarItem isActive={pathname.startsWith("/Livesports")}>
          <Link
            href="/Livesports"
            className={`transition-colors ${
              pathname.startsWith("/Livesports") ? "text-white border-b-2 border-blue-500" : "hover:text-blue-400"
            }`}
          >
            Live Sports
          </Link>
        </NavbarItem>
      </NavbarContent>

      {/* right side: search / other actions */}
      <NavbarContent justify="end" className="flex items-center gap-4 ml-auto">
        <NavbarItem
          className={`hidden lg:flex ${
            pathname.startsWith("/browse") ? "text-white border-b-2 border-blue-500" : "hover:text-blue-400"
          }`}
          isActive={pathname.startsWith("/browse")}
        >
          <Link href="/browse" className="transition-colors text-white text-[16px] font-medium hover:text-blue-400">
            <SearchIcon size={20} />
          </Link>
        </NavbarItem>
      </NavbarContent>
    </Navbar>
  );
}
