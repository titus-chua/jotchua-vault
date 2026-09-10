#!/usr/bin/env python3
"""Refresh the parent Telegram dump and add only new posts to the gallery.

Never rewrite existing captions or keywords. Snapshot replace never touches
gallery/ or venv/. New ids get thumbs plus a copy of the original into
gallery/media/. Skip vault-website posts (see skip_ids.txt). Always run with
the project venv (re-execs into it if needed).
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
from pathlib import Path

VENV_ROOT = Path(__file__).resolve().parents[2] / "venv"
VENV_PYTHON = VENV_ROOT / "bin" / "python"


def ensure_venv() -> None:
    if not VENV_PYTHON.is_file():
        raise SystemExit(f"missing venv python: {VENV_PYTHON}")
    if Path(sys.prefix).resolve() == VENV_ROOT.resolve():
        return
    os.execv(str(VENV_PYTHON), [str(VENV_PYTHON), *sys.argv])


ensure_venv()

from build import ROOT, GALLERY, build_thumbs, copy_media, parse_messages, write_catalog

DOWNLOADS = Path.home() / "Downloads"
SKIP_IDS_PATH = Path(__file__).resolve().parent / "skip_ids.txt"
KEEP_NAMES = {"gallery", "venv", "AGENTS.md", ".git"}
SNAPSHOT_DIRS = (
    "photos",
    "video_files",
    "stickers",
    "files",
    "thumbs",
    "css",
    "js",
)


def rebuild_search(item: dict) -> None:
    bits = [
        str(item["id"]),
        item.get("type") or "",
        item.get("author") or "",
        item.get("dateLabel") or "",
        item.get("caption") or "",
        item.get("filename") or "",
        f"#{item['id']}",
        *(item.get("keywords") or []),
    ]
    item["search"] = " ".join(bit for bit in bits if bit).lower()


def find_export(explicit: str | None) -> Path:
    if explicit:
        root = Path(explicit).expanduser().resolve()
        if not (root / "messages.html").is_file():
            raise SystemExit(f"no messages.html in {root}")
        return root

    hits = [
        child
        for child in DOWNLOADS.iterdir()
        if child.is_dir() and (child / "messages.html").is_file()
    ]
    if not hits:
        raise SystemExit(f"no export with messages.html in {DOWNLOADS}")
    hits.sort(key=lambda path: path.stat().st_mtime, reverse=True)
    return hits[0]


def parse_export(root: Path) -> list[dict]:
    files = sorted(root.glob("messages*.html"))
    if not files:
        raise SystemExit(f"no messages*.html in {root}")

    items: list[dict] = []
    seen: set[int] = set()
    for html_path in files:
        raw = html_path.read_text(encoding="utf-8", errors="replace")
        for item in parse_messages(raw):
            if item["id"] in seen:
                continue
            seen.add(item["id"])
            items.append(item)
    items.sort(key=lambda row: (row["date"], row["id"]), reverse=True)
    return items


def load_catalog() -> list[dict]:
    path = GALLERY / "catalog.json"
    if not path.is_file():
        raise SystemExit(f"missing {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def replace_dir(src: Path, dest: Path) -> None:
    if dest.name in KEEP_NAMES or dest.resolve() == GALLERY.resolve():
        raise SystemExit(f"refusing to replace protected path {dest}")
    if dest.exists():
        shutil.rmtree(dest)
    if src.is_dir():
        shutil.copytree(src, dest)


def refresh_snapshot(src: Path, dest: Path) -> None:
    if src.resolve() == dest.resolve():
        print("export is already this folder, skip snapshot replace")
        return
    if not (dest / "gallery").is_dir():
        raise SystemExit(f"refusing to refresh: {dest} has no gallery/")

    for name in SNAPSHOT_DIRS:
        src_dir = src / name
        dest_dir = dest / name
        if src_dir.is_dir():
            print(f"replace {name}/")
            replace_dir(src_dir, dest_dir)
        elif dest_dir.exists():
            print(f"remove stale {name}/")
            shutil.rmtree(dest_dir)

    for old in dest.glob("messages*.html"):
        old.unlink()
    html_files = sorted(src.glob("messages*.html"))
    if not html_files:
        raise SystemExit(f"no messages*.html in {src}")
    for html_path in html_files:
        shutil.copy2(html_path, dest / html_path.name)
        print(f"replace {html_path.name}")


def load_skip_ids() -> set[int]:
    if not SKIP_IDS_PATH.is_file():
        return set()
    ids: set[int] = set()
    for line in SKIP_IDS_PATH.read_text(encoding="utf-8").splitlines():
        line = line.split("#", 1)[0].strip()
        if line.isdigit():
            ids.add(int(line))
    return ids


def merge(existing: list[dict], parsed: list[dict]) -> tuple[list[dict], list[dict]]:
    by_id = {item["id"]: item for item in existing}
    skip_ids = load_skip_ids()
    new_items: list[dict] = []
    skipped_listed: list[int] = []
    for item in parsed:
        if item["id"] in by_id:
            continue
        if item["id"] in skip_ids:
            skipped_listed.append(item["id"])
            continue
        item["caption"] = ""
        item["keywords"] = []
        rebuild_search(item)
        new_items.append(item)
        by_id[item["id"]] = item
    if skipped_listed:
        print(
            "skipped listed ids: "
            + ", ".join(str(i) for i in sorted(skipped_listed))
        )
    merged = list(by_id.values())
    merged.sort(key=lambda row: (row["date"], row["id"]), reverse=True)
    return merged, new_items


def apply_tags(path: Path) -> None:
    rows = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(rows, list):
        raise SystemExit("tag file must be a JSON array")

    catalog = load_catalog()
    by_id = {item["id"]: item for item in catalog}
    updated = 0
    skipped = 0
    missing = 0
    for row in rows:
        try:
            item_id = int(row["id"])
        except (KeyError, TypeError, ValueError):
            print(f"bad tag row: {row!r}", file=sys.stderr)
            continue
        item = by_id.get(item_id)
        if item is None:
            missing += 1
            print(f"missing id {item_id}", file=sys.stderr)
            continue
        already = bool(item.get("keywords")) or bool((item.get("caption") or "").strip())
        if already:
            skipped += 1
            continue
        item["caption"] = str(row.get("caption") or "").strip()
        item["keywords"] = [
            part.strip().lower()
            for part in (row.get("keywords") or [])
            if str(part).strip()
        ]
        rebuild_search(item)
        updated += 1

    catalog.sort(key=lambda row: (row["date"], row["id"]), reverse=True)
    write_catalog(catalog)
    print(f"applied tags: updated={updated} skipped_existing={skipped} missing={missing}")
    print(f"catalog: {len(catalog)} items")


def maybe_copy_avatar() -> None:
    src = ROOT / "photos" / "avatar.jpg"
    dest = GALLERY / "avatar.jpg"
    if src.is_file():
        shutil.copy2(src, dest)


def media_pending(merged: list[dict], new_items: list[dict]) -> list[dict]:
    new_ids = {item["id"] for item in new_items}
    pending: list[dict] = []
    for item in merged:
        rel = item.get("src") or ""
        dest = GALLERY / rel if rel else None
        if item["id"] in new_ids or not rel or dest is None or not dest.is_file():
            pending.append(item)
    return pending


def sync_media() -> None:
    catalog = load_catalog()
    stats = copy_media(catalog)
    write_catalog(catalog)
    print("media:", ", ".join(f"{k}={v}" for k, v in stats.items() if v))
    print(f"catalog: {len(catalog)} items")


def run_import(export_root: Path, dry_run: bool) -> int:
    existing = load_catalog()
    print(f"export: {export_root}")
    parsed_from = export_root
    if dry_run:
        parsed = parse_export(export_root)
    else:
        print(f"snapshot: {ROOT}")
        refresh_snapshot(export_root, ROOT)
        maybe_copy_avatar()
        parsed_from = ROOT
        parsed = parse_export(ROOT)

    if len(parsed) < 1000:
        print(f"parsed only {len(parsed)} items from {parsed_from}", file=sys.stderr)
        return 1
    if len(parsed) < len(existing) * 0.9:
        print(
            f"export looks smaller than the catalog ({len(parsed)} vs {len(existing)})",
            file=sys.stderr,
        )
        return 1

    merged, new_items = merge(existing, parsed)
    print(f"parsed: {len(parsed)}")
    print(f"catalog: {len(existing)} existing")
    print(f"new: {len(new_items)}")
    if new_items:
        ids = ", ".join(str(item["id"]) for item in sorted(new_items, key=lambda row: row["id"]))
        print(f"new ids: {ids}")

    if dry_run:
        print("dry run, snapshot and catalog not written")
        return 0

    if new_items:
        print("building thumbs for new ids...")
        stats = build_thumbs(new_items)
        print("thumbs:", ", ".join(f"{k}={v}" for k, v in stats.items() if v))

    pending = media_pending(merged, new_items)
    if pending:
        print(f"copying originals for {len(pending)} ids...")
        media_stats = copy_media(pending)
        print("media:", ", ".join(f"{k}={v}" for k, v in media_stats.items() if v))

    write_catalog(merged)
    print(f"wrote {GALLERY / 'catalog.json'}")
    if new_items:
        print("next: caption new ids using tools/STYLE.md, then --apply tags.json")
    else:
        print("nothing new")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Replace the parent Telegram dump and merge new posts without retagging old ones."
    )
    parser.add_argument(
        "--export",
        help="Path to a ChatExport folder (default: newest folder with messages.html in ~/Downloads)",
    )
    parser.add_argument(
        "--apply",
        metavar="TAGS.json",
        help="Fill caption/keywords on untagged ids only",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Parse Downloads export and diff ids; do not copy or write",
    )
    parser.add_argument(
        "--sync-media",
        action="store_true",
        help="Copy dump originals into gallery/media for catalog rows missing src; do not retag",
    )
    args = parser.parse_args()

    if args.apply:
        apply_tags(Path(args.apply).expanduser().resolve())
        return 0

    if args.sync_media:
        sync_media()
        return 0

    export_root = find_export(args.export)
    return run_import(export_root, args.dry_run)


if __name__ == "__main__":
    raise SystemExit(main())
