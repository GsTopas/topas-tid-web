import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "./" = relative asset paths, so the app works under /topas-tid-web/ on GitHub Pages.
export default defineConfig({
  base: "./",
  plugins: [react()],
});
