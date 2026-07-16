import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        mdssp: resolve(__dirname, "mdssp.html"),
      },
    },
  },
  server: {
    host: "0.0.0.0",
    port: 4173,
    open: true,
    // La app habla DIRECTO con Supabase (ver src/opsData.js). No hay servidor
    // intermediario ni proxy: solo la aplicación y la base de datos.
  },
});
