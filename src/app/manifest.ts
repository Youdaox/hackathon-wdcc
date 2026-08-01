import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Incline — grow through focus",
    short_name: "Incline",
    description:
      "A companion that grows on verified, undistracted study time, tied to your real class schedule.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f1e8",
    theme_color: "#364b32",
    icons: [{ src: "/favicon.ico", sizes: "any", type: "image/x-icon" }],
  };
}
