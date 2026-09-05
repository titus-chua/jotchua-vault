# Caption + keyword style

Look at each image. Do not guess from the filename.

The dog is Jotchua (yellow lab puppy). You MAY say Jotchua in the caption. Do NOT use jotchua, dog, puppy, meme, crypto, or coin as keywords — every post is that.

## Caption

- One line, about 6–12 words
- Short and sweet, what you see
- Present tense
- Good: "Jotchua in blue pajamas holding milk"
- Bad: "A poignant meditation on childhood innocence and companionship"

## Keywords

- Exactly 3
- Lowercase, GIF/sticker search style: sad, cooking, angry, driving, thumbs-up
- Hyphenate: thumbs-up, side-eye, super-saiyan
- People would type these to find the meme
- Pick the most searchable things: emotion, action, costume, object
- No deep English (no melancholy, pensive, whimsical)

### Reuse vs new

Sidebar search is exact on the keyword. Prefer one common word for the **same idea** so counts stay useful and the community learns the list.

Reuse an existing keyword when it is a synonym or a stopword-ish variant:

- sleep, sleeping → `sleepy`
- cash → `money` (if the meme is just “rich / cash”, not a distinct thing)

Do **not** force a new subject onto a nearby old word. If the meme is actually something the vault does not have, add the new keyword.

- Ant-Man costume → `antman` (not `batman` or `superman`)
- A new franchise, object, or costume keeps its own word

Use judgement. The existing list is a preference, not a whitelist.

### Never rewrite old posts

Captions and keywords already in the catalog stay as they are, even if they used a synonym you would not pick today. Normalization applies to **new** posts only.

## Output

Write a JSON array:

```json
[
  {"id": 1762, "caption": "Jotchua in blue pajamas holding milk with a frog and cat", "keywords": ["pajamas", "sleepy", "bedtime"]}
]
```

Every id in the batch must appear once. No extra commentary in the JSON file.
