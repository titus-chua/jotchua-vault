#!/usr/bin/env python3
"""Parse the Telegram HTML export into a gallery catalog. Does not modify the export.

Weekly updates use update.py instead. Run both with the project venv:
`../venv/bin/python tools/update.py` from gallery/.
"""

from __future__ import annotations

import csv
import html as html_lib
import json
import re
import shutil
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from pathlib import Path

GALLERY = Path(__file__).resolve().parent.parent
SCRIPT_SRC_RE = re.compile(
    r'(<script src="(?:catalog|keywords)\.js)(?:\?v=[^"]*)?("></script>)'
)
ROOT = GALLERY.parent
HTML_PATH = ROOT / "messages.html"
THUMB_DIR = GALLERY / "thumbs"
MEDIA_DIR = GALLERY / "media"
CHANNEL = "jotchuacontent"
THUMB_MAX = 320
THUMB_QUALITY = 50
WORKERS = 8

MESSAGE_SPLIT = re.compile(r'(?=<div class="message )')
MESSAGE_HEAD = re.compile(
    r'<div class="message ([^"]*)"(?: id="message(\d+)")?>'
)
DATE_RE = re.compile(r'class="pull_right date details" title="([^"]+)"')
FROM_RE = re.compile(r'<div class="from_name">\s*(.*?)\s*</div>', re.S)
PHOTO_RE = re.compile(
    r'<a class="photo_wrap[^"]*" href="([^"]+)">'
    r'<img class="photo"[^>]*style="width: (\d+)px; height: (\d+)px"'
)
VIDEO_RE = re.compile(
    r'<a class="video_file_wrap[^"]*" href="([^"]+)">'
    r'<img class="video_file" src="([^"]*)"[^>]*style="width: (\d+)px; height: (\d+)px"'
)
DURATION_RE = re.compile(r'<div class="video_duration details">([^<]+)</div>')
STICKER_RE = re.compile(
    r'<a class="sticker_wrap[^"]*" href="([^"]+)">'
    r'<img class="sticker"[^>]*(?:style="width: (\d+)px; height: (\d+)px")?'
)
FILE_RE = re.compile(
    r'<a class="media [^"]*\bmedia_file\b[^"]*" href="([^"]+)"'
)
FILE_THUMB_RE = re.compile(r'<img class="thumb[^"]*" src="([^"]+)"')
AUDIO_RE = re.compile(
    r'<a class="media [^"]*\bmedia_audio_file\b[^"]*" href="([^"]+)"'
)
TEXT_RE = re.compile(r'<div class="text">\s*(.*?)\s*</div>', re.S)
TAG_RE = re.compile(r"<[^>]+>")
BR_RE = re.compile(r"<br\s*/?>", re.I)


def strip_html(value: str) -> str:
    value = BR_RE.sub("\n", value)
    value = TAG_RE.sub("", value)
    return html_lib.unescape(value).strip()


def parse_date(label: str) -> str:
    try:
        return datetime.strptime(label, "%d %B %Y, %H:%M:%S").strftime(
            "%Y-%m-%dT%H:%M:%S"
        )
    except ValueError:
        return ""


def rel_from_gallery(export_href: str) -> str:
    return "../" + export_href.replace("\\", "/")


def parse_messages(raw: str) -> list[dict]:
    items: list[dict] = []
    last_author = ""

    for part in MESSAGE_SPLIT.split(raw):
        head = MESSAGE_HEAD.match(part)
        if not head:
            continue

        classes, msg_id = head.group(1), head.group(2)
        if "service" in classes.split() or not msg_id:
            continue

        author = last_author
        from_m = FROM_RE.search(part)
        if from_m:
            author = strip_html(from_m.group(1))
            last_author = author
        elif "joined" not in classes:
            last_author = author

        date_m = DATE_RE.search(part)
        date_label = date_m.group(1) if date_m else ""
        caption_m = TEXT_RE.search(part)
        caption = strip_html(caption_m.group(1)) if caption_m else ""

        kind = None
        file_href = ""
        export_thumb = ""
        width = 0
        height = 0
        duration = ""

        if photo := PHOTO_RE.search(part):
            kind = "photo"
            file_href, width, height = photo.group(1), int(photo.group(2)), int(photo.group(3))
        elif video := VIDEO_RE.search(part):
            kind = "video"
            file_href = video.group(1)
            export_thumb = video.group(2)
            width, height = int(video.group(3)), int(video.group(4))
            if dur := DURATION_RE.search(part):
                duration = dur.group(1).strip()
        elif sticker := STICKER_RE.search(part):
            kind = "sticker"
            file_href = sticker.group(1)
            if sticker.group(2) and sticker.group(3):
                width, height = int(sticker.group(2)), int(sticker.group(3))
        elif audio := AUDIO_RE.search(part):
            kind = "audio"
            file_href = audio.group(1)
        elif file_m := FILE_RE.search(part):
            kind = "file"
            file_href = file_m.group(1)
            if thumb := FILE_THUMB_RE.search(part):
                export_thumb = thumb.group(1)
            suffix = Path(file_href).suffix.lower()
            if suffix in {".png", ".jpg", ".jpeg", ".webp", ".gif"}:
                kind = "photo"
        else:
            continue

        filename = Path(file_href).name
        search_bits = [
            msg_id,
            kind,
            author,
            date_label,
            caption,
            filename,
            f"#{msg_id}",
        ]
        item = {
            "id": int(msg_id),
            "type": kind,
            "date": parse_date(date_label),
            "dateLabel": date_label,
            "author": author,
            "caption": caption,
            "file": rel_from_gallery(file_href),
            "filename": filename,
            "thumb": f"thumbs/{msg_id}.jpg",
            "exportThumb": rel_from_gallery(export_thumb) if export_thumb else "",
            "width": width,
            "height": height,
            "duration": duration,
            "telegram": f"https://t.me/{CHANNEL}/{msg_id}",
            "keywords": [],
            "search": " ".join(bit for bit in search_bits if bit).lower(),
        }
        items.append(item)

    items.sort(key=lambda row: (row["date"], row["id"]), reverse=True)
    return items


