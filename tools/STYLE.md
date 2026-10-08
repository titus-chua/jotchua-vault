# Caption + keyword style

Look at each image, video, or audio clip. Do not guess from the filename.

The dog is Jotchua (yellow lab puppy). You MAY say Jotchua in the caption. Do NOT use `jotchua`, `dog`, `puppy`, `meme`, or `crypto` as keywords. Every post is already that, so those words do not filter anything. They are fine in the caption.

`coin` is allowed when a coin, token, or stack of coins is actually the subject. Specific names stay allowed when they are the subject (`bitcoin`, `btc`, `solana`).

## Caption

- One to four sentences. Stop when the picture and its use are clear.
- Present tense. Concrete. What you see, who is in it, and the situation someone would send this meme for.
- Good: "Jotchua sits on the bed in blue pajamas, half asleep, holding milk. Send this when you are tired, napping, or done for the night."
- Bad: "A poignant meditation on childhood innocence and companionship."
- A recognizable person is named in the caption ("Sydney Sweeney").

## Keywords

- As many as are fair. Usually about 8–25. Every word must be something a person might type. No filler and no repeats.
- Lowercase. Multi-word tags are hyphenated: `thumbs-up`, `down-bad`, `sydney-sweeney`.
- Store one hyphenated form for a name or phrase. Write the spaced name in the caption. Do not also add the smashed form (`sydneysweeney`, `downbad`) or the separate pieces (`sydney`, `sweeney`). The search box already matches those pieces.
- Do not add bare `bad`, `up`, `big`, or `new`. They are too wide to click. `down` is only allowed as part of the sad cluster below.

### Clusters

The sidebar is an exact match, so synonyms that are not the start of the same word have to be stored (`nap` is not `sleepy`, `emo` is not `sad`, `woman` is not `female`).

Apply a cluster only when someone in the chat would actually send this meme for that situation. A costume with no mood gets no mood cluster. If one word from a cluster fits, add the whole cluster.

- Sad: `sad`, `upset`, `down`, `depressed`, `emo`, `down-bad`, `lonely`. Also add `crying`, `tears`, `sobbing` when crying is visible or it is a crying reaction.
- Happy: `happy`, `smile`, `smiling`, `joy`, `excited`, `wholesome`. Also add `laughing`, `lol` when someone is laughing.
- Angry: `angry`, `mad`, `rage`, `pissed`, `annoyed`.
- Good market / flex: `winning`, `success`, `bullish`, `moon`, `pump`, `rich`. Also add `money`, `cash`, `wealth` when money or riches are the joke.
- Bad market / loss: `broke`, `rekt`, `loss`, `dumped`, `bearish`, `failed`, `ngmi`. Add this with the sad cluster only when the meme reads as broke, rekt, or "I'm done," not for every quiet picture.
- Sleep: `sleep`, `sleepy`, `sleeping`, `nap`, `tired`. Also add `bedtime` when it is bed or night.
- Love: `love`, `heart`, `crush`. Add `cute` only when it is actually cute.
- Scared: `scared`, `fear`, `horror`, `creepy`.
- A woman is a salient subject: `woman`, `female`. Add `girl` only when she reads as a girl rather than an adult.
- A man is a salient human subject (not Jotchua): `man`, `male`. Add `guy` when that is how someone would search.

Use words people type. Skip thesaurus words (`melancholy`, `pensive`, `whimsical`, `lugubrious`).

### Specific words

Objects, actions, costumes, places, franchises, celebrities, games, and vehicles get their own words on top of any cluster.

Prefer a word the vault already uses when it is the same thing. A new subject gets its own word. Ant-Man is `antman`, not `batman`. Do not invent a franchise character name when the costume is not clearly that character. Tag the visible traits. Posts 1973–1975 are the same Genshin punch pose in three outfits: `genshin`, `armor`, `fist`, and the visible color, not a guessed name.

A recognizable person gets one hyphenated keyword (`sydney-sweeney`) plus the name in the caption.

### Never rewrite old posts on a weekly update

Captions and keywords already in the catalog stay as they are on a weekly ingest. New ids use this style. Rewriting an existing id is a separate requested edit and uses `update.py --overwrite`.

## Output

Write a JSON array:

```json
[
  {
    "id": 1762,
    "caption": "Jotchua sits on the bed in blue pajamas, half asleep, holding milk. Send this when you are tired or done for the night.",
    "keywords": ["pajamas", "bed", "milk", "sleep", "sleepy", "sleeping", "nap", "tired", "bedtime"]
  }
]
```

Every id in the batch must appear once. No extra commentary in the JSON file.

## Review before apply

Look at the media three times before `update.py --apply`:

1. Write the caption and keywords.
2. Review the file against the picture. Fix anything missing or unfair.
3. Review the edited file the same way. Fix again if needed.

Checklist each pass: visible facts, usable-meme test, full cluster when one word fits, no banned keywords, no invented character, no smashed duplicate of a hyphenated name.
