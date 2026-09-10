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
   - never overwrites `gallery/` or `venv/` as a whole (it does write new thumbs, `gallery/media/` originals, and catalog files)
   - diffs Telegram message ids against `catalog.json`
   - makes thumbs for **new ids only**
   - copies those originals into `gallery/media/{id}{ext}`
   - merges new rows into the catalog
   - never catalogs the vault website itself (URL pins or screenshots of the gallery). Text-only links and Telegram pin service messages are already ignored. If a new media post is the site, do not add it: append its Telegram id to `tools/skip_ids.txt` (one id per line) and omit it from this batch
4. You write captions + 3 keywords for the new ids only. Follow `tools/STYLE.md`. If the batch is large, split across subagents; if it is small, do it yourself. Look at each new image/video. If one is the gallery website, treat it as a skip (above), not a meme.
5. Apply tags with `../venv/bin/python tools/update.py --apply path/to/tags.json` (skips ids that already have a caption or keywords). Any other Python (including `tools/build.py`) also uses `venv/bin/python`. Do not `pip install` on system Python.
6. Stop. User checks, `git commit` / `git push` this `gallery/` repo, and deletes the Downloads export.

Do **not**: replace `gallery/` or `venv/` with the dump, rewrite captions/keywords on existing ids, restyle `index.html` / `app.js` / `styles.css` unless asked, auto-commit, auto-push, or delete the Downloads folder. Do not edit dump dirs except via the snapshot replace. Do not catalog the vault website (`titus-chua.github.io/jotchua-vault`) — pins, link posts, or screenshots of the gallery.

`write_catalog` stamps `catalog.js?v=<max-id>` and `keywords.js?v=<max-id>` in `index.html` so a normal visit/reload gets new memes. The public Pages URL stays the repo root. Leave that stamp alone except via `update.py`.

`tools/build.py` is the original full rebuild. Do not use it for weekly updates.

## Caption / keywords

See `tools/STYLE.md`. Short version:

- New posts: one-line caption, exactly 3 keywords, look at the image
- Reuse existing keywords only for synonyms / the same idea (`sleeping` → `sleepy`, `cash` → `money`)
- New subjects get new keywords (`antman` is `antman`, not `batman`)
- Existing catalog rows are frozen
