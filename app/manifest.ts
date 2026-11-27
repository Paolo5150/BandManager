import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "BandManager | Your band, together",
    short_name: "BandManager",
    description: "Manage your band, all in one place.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f8f5f1",
    theme_color: "#ff6b35",
    icons: [
      { src: "/icon", sizes: "any", type: "image/png", purpose: "any" },
      { src: "/apple-icon", sizes: "any", type: "image/png", purpose: "any" },
    ],
  };
}