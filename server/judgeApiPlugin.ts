// Vite plugin that mounts the server-side LLM judge at POST /api/judge in both the
// dev server and the preview server (plan: "Required LLM judge"). This is the ONLY
// place the real OpenAI key is read: loadEnv pulls it from .env.local at runtime,
// server-side only. The key is never exposed to import.meta.env, the client bundle,
// rendered HTML, or logs, and its value is never printed here.

import type { IncomingMessage, ServerResponse } from "node:http";
import { type Plugin, loadEnv } from "vite";
import { handleJudgeRequest, type JudgeDeps } from "../src/server/judge/route";
import type { JudgeApiResponse } from "../src/domain/types";

// Bound the request body so an oversized payload can never buffer unboundedly.
const MAX_BODY_BYTES = 64 * 1024;

type Connect = (
  req: IncomingMessage,
  res: ServerResponse,
  next: (err?: unknown) => void,
) => void;

function sendJson(res: ServerResponse, status: number, body: JudgeApiResponse): void {
  const payload = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(payload);
}

// Read and JSON-parse a bounded request body. Rejects oversized or non-JSON input.
function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("request body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf-8");
      try {
        resolve(raw.length === 0 ? undefined : JSON.parse(raw));
      } catch {
        reject(new Error("invalid json"));
      }
    });
    req.on("error", reject);
  });
}

// Read ONLY the two server variables the judge needs, at runtime, server-side.
function loadJudgeEnv(mode: string, root: string): JudgeDeps["env"] {
  const env = loadEnv(mode, root, "");
  return {
    OPENAI_API_KEY: env.OPENAI_API_KEY,
    RIZZCODE_JUDGE_MODEL: env.RIZZCODE_JUDGE_MODEL,
  };
}

function makeMiddleware(env: JudgeDeps["env"]): Connect {
  return (req, res, next) => {
    const url = req.url ?? "";
    // Match /api/judge with or without a query string.
    const isJudge = url === "/api/judge" || url.startsWith("/api/judge?");
    if (!isJudge) {
      next();
      return;
    }
    if (req.method !== "POST") {
      sendJson(res, 405, {
        ok: false,
        retryable: false,
        code: "judge_unavailable",
        message: "method not allowed",
      });
      return;
    }

    readJsonBody(req)
      .then((body) => handleJudgeRequest(body, { env }))
      .then(({ status, body }) => sendJson(res, status, body))
      .catch(() => {
        // Body read / parse failure — treat as a malformed request.
        sendJson(res, 400, {
          ok: false,
          retryable: false,
          code: "judge_unavailable",
          message: "invalid request",
        });
      });
  };
}

export function judgeApiPlugin(): Plugin {
  let env: JudgeDeps["env"] = {};
  return {
    name: "rizzcode-judge-api",
    configResolved(config) {
      // Load once when config resolves; reused by dev and preview middleware.
      env = loadJudgeEnv(config.mode, config.root);
    },
    configureServer(server) {
      server.middlewares.use(makeMiddleware(env));
    },
    configurePreviewServer(server) {
      server.middlewares.use(makeMiddleware(env));
    },
  };
}
