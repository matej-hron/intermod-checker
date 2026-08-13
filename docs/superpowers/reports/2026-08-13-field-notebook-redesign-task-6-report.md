# Task 6 report — round 1/5

## Fix

Separated the fixed desktop surfaces so the update prompt and undo bar no longer share the same bottom-right slot:

- `.update-prompt` now anchors to the bottom-right on desktop.
- `.undo-bar` now anchors to the bottom-left on desktop.
- Both surfaces cap their width with `max-width: min(24rem, calc(50vw - var(--space-5)))` so they cannot overlap at 48rem+.
- Mobile offsets and safe-area handling remain unchanged.

## Evidence

- Focused static contract test: `src/ui/__tests__/fixedPromptsLayout.test.ts`
- Test result: `✓ src/ui/__tests__/fixedPromptsLayout.test.ts (2 tests) 3ms`
- Viewport check: `ALL PASS`
  - `PASS phone Setup: scroll 390 / client 390`
  - `PASS phone Results: scroll 390 / client 390`
  - `PASS phone Tune: scroll 390 / client 390`
  - `PASS phone touch targets: none under 44px`
  - `PASS tablet Setup: scroll 768 / client 768`
  - `PASS tablet Results: scroll 768 / client 768`
  - `PASS tablet Tune: scroll 768 / client 768`
  - `PASS desktop Setup: scroll 1280 / client 1280`
  - `PASS desktop Results: scroll 1280 / client 1280`
  - `PASS desktop Tune: scroll 1280 / client 1280`
- Typecheck: `npm run typecheck` passed
- Lint: `npm run lint` passed
- Build: `npm run build` passed

