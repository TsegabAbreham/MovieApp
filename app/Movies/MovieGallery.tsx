"use client";

import { useMovieFetch } from "../hooks/useMedia";

import Featured from "../components/Featured";
import Genre from "../components/Genre";
import Loading from "../components/loading";

import { useActiveProfile } from "../page";

export default function MovieGallery() {
  const { movies, loading } = useMovieFetch("movie");
  const profile  = useActiveProfile();

  if (loading) return <Loading />;

  return (
    <div className="min-h-screen bg-gray-900 text-white px-6 py-8 space-y-12 relative overflow-x-hidden">
      <Featured movies={movies} age={profile.age} />
      <Genre movies={movies} age={profile.age}/>
    </div>
  );
}
