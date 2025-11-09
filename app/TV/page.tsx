"use client";

import { Navbar, NavbarBrand, NavbarContent, NavbarItem, Link } from "@heroui/react";
import { usePathname } from "next/navigation";
import TVshowGallery from "./Tvshows";

import Navigation from "../Navigation";

export default function TV() {
  const pathname = usePathname(); // current URL path

  return (
      <>
      <Navigation />

      <div className="pt-20">
        <TVshowGallery />
      </div>
      </>
  );
}
