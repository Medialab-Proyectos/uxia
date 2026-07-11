import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 4173,
    open: true,
    // La app habla DIRECTO con Supabase (ver src/opsData.js). No hay servidor
    // intermediario ni proxy: solo la aplicación y la base de datos.
  },
});
