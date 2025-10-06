"use client";
import { useEffect } from "react";

// Reload the page once with a cache-busting param if a chunk fails to load.
export default function ChunkReloadGuard() {
  useEffect(() => {
    function onError(e: ErrorEvent) {
      const isChunkError =
        e?.message?.includes("Loading chunk") ||
        (typeof e?.error?.toString === "function" &&
          e.error.toString().includes("ChunkLoadError"));

      if (isChunkError) {
        const url = new URL(window.location.href);
        if (!url.searchParams.has("_r")) {
          url.searchParams.set("_r", Date.now().toString());
          window.location.replace(url.toString());
        }
      }
    }

    window.addEventListener("error", onError);
    return () => window.removeEventListener("error", onError);
  }, []);

  return null;
}


