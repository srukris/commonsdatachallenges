# Data on the Ground (v2)

ILDC workshop app. Participants enter a group name and pick a persona (one screen), then choose a theme from a hub that ticks the themes already answered; after each submit they return to the hub for the next theme. Each theme
(Natural resources / People / Institutions), and answer pre-filled, editable questions:
1 data used, 2 what gets in the way (star the biggest, required), 3 how they cope (star what works best),
4 one change that would help (optional). Facilitators open `/#admin` for an Overview tab and an Advanced tab.

## Deploy (Netlify)
1. Put this folder in a Git repo (or drag the unzipped folder into Netlify "Deploy manually").
   Keep `netlify.toml`, `package.json`, `public/` and `netlify/` at the top level, not inside another folder.
2. Site settings > Environment variables: add
   - `ADMIN_PASSWORD`  (facilitator password)
   - `ANTHROPIC_API_KEY`  (used only to group similar wording and draft interventions)
   - optional `ANTHROPIC_MODEL` (default `claude-sonnet-5-5`)
3. Redeploy (clear cache). Check `https://YOUR-SITE/api/config` shows `"adminSet":true,"aiSet":true`.
4. Participants: the site link. Facilitator: `https://YOUR-SITE/#admin`.

## During the session
- Counts are live (computed in the browser from raw answers). Press **Build grouping** once most groups
  have submitted, and **Update grouping** to include late answers; new wording shows as "Not yet grouped" until then.
- If grouping fails, the previous grouping is kept and the reason is shown.
- **Download CSV** gives every item with persona, theme, whether it was added by the group, and stars.
- **Clear all data** (type DELETE) wipes responses. This app uses its own storage names, so it does not touch the older apps.

## Editing the pre-filled options
`prefill-options.xlsx` holds all 294 suggestions. Edit the `text` column (add/delete rows freely), then run
`python3 tools/xlsx_to_content.py prefill-options.xlsx` (needs `pip install openpyxl`) and redeploy.
`tools/prefill_source.py` and `tools/build_content.py` regenerate both files from source.
