"use client";

import React from "react";
import { useAnimeFetch } from "../hooks/useMedia";
import FeaturedAnime from "../components/FeaturedAnime";

export default function Anime() {
  // Fetch top anime, page 1
  const { movies: topAnime, loading } = useAnimeFetch("top", "1");

  if (loading) return <div>Loading anime...</div>;

  if (!topAnime.length) return <div>No anime found.</div>;

  return (
    <FeaturedAnime />
  );
}
