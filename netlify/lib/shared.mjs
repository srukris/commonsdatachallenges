export const norm = s => String(s || "").toLowerCase().replace(/[^a-z0-9ऀ-࿿ ]+/g, " ").replace(/\s+/g, " ").trim();
export const slug = s => norm(s).replace(/ /g, "-").slice(0, 60) || "x";
export const THEME_IDS = ["nr", "ppl", "inst"];
export const PERSONA_IDS = ["pm", "fo", "gov", "adv", "fund", "res", "ena"];
export const clean = (s, n) => String(s == null ? "" : s).replace(/\s+/g, " ").trim().slice(0, n);
