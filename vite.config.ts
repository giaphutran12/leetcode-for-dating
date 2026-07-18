import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { judgeApiPlugin } from "./server/judgeApiPlugin";

export default defineConfig({
  plugins: [react(), judgeApiPlugin()],
  server: {
    host: "127.0.0.1",
    port: 4173,
  },
});
