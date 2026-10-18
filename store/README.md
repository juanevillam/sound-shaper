# App Store screenshots

`screenshots/en-US/` and `screenshots/es-MX/` hold the listing's iPhone
screenshots at **1320 × 2868**, the 6.9" size App Store Connect requires (it
scales them down for every smaller iPhone). They are generated; never edit them
by hand.

```bash
npm run store-screenshots
```

That runs [`generate.py`](generate.py) in the brand-art venv (Pillow only) and
rewrites both folders. It needs macOS, because it sets the copy in the system's
own SF Pro (`/System/Library/Fonts/SFNS.ttf`).

## Inputs

- **`source/*.png`** — real screenshots of the app, one per listing screen.
  `source/es-MX/<same name>.png`, when present, replaces a file for the Spanish
  set only.
- **`copy.json`** — the headline and one-line subhead for each screen, in store
  order, per locale. A `\n` in a headline is a deliberate break. The generator
  refuses a line wider than the canvas instead of wrapping it, because an
  automatic wrap leaves one word alone on a line.

Headlines are copy, so they follow [`docs/standards.md`](../docs/standards.md)
→ Voice (title case in English, sentence case in Spanish, no exclamation
marks), and they say what [`docs/store-listing.md`](../docs/store-listing.md)
says.

## Retaking the screenshots

The release's quality audit will change the UI, so the sources get retaken.
When they are:

1. Capture each screen in **dark appearance**, at 09:41, full battery, full
   signal. A 6.9" device or simulator (iPhone 17 Pro Max, 1320 × 2868) is best;
   any modern iPhone works, since the screen is scaled to one fixed box.
2. **Show only artwork you have the rights to.** Apple's marketing guidelines
   ask for rights to all third-party content on screen. The first set showed
   commercial album covers and was replaced (2026-10-17) by the six original
   sounds in [`demo-audio/`](demo-audio/README.md), music and covers both
   generated there. That set was captured on an iPhone 17 Pro Max simulator
   against a temporary, uncommitted stand-in for the signed-in session and the
   library — no real account was signed in to the simulator.
3. Save them over `source/home.png`, `player.png`, `shape.png` and `clip.png`
   (or add a new entry to `copy.json` for a new screen), run the command, and
   look at every PNG before uploading.
4. For Spanish UI, capture with the device in Spanish and save into
   `source/es-MX/`. Until then the Spanish set shows English UI under Spanish
   headlines.

## Why it looks like this

It follows how Apple presents its own apps on the App Store: a short bold
headline over a calm, flat ground, an optional single-line subhead in grey, and
the real screen below, at the same place on every screen so a swipe through the
listing changes only the content. The ground and ink are the brand neutrals
(`#F5F5F5` / `#222222`); there are no gradients, badges or stickers.

**There is no device frame, on purpose.** Apple's
[marketing guidelines](https://developer.apple.com/app-store/marketing/guidelines/)
forbid illustrations of Apple products, so the only permitted frame is Apple's
official product bezel, and its licence was declined (2026-10-16). The screen is
shown with the display's own rounded corners and a faint shadow instead. If the
bezel is ever wanted, its licence forbids redistributing it on its own: it would
be downloaded locally from developer.apple.com/design/resources and kept out of
git, never committed here.
