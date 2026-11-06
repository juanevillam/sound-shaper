# The audit playbook — five commands, and the order they run in

> **iOS ONLY SINCE 2026-11-04.** Android is gone from the portfolio (see
> AGENTS.md → "Platform"), so `/portfolio-native-parity` is DELETED and every
> phase below that brings Android anywhere is history. The order that is
> left, per app, on iOS alone:
>
> ```
> /portfolio-craft-audit   <app> ios   # lock the surfaces
> /portfolio-data-audit    <app>       # prune what it asks for
> /portfolio-cache-audit   <app>       # bank what remains
> /portfolio-quality-audit <app>       # gate the release, last
> ```
>
> The web has its own six `web-*` audits, in its own repo.

The five audits live in `.claude/commands/`, ported from the portfolio monorepo
on 2026-10-17 with their substance unchanged — only paths, names and checks
that no longer exist were adapted to this repo's layout (`src/ui`, `src/core`,
`src/trophies`, `modules/widget-bridge`, `patches/`). They keep their
`portfolio-` names so the history in `AGENTS.md` still reads.

| command                    | the moment                                             | scope        |
| -------------------------- | ------------------------------------------------------ | ------------ |
| `/portfolio-craft-audit`   | a big chunk of rework just landed                      | one platform |
| `/portfolio-data-audit`    | UI done; what does it cost the network while it works  | the app      |
| `/portfolio-cache-audit`   | UI done; what does it relearn that it already knew     | the app      |
| `/portfolio-native-parity` | one platform is the reference, the other must catch up | both         |
| `/portfolio-quality-audit` | a release is next                                      | everything   |

## The order, and why

```
/portfolio-craft-audit ios        # 1  lock the iOS reference
/portfolio-craft-audit web        #    and the web front end
/portfolio-data-audit             # 2  prune the asking (the shared layer)
/portfolio-cache-audit            # 3  bank what remains — never cache a call you should have deleted
/portfolio-quality-audit          # 4  release gate 3, LAST — its one shot per release
```

- **Craft first** because structure moves code, which would invalidate the
  line-level findings of the audits after it, and because iOS is the reference
  everything else is measured against.
- **Data before cache**: the data audit decides which calls exist at all.
- **Parity's closing pass** hunts what the others leave: a `.ios` file taking a
  prop it ignores, a constant nobody imports, behaviour on one side only. The
  full four-stage Phase B (parity → craft → Juan's manual sweep → parity) ran
  in the monorepo and closed on 2026-09-11; what has landed since (the offline
  mirror, the widget, Sign in with Apple, the extraction, the team change) is
  what a re-run reads.
- **Quality last**, after both platforms have settled and the release config
  it audits exists. It is gate 3 in [`release.md`](release.md).

## Standing rules that outrank the order

- **Report-first, always.** Every audit stops for Juan's go before touching
  code; the order sequences the READING, not a licence to fix.
- **A finding outside an audit's moment is still recorded** — handed to the
  audit whose moment it is, not silently fixed out of scope.
- **Behaviour is Juan's call.** What the app DOES is reported, never changed by
  an audit.
