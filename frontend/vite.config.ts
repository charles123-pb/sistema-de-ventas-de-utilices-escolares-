import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { env } from "node:process";
export default defineConfig({
  plugins: [react()],
  // El proxy mantiene /api en el mismo origen del navegador y reenvía las solicitudes al servidor Go.
  server: { proxy: { "/api": env.VITE_API_TARGET || "http://127.0.0.1:8080" } },
});
