"use client";

// Hooks
import { useMovieFetch } from "../hooks/useMedia";

// Components
import Loading from "../components/loading";
import Featured from "../components/Featured";
import Genre from "../components/Genre";

import { useActiveProfile } from "../page";

export default function TVshowGallery() {

  const { movies, loading } = useMovieFetch("tvSeries");
  const profile  = useActiveProfile();

  // ----- render -----
  if (loading) {
    return (
      <Loading />
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white px-6 py-8 space-y-12 relative overflow-x-hidden">
      {/* Featured */}
      <Featured movies={movies} age={profile.age} />

      {/* Genres */}
      <Genre movies={movies} age={profile.age} />

    </div>
  );
}
