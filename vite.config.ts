import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 4173,
    hmr: process.env.VITE_HMR_PORT
      ? { port: Number(process.env.VITE_HMR_PORT) }
      : undefined,
  },
});
