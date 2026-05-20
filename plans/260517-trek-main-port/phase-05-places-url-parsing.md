# Phase 5 — Places URL parsing (Google Maps URLs, Plus Codes, coordinates)

**Source commits (3, in chronological order):**
- `ddc6119 feat(places): support pasting Google Maps URLs, Plus Codes, and coordinates`
- `856f26a fix(places): handle www.google.com/maps URLs in parseable detection`
- `1eacf24 fix(places): extract actual place coords from !3d/!4d instead of viewport @`

**Priority:** Low (mostly superseded — 2 small deltas only)
**Status:** **DONE** (commit `793eb7b`)
**Related task:** #5

## Implementation outcome (2026-05-17)

Added Plus Code + bare-coord detection client-side in `PlaceFormModal.tsx`:
- New regexes: `PLUS_CODE_RE`, `BARE_COORDS_RE`
- New helpers: `decodePlusCode` (via `open-location-code` package), `parseBareCoords`
- `handleMapsSearch` now checks both formats before falling through to Google Maps URL detection and text search
- `mapsApi.reverse` is called to populate name + address; if it fails the coords are still accepted
- Autocomplete suggestions are suppressed for these input shapes

Bundle impact: +`open-location-code` (~5KB). No server changes.

## Triage outcome (2026-05-17)

Trek already ships:
- ✅ `isGoogleMapsUrl()` detection in `PlaceFormModal.tsx:28` (handles full URLs incl. `www.google.com/maps`)
- ✅ `mapsApi.resolveUrl()` client API at `client.ts:447`
- ✅ `resolveGoogleMapsUrl()` server in `mapsService.ts`
- ✅ `!3d/!4d` extraction at `mapsService.ts:772-774` (matches the local fix `1eacf24`)

**Real deltas remaining:**
1. **Plus Code support** — no `plus.*code` references anywhere in trek codebase. Original `ddc6119` added a Plus Code detector + resolver (likely uses Google's open-location-code library or similar). Genuine gap.
2. **Bare coordinate paste support** — original `ddc6119` accepted `"48.8566, 2.3522"`-style input. Trek's modal doesn't appear to handle this case; pasting raw coords would not auto-fill the form.

Estimated 1-2 hours: a regex detector + paste handler in `PlaceFormModal.tsx`, optional server-side resolver for Plus Codes.

## Overview

Improves the "Add Place" flow so the user can paste:
- Google Maps URLs (full or shortened, `goo.gl/maps/...`, `www.google.com/maps/...`)
- Plus Codes (e.g. `8FW4V75V+8Q`)
- Bare coordinate pairs (lat, lng)

…and the form auto-populates with the resolved place. Includes follow-up fixes for `www.google.com/maps` detection and for picking the `!3d/!4d` place coordinates over the map-viewport `@lat,lng,zoom` coordinates.

## Touchpoints (new TS paths)

- `client/src/components/Planner/PlaceFormModal.tsx` (already TS; has content conflict from earlier merge attempt)
- Possibly `server/src/routes/maps.ts` if URL resolution requires a server proxy (`mapsApi.resolveUrl` exists per client.ts — verify it covers the needed parsing)
- New utility module candidate: `client/src/utils/parse-place-input.ts`

## Pre-port questions

- Trek's `mapsApi.resolveUrl` exists (`client/src/api/client.ts:447`) — does the server route already handle short-URL redirects + `!3d/!4d` extraction? If yes, much of this phase is already done upstream and only the paste-handler glue needs porting.
- Plus Code parsing may be a separate concern — check whether trek has any Plus Code support
- The original commit chain has fix-on-fix patterns — port the **end-state behavior** of all three, not three intermediate states

## Steps

1. Scout: read trek's `server/src/routes/maps.ts` resolve-url implementation thoroughly
2. Diff source state of `PlaceFormModal.jsx` (post-`1eacf24`) vs trek's `PlaceFormModal.tsx`
3. Extract parse logic into a typed utility module
4. Wire paste handler into trek's modal
5. Browser-test all 4 paste types: full URL, short URL, Plus Code, bare coords

## Success criteria

- Pasting any of the 4 input types into the Place name (or a dedicated paste field) auto-fills name + lat + lng
- `!3d/!4d` coordinates win over `@lat,lng,zoom` viewport coordinates
- `www.google.com/maps/...` URLs are detected as parseable
- No regression: normal typing-name flow unchanged
- Existing tests pass; no new lint/type errors
