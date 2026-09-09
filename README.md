# Lebanese Arabic — Expectancy List

A vertical, swipe-through drill for the 100 most useful words of spoken
Lebanese Arabic. Fully vowelled Arabic script, no transliteration anywhere.
Static site, no build step, no backend — it runs on GitHub Pages as-is.

All 100 words are written, in `data/words.json`. Masculine and feminine forms
count as separate words, because they are separate things to memorize:
إِنْتَ and إِنْتِ are two cards, scheduled independently, and each one says on its
face which it is.

## How it works

The feed looks like a short-video feed: one word per full screen, snap
scrolling, tap to reveal. Underneath it is not a playlist but a scheduler.

- **Recall before recognition.** The card opens with the Arabic alone. You
  commit to an answer in your head, then tap. Seeing the translation without
  that pause is the difference between studying and re-reading.
- **The order is the curriculum.** Words are served by `rank`, which is
  frequency adjusted for teachability — pronouns and the sentence frames that
  hold them come before nouns you can only use in one context. By word 10 you
  can build a sentence; the ten units each add one thing you can newly do.
- **Answering steers the feed.** *Again* puts the word back about 4 cards
  later; *Got it* moves it 12, 30, 70, 150, 300 cards out as it survives more
  reps. The feed is infinite because reviews are woven into it, so a session
  is a mix of new words and the ones you keep dropping.
- **New words and reviews alternate.** Reviews do not get to win every slot.
  Left to compete freely they starve new material within a dozen cards — you
  answer word 1 correctly and meet it again before you have met word 9. Odd
  slots go to reviews (a word you just failed picks first), even slots to the
  next unseen word, so roughly half of any session is new ground.
- **Intervals are counted in cards, not days.** A drill you open for four
  minutes on a bus should schedule itself in cards seen. Calendar-based
  spacing can come later without changing the interaction.
- **Every word carries a sentence.** Isolated words decay; the example gives
  the word a slot to live in, and the note explains the one thing about it
  that trips people up.
- **Vowel marks do the work transliteration usually does.** Every Arabic
  string carries full tashkeel — fatha, kasra, damma, sukun, shadda — so a
  beginner can read a word aloud without ever being shown a Latin spelling.
  Words whose written form lies about their Lebanese pronunciation (قَدِّيش,
  قَهْوِة, وَقِت — the ق is a catch in the throat) carry a short pronunciation
  note instead.

The counter reads **learned** and **met**: met rises the first time you reveal
a word, learned once you have answered it correctly twice running. The bar
carries both — a dim fill for met, a bright one for learned — so it responds
from the very first card instead of sitting at zero until something is
mastered.

Progress lives in `localStorage` under `leb-expectancy-v2` — nothing leaves
the browser, and there is no account.

### Controls

| | |
|---|---|
| Tap card / `Space` | Reveal |
| Swipe up | Next word |
| Swipe right / `2` | Got it |
| Swipe left / `1` | Again |
| ⚙ | Vowel marks, English-first, reset |

**English first** flips the card into production practice — you produce the
Arabic from the English, which is much harder and much closer to speaking.

Turning **vowel marks** off strips the harakat at render time and leaves the
bare consonant skeleton people actually text in — the same word, read the hard
way. There is no audio: browser speech voices are Modern Standard and get
Lebanese wrong, so the app would rather say nothing than teach the wrong sound.

## Data

`data/words.json`:

```jsonc
{
  "id": 3,              // stable identifier — progress is keyed to it
  "rank": 3,            // teaching order, drives the feed
  "unit": 1,            // one of ten units, each a thing you can newly do
  "ar": "إِنْتِ",          // full tashkeel; the app strips it on demand
  "en": "you (speaking to a woman)",
  "pos": "pronoun",
  "form": "f",          // optional — renders as a masculine/feminine badge
  "pair": 2,            // optional — the id of the opposite-gender form
  "note": "…",          // the grammar point worth knowing
  "pron": "…",          // optional — only when the spelling misleads
  "example": { "ar": "إِنْتِ مِن وَيْن؟", "en": "Where are you from?" }
}
```

Harakat are stored once and removed at render time when the toggle is off, so
there is a single source of truth per word. `id` is what progress is keyed to
— reordering `rank` later will not reset anyone's history. `form` and `pair`
are what make a gendered pair two words rather than one word with a slash:
each is scheduled on its own, and `pair` keeps the link for a future
side-by-side view.

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
