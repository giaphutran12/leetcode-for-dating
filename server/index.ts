import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import express from "express";
import { createJudgeRoute } from "./judge/route";
import {
  createPersonaPrepareRoute,
  createPersonaRoute,
  createPersonaService,
} from "./persona/route";

dotenv.config({
  path: process.env.RIZZCODE_ENV_FILE || ".env.local",
  quiet: true,
});

const app = express();
const port = Number(process.env.PORT || 4173);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

app.disable("x-powered-by");
app.use(express.json({ limit: "24kb" }));
const personaService = createPersonaService();
app.post("/api/persona/prepare", createPersonaPrepareRoute(personaService));
app.post("/api/persona", createPersonaRoute(personaService));
app.post("/api/judge", createJudgeRoute());

if (process.env.NODE_ENV === "production") {
  const dist = path.join(root, "dist");
  app.use(express.static(dist));
  app.use((request, response, next) => {
    if (request.method !== "GET" || request.path.startsWith("/api/")) {
      next();
      return;
    }
    response.sendFile(path.join(dist, "index.html"));
  });
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({
    root,
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
}

app.listen(port, "127.0.0.1", () => {
  console.log(`RizzCode ready at http://127.0.0.1:${port}`);
});
