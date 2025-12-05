"use client";

import { usePathname } from "next/navigation";
import Anime from "./anime";
import GenreAnime from "../components/GenreAnime";
import Navigation from "../Navigation";

export default function Movies() {
  const pathname = usePathname(); // current URL path

  return (
        <>
      <Navigation />

      <div className="pt-20">
        <Anime />
        <GenreAnime />
      </div>
      </>
  );
}
