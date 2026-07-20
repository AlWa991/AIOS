/** Dashboard — reads ONLY Situation.current() (ADR-0017). Zero business logic. */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import type { Horizon, Situation } from "../../contracts/situation.js";
import { createRuntime } from "../../runtime/index.js";

export async function buildServer(situation: Situation) {
  const app = Fastify({ logger: false });

  app.get("/health", async () => ({ ok: true }));

  app.get<{ Querystring: { horizon?: string } }>("/situation", async (req) => {
    const horizon: Horizon = req.query.horizon === "week" ? "week" : "today";
    return situation.current(horizon);
  });

  app.get("/", async (_req, reply) => {
    const dir = path.dirname(fileURLToPath(import.meta.url));
    const html = readFileSync(path.join(dir, "public", "index.html"), "utf8");
    reply.type("text/html").send(html);
  });

  return app;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMain) {
  const runtime = await createRuntime();
  const app = await buildServer(runtime.situation);
  const port = Number(process.env.PORT ?? 3000);
  await app.listen({ port, host: "0.0.0.0" });
  console.log(JSON.stringify({ level: "info", msg: "dashboard listening", port }));
}
