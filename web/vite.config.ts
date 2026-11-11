import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// `bun run dev` serves the pages from Vite (with live reload) and forwards
// API calls to the real server on port 8001.
export default defineConfig({
  plugins: [react()],
  server: {
    fs: { allow: [".."] },
    proxy: {
      "/api": "http://localhost:8001",
      "/socket.io": { target: "http://localhost:8001", ws: true },
    },
  },
});
