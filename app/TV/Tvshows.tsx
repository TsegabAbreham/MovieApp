"use client";

// Hooks
import { useMovieFetch } from "../hooks/useMedia";

// Components
import Loading from "../components/loading";
import Featured from "../components/Featured";
import Genre from "../components/Genre";

export default function TVshowGallery() {

  const { movies, loading } = useMovieFetch("tvSeries");

  // ----- render -----
  if (loading) {
    return (
      <Loading />
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white px-6 py-8 space-y-12 relative overflow-x-hidden">

      {/* Featured */}
      <Featured movies={movies} />

      {/* Genres */}
      <Genre movies={movies} />
    </div>
  );
}
