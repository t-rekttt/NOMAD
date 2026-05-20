# Phase 4 — Navigation PDF (Transport)

**Source commits (4, in chronological order):**
- `c758247 feat(transport): add QR navigation and transport instruction PDF`
- `0b52632 feat(transport): add Japanese street romanization and fix day tag duplicate`
- `649ffb4 fix(transport): empty street placeholder, button spacing, rename to Navigation PDF`
- `cbe3df5 feat(transport): add whole-day QR code to Navigation PDF`

**Priority:** **High — genuinely net-new feature, largest port effort**
**Status:** pending — real work required
**Related task:** #4

## Triage outcome (2026-05-17)

Trek does NOT have:
- ❌ A per-day Navigation PDF with QR codes (trek has `TripPDF.tsx` and `JourneyBookPDF.tsx` but neither is a per-leg navigation export)
- ❌ Japanese street name romanization (no kuromoji or romaji in deps)
- ❌ Whole-day combined QR code in any export

Trek does have:
- ✅ `@react-pdf/renderer` already in deps
- ✅ Transport reservations rendered in `TripPDF.tsx`
- ✅ `RouteCalculator.ts` for OSRM road geometry (reusable for PDF leg data)

This phase is the **only one with substantial net-new work**. Estimated 4-8 hours focused work.

## Overview

Whole-new feature on the original branch: per-day PDF of navigation instructions with QR codes that open Google Maps directions on the user's phone, including a whole-day combined QR. Adds a Japanese street name romanization utility on the server (kuromoji-based) for legible PDF rendering.

## Source surface analysis (post-triage)

After reading source end-state on `legacy-js-features`:

**Client side (TransportPDF.jsx, 425 lines):**
- Builds an HTML+CSS string, opens a print window, lets user save-as-PDF (no `@react-pdf/renderer` needed — straight HTML print)
- Two exported functions: `downloadTransportPDF` (per-day) and `downloadTripTransportPDF` (whole trip)
- Calls `/api/romanize` to romanize non-Latin street names server-side (kuromoji runs on Node, NOT in browser)
- Imports from `RouteCalculator`: `calculateSegmentsWithSteps`, `generateLegUrl`, `generateQrDataUrl`, `generateGoogleMapsUrl`

**Server side (romanize.js, ~60 lines):**
- Lazy-loads kuromoji tokenizer (uses dict bundled inside `node_modules/kuromoji/dict`)
- `POST /api/romanize` taking `{ texts: string[] }`, returning `{ results: { [text]: romanizedText } }`
- Uses `wanakana` for kana → romaji

**RouteCalculator.ts deltas to add:**
- `generateLegUrl(from, to, mode)` — Google Maps directions URL for one leg
- `generateQrDataUrl(text, size)` — async QR code data URL via `qrcode` package
- `calculateSegmentsWithSteps(waypoints)` — `calculateSegments` + turn-by-turn `steps` array
- Export `formatDistance` and `formatDuration` (currently internal in trek)

**Dependencies needed:**
- Client: `qrcode` (only — NOT kuromoji/wanakana/buffer/zlib/etc; those were dead detritus in legacy)
- Server: `kuromoji` + `wanakana`
- Dict files (`client/public/dict/*.dat.gz`, ~20MB) in legacy branch are **dead** — kuromoji uses its own bundled dict on the server. Do NOT commit.

**DayPlanSidebar.tsx wiring:** Add button next to the existing "Download Trip PDF" button (line ~485 in current `DayPlanSidebar.tsx`). Icon = `Route` from `lucide-react` (already imported). Calls `downloadTripTransportPDF` for the whole trip, `downloadTransportPDF` for a single day.

## Naming decision

Source commits drift from `Transport PDF` (commit c758247) to `Navigation PDF` (commit 649ffb4 final rename). **Use `NavigationPDF.tsx`** as the final filename, with `downloadNavigationPDF` / `downloadTripNavigationPDF` exports — matches the final user-visible label.

## Decisions to flag for user

1. **`@react-pdf/renderer` (trek pattern) vs print-window HTML (legacy pattern):** Legacy uses HTML+`window.print()` which sidesteps the heavy `@react-pdf/renderer` for this use case. Stick with the lighter print-window pattern — simpler to port and visually closer to the original.
2. **File path for new component:** `client/src/components/PDF/NavigationPDF.tsx` (matches existing PDF folder).
3. **Skip the dead dict files** (`client/public/dict/`) — they are unused; server-side kuromoji has its own dicts.
4. **Day-tag duplicate fix** from commit `0b52632` — this is a bug in the original JSX `DayPlanSidebar` (some tag rendering duplicated for transport segments). Trek's TS version may not have the bug at all. Verify before porting.

