#!/usr/bin/env python3
"""Check a retag file against the cluster rules in STYLE.md.

Does not write the catalog. Run with the project venv:
`venv/bin/python gallery/tools/lint_tags.py path/to/tags.json`
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

GALLERY = Path(__file__).resolve().parent.parent
BANNED = {"jotchua", "dog", "puppy", "meme", "crypto", "bad", "up", "big", "new"}

CLUSTERS = {
    "sad": ["sad", "upset", "down", "depressed", "emo", "down-bad", "lonely"],
    "happy": ["happy", "smile", "smiling", "joy", "excited", "wholesome"],
    "angry": ["angry", "mad", "rage", "pissed", "annoyed"],
    "flex": ["winning", "success", "bullish", "moon", "pump", "rich"],
    "loss": ["broke", "rekt", "loss", "dumped", "bearish", "failed", "ngmi"],
    "sleep": ["sleep", "sleepy", "sleeping", "nap", "tired"],
    "love": ["love", "heart", "crush"],
    "scared": ["scared", "fear", "horror", "creepy"],
    "woman": ["woman", "female"],
    "man": ["man", "male"],
}
IMPLIES = {
    "crying": ["crying", "tears", "sobbing", *CLUSTERS["sad"]],
    "tears": ["crying", "tears", "sobbing", *CLUSTERS["sad"]],
    "sobbing": ["crying", "tears", "sobbing", *CLUSTERS["sad"]],
    "laughing": ["laughing", "lol", *CLUSTERS["happy"]],
    "lol": ["laughing", "lol", *CLUSTERS["happy"]],
    "money": ["money", "cash", "wealth"],
    "cash": ["money", "cash", "wealth"],
    "wealth": ["money", "cash", "wealth"],
    "bedtime": [*CLUSTERS["sleep"], "bedtime"],
    "girl": [*CLUSTERS["woman"], "girl"],
    "guy": [*CLUSTERS["man"], "guy"],
}


def problems_for(row: dict) -> list[str]:
    issues: list[str] = []
    try:
        item_id = int(row["id"])
    except (KeyError, TypeError, ValueError):
        return ["bad id"]
    caption = str(row.get("caption") or "").strip()
    raw = row.get("keywords")
    if not caption:
        issues.append("empty caption")
    if not isinstance(raw, list) or not raw:
        issues.append("keywords must be a non-empty list")
        return [f"{item_id}: {item}" for item in issues]
    words: list[str] = []
    seen: set[str] = set()
    for part in raw:
        word = str(part).strip().lower()
        if not word:
            issues.append("blank keyword")
            continue
        if word != str(part).strip() or word != str(part).strip().lower():
            issues.append(f"not lowercase: {part}")
        if word in seen:
            issues.append(f"duplicate: {word}")
        seen.add(word)
        words.append(word)
        if word in BANNED:
            issues.append(f"banned: {word}")
    have = set(words)
    for name, group in CLUSTERS.items():
        hit = have.intersection(group)
        if hit and hit != set(group):
            missing = [word for word in group if word not in have]
            issues.append(f"incomplete {name}: missing {', '.join(missing)}")
    for trigger, required in IMPLIES.items():
        if trigger in have:
            missing = [word for word in required if word not in have]
            if missing:
                issues.append(f"{trigger} missing {', '.join(missing)}")
    return [f"{item_id}: {item}" for item in issues]


def main() -> int:
    if len(sys.argv) != 2:
        print(f"usage: {sys.argv[0]} TAGS.json", file=sys.stderr)
        return 2
    path = Path(sys.argv[1])
    rows = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(rows, list):
        print("tag file must be a JSON array", file=sys.stderr)
        return 1

    catalog_ids = {
        item["id"]
        for item in json.loads((GALLERY / "catalog.json").read_text(encoding="utf-8"))
    }
    seen_ids: set[int] = set()
    issues: list[str] = []
    for row in rows:
        try:
            item_id = int(row["id"])
        except (KeyError, TypeError, ValueError):
            issues.append(f"bad row: {row!r}")
            continue
        if item_id in seen_ids:
            issues.append(f"{item_id}: duplicate id")
        seen_ids.add(item_id)
        if item_id not in catalog_ids:
            issues.append(f"{item_id}: not in catalog")
        issues.extend(problems_for(row))

    # A full-vault file should cover every id. A batch file will not.
    if seen_ids == catalog_ids or len(seen_ids) > len(catalog_ids) * 0.9:
        missing_ids = sorted(catalog_ids - seen_ids)
        if missing_ids:
            issues.append(f"missing {len(missing_ids)} catalog ids, first {missing_ids[:12]}")

    if issues:
        print(f"{len(issues)} problems in {path}")
        for line in issues:
            print(line)
        return 1
    print(f"ok {len(rows)} rows in {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
