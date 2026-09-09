# Lebanese Arabic — Expectancy List

A vertical, swipe-through drill for the most frequent words of spoken Lebanese
Arabic. Arabic script only, with vowel marks instead of transliteration. Static
site, no build step, no backend — it runs on GitHub Pages as-is.

**Status: proof of concept.** 10 of a planned 1000 words are in
`data/words.json`, enough to feel the interaction before the list is written.

## How it works

The feed looks like a short-video feed: one word per full screen, snap
scrolling, tap to reveal. Underneath it is not a playlist but a scheduler.

- **Recall before recognition.** The card opens with the Arabic alone. You
  commit to an answer in your head, then tap. Seeing the translation without
  that pause is the difference between studying and re-reading.
- **The order is the curriculum.** Words are served by `rank`, which is
  frequency adjusted for teachability — pronouns and the sentence frames that
  hold them come before nouns you can only use in one context. By word 10 you
  can build a sentence.
- **Answering steers the feed.** *Again* puts the word back about 3 cards
  later; *Got it* moves it 8, 20, 45, 100, 220 cards out as it survives more
  reps. The feed is infinite because reviews are woven into it, so a session
  is a mix of new words and the ones you keep dropping.
- **Intervals are counted in cards, not days.** A drill you open for four
  minutes on a bus should schedule itself in cards seen. Calendar-based
  spacing can come later without changing the interaction.
- **Every word carries a sentence.** Isolated words decay; the example gives
  the word a slot to live in, and the note explains the one thing about it
  that trips people up.

Progress lives in `localStorage` under `leb-expectancy-v1` — nothing leaves
the browser, and there is no account.

### Controls

| | |
|---|---|
| Tap card / `Space` | Reveal |
| Swipe up | Next word |
| Swipe right / `2` | Got it |
| Swipe left / `1` | Again |
| ⚙ | Vowel marks, English-first, audio, reset |

**English first** flips the card into production practice — you produce the
Arabic from the English, which is much harder and much closer to speaking.

Pronunciation uses the browser's own Arabic speech voice when the device has
one installed; it is silent rather than wrong when it doesn't. Recorded
Lebanese audio is the obvious upgrade.

## Data

`data/words.json`:

```jsonc
{
  "id": 5,              // stable identifier — progress is keyed to it
  "rank": 5,            // teaching order, drives the feed
  "unit": 1,            // grouping for future unit/checkpoint UI
  "ar": "بَدّي",         // Arabic with harakat; the app strips them on demand
  "en": "I want",
  "pos": "verb-like",
  "tags": ["verb", "core", "high-yield"],
  "note": "…",          // the grammar point worth knowing
  "msa": "أُريد",         // MSA equivalent, for learners coming from Fusha
  "example": { "ar": "بَدّي مَي.", "en": "I want water." }
}
```

Harakat are stored once and removed at render time when the toggle is off, so
there is a single source of truth per word. `id` is what progress is keyed to
— reordering `rank` later will not reset anyone's history.

## Running it

```bash
python3 -m http.server 8000    # then open http://localhost:8000
```

Opening `index.html` from the filesystem will not work: the word list is
fetched, and `file://` blocks that.

## Publishing to GitHub Pages

Settings → Pages → Source: **Deploy from a branch**, branch `main`, folder
`/ (root)`. The site is served from the repo root; `.nojekyll` keeps Jekyll
from touching it. A manual Actions workflow is also included for the
Actions-based Pages source.
