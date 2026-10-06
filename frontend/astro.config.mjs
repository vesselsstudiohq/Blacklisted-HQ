import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";

// Temporary demo origin for the pitch deploy; swap for the client's domain at ship.
export default defineConfig({
  site: "https://blacklisted-trendmaker.vercel.app",
  integrations: [sitemap()],
  vite: {
    plugins: [tailwindcss()],
    build: { sourcemap: false },
  },
});
