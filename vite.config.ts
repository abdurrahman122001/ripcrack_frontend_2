import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3003",
        changeOrigin: true,
        secure: false,
      },
      "/widget-embed.js": {
        target: "http://localhost:3003",
        changeOrigin: true,
        secure: false,
      },
      "/embed.html": {
        target: "http://localhost:3003",
        changeOrigin: true,
        secure: false,
      },
      "/assets": {
        target: "http://localhost:3003",
        changeOrigin: true,
        secure: false,
      },
    },
    headers: {
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
    },
    hmr: {
      overlay: false,
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
});