## Implementation steps (ordered)

### Server first
1. `cd server && npm install kuromoji wanakana` — add deps
2. Create `server/src/routes/romanize.ts` (port from legacy with TS types + ESM imports). Lazy-load tokenizer, batch endpoint, graceful failure (return empty results object on tokenizer load failure rather than 500).
3. Register route in `server/src/index.ts` (find where other routes are mounted; add `/api/romanize` mount).
4. Add a server test or smoke-check: POST `{texts: ["渋谷区道玄坂"]}` and verify romaji result.

### Client utilities
5. `cd client && npm install qrcode @types/qrcode` — add dep + types
6. Extend `client/src/components/Map/RouteCalculator.ts`:
   - Add `generateLegUrl(from: Coord, to: Coord, mode?: 'driving' | 'walking'): string`
   - Add `generateQrDataUrl(text: string, size?: number): Promise<string>` using `qrcode.toDataURL`
   - Add `calculateSegmentsWithSteps(waypoints, opts?)` — extends `calculateSegments` with OSRM `steps=true`
   - Export `formatDistance` and `formatDuration` (currently file-private)

### Client component
7. Create `client/src/components/PDF/NavigationPDF.tsx`:
   - Port `batchRomanize` helper (fetches `/api/romanize`)
   - Port `hasNonLatin`, `escHtml`, `shortDate`, `placeLabel`, `buildLegHtml` helpers (with TS types)
   - Export `downloadNavigationPDF({ day, assignments, places, t, locale })` and `downloadTripNavigationPDF({ trip, days, assignments, places, t, locale })`
   - Use print window pattern (NOT `@react-pdf/renderer`)
   - Handle empty-street placeholder from commit `649ffb4` (`s.street || '—'`)

### Wire button
8. Edit `client/src/components/Planner/DayPlanSidebar.tsx`:
   - Add `import { downloadNavigationPDF, downloadTripNavigationPDF } from '../PDF/NavigationPDF'`
   - Add button next to existing `Download Trip PDF` button (~line 485). Icon `Route`. Title "Navigation PDF". `onClick` calls `downloadTripNavigationPDF`.
   - Optionally: add per-day button into the day header expand-state for `downloadNavigationPDF`.

### i18n
9. Add `dayplan.navigationPdf` key to `client/src/i18n/translations/en.ts` (and `de.ts` if straightforward).

### Validate
10. Type-check + lint: `cd client && npx tsc --noEmit && npx eslint src/components/PDF/NavigationPDF.tsx` and same for server.
11. Run existing tests: `cd client && npm test -- --run` and `cd server && npm test -- --run`
12. Manual: spin up dev stack via docker compose (Caddy reverse-proxy on :4200 per project conventions), log in, create a trip with consecutive places, click Navigation PDF button, verify PDF renders with QR codes + route segments.
13. Japanese test: place name containing a kanji street (e.g. `東京都渋谷区道玄坂`), verify romanized variant appears in PDF.

## Todo list

- [ ] Add server deps (`kuromoji`, `wanakana`)
- [ ] Create `server/src/routes/romanize.ts`
- [ ] Register route in `server/src/index.ts`
- [ ] Add client dep (`qrcode` + `@types/qrcode`)
- [ ] Extend `RouteCalculator.ts` with 3 new exports + export `formatDistance`/`formatDuration`
- [ ] Create `NavigationPDF.tsx`
- [ ] Wire button(s) in `DayPlanSidebar.tsx`
- [ ] Add `dayplan.navigationPdf` i18n keys (`en.ts` + `de.ts`)
- [ ] Type-check + lint server and client
- [ ] Run existing test suites
- [ ] Browser smoke test: empty trip, single-day trip, Japanese street name
- [ ] Single commit: `feat(transport): add per-day Navigation PDF with QR codes + JP street romanization`

## Success criteria

- "Navigation PDF" button visible in DayPlanSidebar, downloads a PDF
- PDF contains per-leg QR codes that open Google Maps directions on phone scan
- Whole-day combined QR included at the bottom of the trip PDF
- Japanese street names appear in Romaji alongside the original
- Empty street fields render a placeholder (`—`), not "undefined"
- All existing tests pass; no new lint/type errors anywhere
- Bundle-size delta on client: only +qrcode (~30KB gz) — no kuromoji on client
