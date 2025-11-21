"use client";

import { usePathname } from "next/navigation";
import MovieGallery from "./MovieGallery";
import Navigation from "../Navigation";

export default function Movies() {
  const pathname = usePathname(); // current URL path

  return (
        <>
      <Navigation />

      <div className="pt-20">
        <MovieGallery />
      </div>
      </>
  );
}
