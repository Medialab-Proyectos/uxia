import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 4173,
    open: true,
    // En local, /api lo atiende el servidor Express (npm run scraper) en 8787.
    // En Vercel, /api lo atienden las funciones serverless de la carpeta /api.
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8787",
        changeOrigin: true,
      },
    },
  },
});
