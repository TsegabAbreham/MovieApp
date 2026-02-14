"use client";
import React, { useState } from "react";

type Props = {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
  width?: number;
  height?: number;
  draggable?: boolean;
  style?: React.CSSProperties;
};

export default function OptimizedImg({
  src,
  alt,
  className = "",
  priority = false,
  width,
  height,
  draggable = true,
  style,
}: Props) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  const handleLoad = () => setLoaded(true);
  const handleError = () => setErrored(true);

  const imgSrc = errored ? "/placeholder-poster.png" : src;

  return (
    <div className="opt-img-root" style={{ position: "relative", overflow: "hidden", ...style }}>
      {!loaded && <div className="opt-img-placeholder" aria-hidden />}
      <img
        src={imgSrc}
        alt={alt}
        className={`opt-img ${className} ${loaded ? "opt-img-loaded" : ""}`.trim()}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        width={width}
        height={height}
        draggable={draggable}
        onLoad={handleLoad}
        onError={handleError}
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      />
    </div>
  );
}
