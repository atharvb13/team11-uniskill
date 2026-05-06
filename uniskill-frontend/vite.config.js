import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    // ffmpeg.wasm uses dynamic WASM loading — exclude from Vite's pre-bundler
    exclude: ["@ffmpeg/ffmpeg", "@ffmpeg/util"],
  },
});