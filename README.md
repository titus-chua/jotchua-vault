# Jotchua meme vault

Searchable **preview** gallery for [`@jotchuacontent`](https://t.me/jotchuacontent).

This folder is the whole website. Thumbnails live here. Original photos and videos stay on Telegram — the site never hosts or links to them as files.

## What visitors get

- Grid of previews
- Left sidebar of all keywords with counts (click to filter)
- Search by id, author, date, caption, keywords
- Click a card → preview + **Open original in Telegram**

They download or watch the real file in Telegram, not from this site.

## Publish on GitHub Pages

Only this `gallery/` folder goes to GitHub. Do **not** upload `photos/`, `video_files/`, or the rest of the Telegram export.

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

## Update after a new Telegram export

Do this on your computer, next to the full export (`messages.html`, `photos/`, `video_files/`). Keep this `gallery/` folder beside those files.

```bash
python3 tools/build.py
```

Run that from `gallery/`, or `python3 gallery/tools/build.py` from the export root.

That refreshes `catalog.js`, `keywords.csv`, and `thumbs/`. Original Telegram files are only read.

Then commit and push this folder:

```bash
git add .
git commit -m "Add new posts"
git push
```

Rebuilds keep captions and keywords for ids that already exist. New posts come in untagged until you fill them.
