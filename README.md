# Jotchua meme vault

Searchable gallery for [`@jotchuacontent`](https://t.me/jotchuacontent).

This folder is the whole website. The grid uses thumbnails. Full photos, videos, stickers, and audio live in `media/` and load in the lightbox. Telegram still has the original posts.

## What visitors get

- Grid of thumbs (fast)
- Left sidebar of all keywords with counts (click to filter)
- Search by id, author, date, caption, keywords
- Click a card → full file in the lightbox
- **Download**, **Copy** (image to clipboard, or the file URL), **Open in Telegram**

## Publish on GitHub Pages

Only this `gallery/` folder goes to GitHub. That includes `thumbs/` and `media/`. Do **not** upload the parent dump (`photos/`, `video_files/`, `messages.html`, …).

In this folder:

```bash
git init
git add .
git commit -m "Jotchua meme vault"
```

Create a **public** repo on GitHub (free Pages needs a public repo), then:

```bash
git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
git branch -M main
git push -u origin main
```

On GitHub: **Settings → Pages → Build and deployment**

- Source: **Deploy from a branch**
- Branch: `main` / `/ (root)`

Site URL:

`https://YOUR_USER.github.io/YOUR_REPO/`

First publish can take a minute or two.

## Preview locally

From this folder (not the parent export folder):

```bash
python3 -m http.server 8080
```

Open [http://localhost:8080/](http://localhost:8080/).

## Search

- Free text matches id, author, date, filename, caption, and keywords
- Try GIF-style words: `sleepy`, `cooking`, `angry`, `driving`, `naruto`
- `type:video`, `type:photo`, `type:sticker`
- `author:kade`
- `2026-07` for a month
- `#1244` or `1244` for a message id

Each item has a one-line caption plus 3 search keywords. The sidebar lists every keyword and its count. Click a keyword (or a tag in the lightbox) to filter.

## Weekly update

This `gallery/` folder is the website. The parent Documents folder is the latest full Telegram HTML dump, plus `gallery/` and `venv/`.

There is no `update.sh`. Do this:

1. Telegram Desktop → export the **whole** `@jotchuacontent` history as HTML → `~/Downloads` (a `ChatExport_*` folder with `messages.html`).
2. Open this project in Grok Build and say **update**.
3. Check the new cards.
4. Commit and push **this `gallery/` folder only**:

```bash
git add .
git commit -m "Add new posts"
git push
```

5. Delete the export from Downloads.

Grok replaces the parent dump (`messages.html`, `photos/`, `video_files/`, `stickers/`, `files/`, Telegram `thumbs/`, `css/`, `js/`) with the new export. It never replaces `gallery/` or `venv/`. It adds only **new Telegram message ids** to the catalog, with new thumbs and a copy of each original in `media/`. Captions and keywords already in the catalog stay as they are.

The public site URL stays the same. Each update stamps `catalog.js?v=<newest-id>` inside the page so a normal visit or reload is not stuck on last week’s catalog. An old tab left open still needs a reload.

Any Python uses the parent `venv/`, not system Python:

```bash
../venv/bin/python tools/update.py
```

New posts get a one-line caption and 3 keywords (`tools/STYLE.md`). Same idea → reuse the common existing word (`sleeping` → `sleepy`). A new subject gets a new word (`antman` is `antman`, not `batman`).

Do **not** run `tools/build.py` for weekly updates. That script is the original full rebuild.