def load_saved_tags() -> dict[int, dict]:
    path = GALLERY / "keywords.csv"
    saved: dict[int, dict] = {}
    if not path.is_file():
        return saved
    with path.open(encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            try:
                item_id = int(row.get("id") or "")
            except ValueError:
                continue
            caption = (row.get("caption") or "").strip()
            keywords = [
                part.strip()
                for part in (row.get("keywords") or "").split(",")
                if part.strip()
            ]
            if caption or keywords:
                saved[item_id] = {"caption": caption, "keywords": keywords}
    return saved


def apply_saved_tags(items: list[dict]) -> None:
    saved = load_saved_tags()
    for item in items:
        tag = saved.get(item["id"])
        if not tag:
            continue
        if tag["caption"]:
            item["caption"] = tag["caption"]
        if tag["keywords"]:
            item["keywords"] = tag["keywords"]
        search_bits = [
            str(item["id"]),
            item["type"],
            item["author"],
            item["dateLabel"],
            item["caption"],
            item["filename"],
            f"#{item['id']}",
            *item["keywords"],
        ]
        item["search"] = " ".join(bit for bit in search_bits if bit).lower()


def write_catalog(items: list[dict]) -> None:
    THUMB_DIR.mkdir(parents=True, exist_ok=True)
    catalog_path = GALLERY / "catalog.json"
    catalog_js = GALLERY / "catalog.js"
    csv_path = GALLERY / "keywords.csv"
    keywords_js = GALLERY / "keywords.js"

    catalog_path.write_text(
        json.dumps(items, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    catalog_js.write_text(
        "window.CATALOG = "
        + json.dumps(items, ensure_ascii=False, separators=(",", ":"))
        + ";\n",
        encoding="utf-8",
    )

    overlay = {
        str(item["id"]): item["keywords"]
        for item in items
        if item.get("keywords")
    }
    keywords_js.write_text(
        "window.KEYWORDS = "
        + json.dumps(overlay, ensure_ascii=False, separators=(",", ":"))
        + ";\n",
        encoding="utf-8",
    )

    with csv_path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(
            [
                "id",
                "telegram",
                "type",
                "date",
                "author",
                "caption",
                "keywords",
                "filename",
            ]
        )
        for item in items:
            writer.writerow(
                [
                    item["id"],
                    item["telegram"],
                    item["type"],
                    item["date"].replace("T", " "),
                    item["author"],
                    item["caption"],
                    ", ".join(item.get("keywords") or []),
                    item["filename"],
                ]
            )

    stamp_asset_urls(items)


def stamp_asset_urls(items: list[dict]) -> None:
    """Point catalog.js / keywords.js at a new query so browsers fetch this week's files.

    The public Pages URL stays the repo root. Only the script src inside index.html changes.
    """
    path = GALLERY / "index.html"
    if not path.is_file():
        return
    version = str(max((item["id"] for item in items), default=0))
    html = path.read_text(encoding="utf-8")
    updated, count = SCRIPT_SRC_RE.subn(rf"\1?v={version}\2", html)
    if count != 2:
        print(
            f"warning: stamped {count} catalog script tags in index.html, expected 2",
            file=sys.stderr,
        )
    if updated != html:
        path.write_text(updated, encoding="utf-8")


def media_rel(item: dict) -> str:
    name = item.get("filename") or item.get("file") or ""
    ext = Path(name).suffix.lower()
    if not ext:
        ext = Path(item.get("file") or "").suffix.lower()
    return f"media/{item['id']}{ext}"


def dump_file(item: dict) -> Path | None:
    rel = item.get("file") or ""
    if not rel:
        return None
    path = (GALLERY / rel).resolve()
    return path if path.is_file() else None


def copy_media(items: list[dict]) -> dict[str, int]:
    """Copy dump originals into gallery/media/{id}{ext} and set item['src'].

    Never writes to the Telegram dump. Never deletes existing media.
    """
    stats = {"ok": 0, "exists": 0, "skip": 0, "fail": 0}
    MEDIA_DIR.mkdir(parents=True, exist_ok=True)
    for item in items:
        rel = media_rel(item)
        dest = GALLERY / rel
        item["src"] = rel
        src = dump_file(item)
        if src is None:
            if dest.is_file():
                stats["exists"] += 1
            else:
                stats["skip"] += 1
                print(f"media missing dump file for {item['id']}", file=sys.stderr)
            continue
        if dest.is_file() and dest.stat().st_size == src.stat().st_size:
            stats["exists"] += 1
            continue
        try:
            shutil.copy2(src, dest)
            stats["ok"] += 1
        except OSError as exc:
            stats["fail"] += 1
            print(f"media {item['id']}: {exc}", file=sys.stderr)
    return stats


def resolve_src(item: dict) -> Path | None:
    file_path = (GALLERY / item["file"]).resolve()
    export_thumb = (
        (GALLERY / item["exportThumb"]).resolve() if item["exportThumb"] else None
    )
    if item["type"] == "video" and export_thumb and export_thumb.is_file():
        return export_thumb
    if item["type"] == "audio":
        return None
    if file_path.is_file():
        return file_path
    if export_thumb and export_thumb.is_file():
        return export_thumb
    return None


def make_thumb(item: dict) -> tuple[int, str]:
    dest = GALLERY / item["thumb"]
    dest.parent.mkdir(parents=True, exist_ok=True)
    src = resolve_src(item)
    if src is None:
        return item["id"], "skip"
    if dest.exists() and dest.stat().st_mtime >= src.stat().st_mtime:
        return item["id"], "exists"

    suffix = src.suffix.lower()
    if suffix in {".jpg", ".jpeg"} and src.parent.name == "thumbs":
        shutil.copy2(src, dest)
        return item["id"], "copy"

    cmd = [
        "sips",
        "-Z",
        str(THUMB_MAX),
        "-s",
        "format",
        "jpeg",
        "-s",
        "formatOptions",
        str(THUMB_QUALITY),
        str(src),
        "--out",
        str(dest),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        if suffix in {".jpg", ".jpeg", ".png", ".webp"}:
            shutil.copy2(src, dest)
            return item["id"], "copy-fallback"
        return item["id"], f"fail:{result.stderr.strip()[:120]}"
    return item["id"], "ok"


def build_thumbs(items: list[dict]) -> dict[str, int]:
    stats = {"ok": 0, "copy": 0, "exists": 0, "skip": 0, "fail": 0, "copy-fallback": 0}
    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        futures = [pool.submit(make_thumb, item) for item in items]
        for fut in as_completed(futures):
            _, status = fut.result()
            key = status if status in stats else "fail"
            stats[key] += 1
            if key == "fail":
                print(f"thumb {status}", file=sys.stderr)
    return stats


def main() -> int:
    if not HTML_PATH.is_file():
        print(f"missing export: {HTML_PATH}", file=sys.stderr)
        return 1

    raw = HTML_PATH.read_text(encoding="utf-8", errors="replace")
    items = parse_messages(raw)
    if len(items) < 1000:
        print(f"parsed only {len(items)} items, expected 1000+", file=sys.stderr)
        return 1

    apply_saved_tags(items)
    print("copying originals...")
    media_stats = copy_media(items)
    print("media:", ", ".join(f"{k}={v}" for k, v in media_stats.items() if v))
    write_catalog(items)
    counts: dict[str, int] = {}
    for item in items:
        counts[item["type"]] = counts.get(item["type"], 0) + 1

    avatar_src = ROOT / "photos" / "avatar.jpg"
    avatar_dest = GALLERY / "avatar.jpg"
    if avatar_src.is_file():
        shutil.copy2(avatar_src, avatar_dest)

    print(f"catalog: {len(items)} items")
    for kind, n in sorted(counts.items()):
        print(f"  {kind}: {n}")

    print("building thumbs...")
    stats = build_thumbs(items)
    print("thumbs:", ", ".join(f"{k}={v}" for k, v in stats.items() if v))
    print(f"wrote {GALLERY / 'catalog.json'}")
    print(f"wrote {GALLERY / 'keywords.csv'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
