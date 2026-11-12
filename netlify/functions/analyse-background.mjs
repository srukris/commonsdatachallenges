import { getStore } from "@netlify/blobs";
import { runAnalysis } from "../lib/analyse.mjs";

export default async (req) => {
  const meta = getStore("dotg2-meta"), store = getStore("dotg2-responses");
  const key = req.headers.get("x-admin-key");
  if (!process.env.ADMIN_PASSWORD || key !== process.env.ADMIN_PASSWORD) return new Response("no", { status: 401 });
  try {
    await meta.setJSON("job", { state: "running", ts: Date.now() });
    const res = await runAnalysis(store, meta);
    await meta.setJSON("job", { state: "done", ts: Date.now(), n: res.n, warnings: res.warnings });
  } catch (e) {
    await meta.setJSON("job", { state: "error", ts: Date.now(), error: String(e.message || e).slice(0, 300) });
  }
  return new Response("ok");
};
