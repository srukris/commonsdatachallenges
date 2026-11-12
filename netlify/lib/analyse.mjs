import { getStore } from "@netlify/blobs";
import { norm, THEME_IDS } from "./shared.mjs";

const THEME_NAMES = { nr: "Natural resources (land, water, forests, other commons)", ppl: "People (livelihoods, vulnerability)", inst: "Institutions (commons governance, finances)" };
const PERSONA_NAMES = { pm: "Programme manager", fo: "Field officer", gov: "Government official", adv: "Advocacy/liaison group", fund: "Funder", res: "Researcher/specialist", ena: "Enabler of landscape stewards" };

export function collect(rows) {
  // distinct normalised items per theme and kind, with count, star count and personas
  const out = {};
  for (const tid of THEME_IDS) out[tid] = { c: new Map(), d: new Map(), h: new Map() };
  for (const r of rows) {
    const T = out[r.tid]; if (!T) continue;
    for (const k of ["c", "d", "h"]) for (const it of r[k] || []) {
      const key = norm(it.t); if (!key) continue;
      let e = T[k].get(key);
      if (!e) T[k].set(key, e = { key, text: it.t, n: 0, star: 0, p: {} });
      e.n++; if (it.star) e.star++; e.p[r.pid] = (e.p[r.pid] || 0) + 1;
    }
  }
  return out;
}

function prompt(tid, T) {
  const list = k => [...T[k].values()].sort((a, b) => b.n - a.n).slice(0, 120);
  const fmt = (arr) => arr.map((e, i) => `${i}\t${e.n}x\t${Object.keys(e.p).map(p => PERSONA_NAMES[p]).join("/")}\t${e.text}`).join("\n");
  const C = list("c"), D = list("d"), H = list("h");
  const sys = `You help a facilitator make sense of workshop inputs about data, technology and capacity gaps in India's ecological commons. Participants are programme managers, field officers, government officials, advocacy groups, funders, researchers and enablers of landscape stewards. Write in plain, short English that a field officer can read. Never invent facts. Output ONLY valid JSON.`;
  const user = `THEME: ${THEME_NAMES[tid]}

Below are distinct items entered by groups. Each line: index, number of groups who entered it, personas, text.

CHALLENGES (what gets in the way of getting or using data):
${fmt(C)}

DATA USED:
${fmt(D)}

COPING (how people deal with the challenges):
${fmt(H)}

Task:
1. Group the CHALLENGES into 4 to 8 clusters of the same underlying problem. Give each cluster a short name (max 8 words) and a one-sentence plain summary.
2. Group DATA USED into 4 to 8 clusters. Give each a short name, a "kind" (one of: government records, satellite or remote sensing, field data, community knowledge, programme or funder reports, other) and a one-sentence summary.
3. Group COPING into 3 to 7 clusters with name, summary, and "addresses": the challenge cluster indexes (0-based, from your challenges list) it helps with.
4. Propose 3 to 5 INTERVENTIONS that would address the main challenge clusters. Each: title (max 10 words), why (one sentence tied to what groups said), who (who should lead or support, plain words), addresses (challenge cluster indexes), builds_on (coping cluster indexes this builds on, may be empty), evidence (up to 5 item indexes from CHALLENGES that support it).
Every item index must appear in exactly one cluster; if an item truly fits nowhere leave it out.

Return JSON exactly: {"challenges":[{"name":"","summary":"","items":[idx]}],"data":[{"name":"","kind":"","summary":"","items":[idx]}],"coping":[{"name":"","summary":"","addresses":[],"items":[idx]}],"interventions":[{"title":"","why":"","who":"","addresses":[],"builds_on":[],"evidence":[]}]}`;
  return { sys, user, C, D, H };
}

async function callClaude(sys, user) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5", max_tokens: 8000, system: sys, messages: [{ role: "user", content: user }] }),
  });
  if (!r.ok) throw new Error("Anthropic " + r.status + " " + (await r.text()).slice(0, 200));
  const j = await r.json();
  const txt = (j.content || []).map(b => b.text || "").join("");
  const a = txt.indexOf("{"), b = txt.lastIndexOf("}");
  if (a < 0 || b < 0) throw new Error("No JSON in reply");
  return JSON.parse(txt.slice(a, b + 1));
}

const ints = (a, max) => (Array.isArray(a) ? a : []).map(Number).filter(n => Number.isInteger(n) && n >= 0 && n < max);

function shape(raw, C, D, H) {
  const assign = { c: {}, d: {}, h: {} };
  const mk = (arr, list, k, extra) => (Array.isArray(raw[arr]) ? raw[arr] : []).slice(0, 10).map((cl, i) => {
    for (const ix of ints(cl.items, list.length)) if (!(list[ix].key in assign[k])) assign[k][list[ix].key] = i;
    return extra(cl);
  });
  const s = (v, n) => String(v || "").slice(0, n);
  const challenges = mk("challenges", C, "c", cl => ({ name: s(cl.name, 90), summary: s(cl.summary, 300) }));
  const data = mk("data", D, "d", cl => ({ name: s(cl.name, 90), kind: s(cl.kind, 40), summary: s(cl.summary, 300) }));
  const coping = mk("coping", H, "h", cl => ({ name: s(cl.name, 90), summary: s(cl.summary, 300), addresses: ints(cl.addresses, challenges.length) }));
  const interventions = (Array.isArray(raw.interventions) ? raw.interventions : []).slice(0, 6).map(iv => ({
    title: s(iv.title, 140), why: s(iv.why, 400), who: s(iv.who, 200),
    addresses: ints(iv.addresses, challenges.length), builds_on: ints(iv.builds_on, coping.length),
    evidence: ints(iv.evidence, C.length).map(ix => C[ix].text.slice(0, 200)),
  }));
  return { challenges, data, coping, interventions, assign };
}

export async function runAnalysis(store, meta) {
  const rows = [];
  const { blobs } = await store.list();
  for (const b of blobs) { const r = await store.get(b.key, { type: "json" }); if (r) rows.push(r); }
  const col = collect(rows);
  const warnings = [], themes = {};
  await Promise.all(THEME_IDS.map(async tid => {
    const T = col[tid];
    if (!T.c.size && !T.d.size && !T.h.size) return;
    const { sys, user, C, D, H } = prompt(tid, T);
    for (let attempt = 0; attempt < 2; attempt++) {
      try { themes[tid] = shape(await callClaude(sys, user), C, D, H); return; }
      catch (e) { if (attempt) warnings.push(tid + ": " + e.message); }
    }
  }));
  const prev = await meta.get("analysis", { type: "json" });
  if (!Object.keys(themes).length && warnings.length) throw new Error("Grouping failed (" + warnings[0] + "). Previous grouping kept.");
  if (prev && prev.themes) for (const tid of THEME_IDS) if (!themes[tid] && prev.themes[tid] && col[tid].c.size + col[tid].d.size + col[tid].h.size) themes[tid] = prev.themes[tid];
  const res = { v: 2, ts: Date.now(), n: rows.length, themes, warnings };
  await meta.setJSON("analysis", res);
  return res;
}
