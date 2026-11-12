import { getStore } from "@netlify/blobs";
import { slug, clean, THEME_IDS, PERSONA_IDS } from "../lib/shared.mjs";

export const config = { path: "/api/*" };
const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const isAdmin = req => !!process.env.ADMIN_PASSWORD && req.headers.get("x-admin-key") === process.env.ADMIN_PASSWORD;

const list = (a, max = 20) => (Array.isArray(a) ? a : []).slice(0, max).map(x => ({ t: clean(x && x.t, 300), pre: !!(x && x.pre), star: !!(x && x.star) })).filter(x => x.t);

export default async (req) => {
  const path = new URL(req.url).pathname.replace(/^\/api\/?/, "");
  const responses = getStore("dotg2-responses"), meta = getStore("dotg2-meta");
  try {
    if (path === "config") return J({ ok: true, adminSet: !!process.env.ADMIN_PASSWORD, aiSet: !!process.env.ANTHROPIC_API_KEY });

    if (path === "submit" && req.method === "POST") {
      const b = await req.json();
      const g = clean(b.g, 80), pid = b.pid, tid = b.tid;
      if (!g) return J({ error: "Group name is required" }, 400);
      if (!PERSONA_IDS.includes(pid) || !THEME_IDS.includes(tid)) return J({ error: "Bad persona or theme" }, 400);
      const c = list(b.c), d = list(b.d), h = list(b.h);
      if (!c.some(x => x.star)) return J({ error: "Pick the biggest challenge (star)" }, 400);
      const rec = { g, land: clean(b.land, 80), place: clean(b.place, 80), pid, pn: clean(b.pn, 60), tid, tn: clean(b.tn, 60), d, c, h, help: clean(b.help, 600), ts: Date.now() };
      await responses.setJSON(`${slug(g)}__${pid}__${tid}`, rec);
      return J({ ok: true });
    }

    if (path === "mine" && req.method === "GET") {
      const g = slug(new URL(req.url).searchParams.get("g"));
      const { blobs } = await responses.list({ prefix: g + "__" });
      return J({ done: blobs.map(x => x.key.split("__").slice(1).join("__")) });
    }

    if (!isAdmin(req)) return J({ error: "Unauthorised" }, 401);

    if (path === "login") return J({ ok: true });

    if (path === "data") {
      const { blobs } = await responses.list();
      const rows = (await Promise.all(blobs.map(b => responses.get(b.key, { type: "json" })))).filter(Boolean);
      const analysis = await meta.get("analysis", { type: "json" });
      const job = await meta.get("job", { type: "json" });
      return J({ rows, analysis, job });
    }

    if (path === "analyse" && req.method === "POST") {
      if (!process.env.ANTHROPIC_API_KEY) return J({ error: "ANTHROPIC_API_KEY is not set" }, 400);
      const job = await meta.get("job", { type: "json" });
      if (job && job.state === "running" && Date.now() - job.ts < 5 * 60 * 1000) return J({ ok: true, already: true });
      await meta.setJSON("job", { state: "running", ts: Date.now() });
      const origin = new URL(req.url).origin;
      await fetch(origin + "/.netlify/functions/analyse-background", { method: "POST", headers: { "x-admin-key": req.headers.get("x-admin-key") } });
      return J({ ok: true });
    }

    if (path === "reset" && req.method === "POST") {
      const b = await req.json().catch(() => ({}));
      if (b.confirm !== "DELETE") return J({ error: "confirm" }, 400);
      const { blobs } = await responses.list();
      await Promise.all(blobs.map(x => responses.delete(x.key)));
      await meta.delete("analysis"); await meta.delete("job");
      return J({ ok: true, deleted: blobs.length });
    }
    return J({ error: "Not found" }, 404);
  } catch (e) {
    return J({ error: String(e.message || e) }, 500);
  }
};
