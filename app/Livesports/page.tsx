"use client";

import { Navbar, NavbarBrand, NavbarContent, NavbarItem, Link } from "@heroui/react";
import { usePathname } from "next/navigation";
import Sport from "./live-sports";

import Navigation from "../Navigation";

export default function TV() {
  const pathname = usePathname(); // current URL path

  return (
      <>
      <Navigation />

      <div className="pt-20">
        <Sport />
      </div>
      </>
  );
}
