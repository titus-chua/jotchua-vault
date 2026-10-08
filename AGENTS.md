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
4. You write captions and keywords for the new ids only. Follow `tools/STYLE.md`. If the batch is large, split across subagents; if it is small, do it yourself. Look at each new image or video. Sample video frames with the venv's OpenCV (`cv2.VideoCapture`), not ffmpeg. If one is the gallery website, treat it as a skip (above), not a meme.
5. Review those tags against the media and edit. Review the edited tags against the media again and edit if needed. That is three looks (write, review, review) before apply.
6. Apply tags with `../venv/bin/python tools/update.py --apply path/to/tags.json` (skips ids that already have a caption or keywords). Any other Python (including `tools/build.py`) also uses `venv/bin/python`. Do not `pip install` on system Python.
7. Stop. User checks, `git commit` / `git push` this `gallery/` repo, and deletes the Downloads export.

Do **not**: replace `gallery/` or `venv/` with the dump, rewrite captions/keywords on existing ids, restyle `index.html` / `app.js` / `styles.css` unless asked, auto-commit, auto-push, or delete the Downloads folder. Do not edit dump dirs except via the snapshot replace. Do not catalog the vault website (`titus-chua.github.io/jotchua-vault`) — pins, link posts, or screenshots of the gallery.

`write_catalog` stamps `catalog.js?v=<max-id>` and `keywords.js?v=<max-id>` in `index.html` so a normal visit/reload gets new memes. The public Pages URL stays the repo root. Leave that stamp alone except via `update.py`.

`tools/build.py` is the original full rebuild. Do not use it for weekly updates.

## Caption / keywords

See `tools/STYLE.md`. Short version:

- New posts: a concrete caption of one to four sentences, and as many fair keywords as the post needs (usually 8–25). Look at the media.
- If a feeling or situation fits, add the whole synonym cluster (`sleep`, `sleepy`, `sleeping`, `nap`, `tired`). A new subject still gets its own word (`antman`, not `batman`).
- Never use `jotchua`, `dog`, `puppy`, `meme`, or `crypto` as keywords. `coin` is allowed when a coin is the subject.
- Existing catalog rows stay frozen. `--apply` only fills untagged ids. A requested edit of ids that already have captions uses `update.py --overwrite`.
