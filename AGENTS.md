# Jotchua meme vault — agent rules

This `gallery/` folder is the website (GitHub Pages). Do not restyle it or rewrite existing posts unless asked.

## When the user says “update”

Weekly loop (no `update.sh`):

1. Telegram Desktop export of the **whole** `@jotchuacontent` history, HTML, to `~/Downloads` (a `ChatExport_*` folder with `messages.html`).
2. User opens this project and says **update**.
3. You run Python **from the project venv**, never system `python3`:
   - from `gallery/`: `../venv/bin/python tools/update.py`
   - from the parent folder: `venv/bin/python gallery/tools/update.py`
   The script re-execs into the venv if you forget. That:
   - finds the newest export in Downloads
   - **replaces** the parent folder’s Telegram dump (`messages.html`, `photos/`, `video_files/`, …) with that export
   - never touches `gallery/` or `venv/`
   - diffs Telegram message ids against `catalog.json`
   - makes thumbs for **new ids only**
   - merges new rows into the catalog
4. You write captions + 3 keywords for the new ids only. Follow `tools/STYLE.md`. If the batch is large, split across subagents; if it is small, do it yourself.
5. Apply tags with `../venv/bin/python tools/update.py --apply path/to/tags.json` (skips ids that already have a caption or keywords). Any other Python (including `tools/build.py`) also uses `venv/bin/python`. Do not `pip install` on system Python.
6. Stop. User checks, `git commit` / `git push` this `gallery/` repo, and deletes the Downloads export.

Do **not**: overwrite `gallery/` or `venv/`, rewrite captions/keywords on existing ids, change `index.html` / `app.js` / `styles.css`, auto-commit, auto-push, or delete the Downloads folder.

`tools/build.py` is the original full rebuild. Do not use it for weekly updates.

## Caption / keywords

See `tools/STYLE.md`. Short version:

- New posts: one-line caption, exactly 3 keywords, look at the image
- Reuse existing keywords only for synonyms / the same idea (`sleeping` → `sleepy`, `cash` → `money`)
- New subjects get new keywords (`antman` is `antman`, not `batman`)
- Existing catalog rows are frozen
