# Phase 1 — Flight routes & reservation location pickers

**Source commit:** `e70f302 feat: add flight route arcs and departure/destination location pickers`
**Priority:** High (first phase, sets the schema-migration pattern for later phases)
**Status:** **SUPERSEDED BY UPSTREAM — no implementation work required**
**Related task:** #1

## Outcome: superseded

Discovered during scout that trek/main already ships the same feature, more comprehensively:

- **DB**: migration 109 adds `reservation_endpoints` table with `role`, `sequence`, `name`, `code` (IATA), `lat`, `lng`, `timezone`, `local_time`, `local_date` — supports flights AND trains, cars, cruises (4 types vs 1)
- **Server**: `reservationService.ts` loads/saves endpoints via `saveEndpoints` / `loadEndpoints` (lines 64-80, 110-114, 162-225, 296-399)
- **Client modal**: `TransportModal.tsx` (separate from `ReservationModal.tsx`) implements `AirportSelect` picker for flights + generic location picker for other transport types
- **Client map**: `ReservationOverlay.tsx` + `reservationsMapbox.ts` render endpoints with connections
- **Day sidebar**: `DayPlanSidebar.tsx` toggles endpoint connections (line 1480, 1744)

Trek's implementation uses the same `airportsApi.search` we'd have chosen, plus stores timezone + IATA + local times — strictly more capable than the original 6-column flat schema.

**Action taken:** none. Phase marked complete-by-upstream.

## Context links

- Source commit (on `legacy-js-features` branch): `e70f302`
- Source diff: see `git show e70f302`
- Trek HEAD on `main`: `bfe6664 chore: bump version to 3.0.21 [skip ci]`

## Overview

Original local commit added flight-specific departure/destination location pickers to the reservation modal, persisted lat/lng to the DB, and rendered a great-circle arc with a plane marker between them on the map. This phase reimplements the same UX on top of trek/main's TypeScript codebase.

## Source change summary (from `legacy-js-features`)

7 files, +257/-9:
- `client/src/components/Map/MapView.jsx` (+56) — great-circle arc + plane emoji marker at midpoint
- `client/src/components/Planner/ReservationModal.jsx` (+143) — `LocationSearchInput` component, departure/destination inputs shown when `type === 'flight'`, mapped to flat `departure_*`/`destination_*` fields on save
- `client/src/i18n/translations/{de,en}.js` (+4 each) — `reservations.departure`, `reservations.destination`, `*Placeholder` keys
- `client/src/pages/TripPlannerPage.jsx` (+14) — pass new fields through reservation save handler
- `server/src/db/database.js` (+15) — `ALTER TABLE reservations ADD COLUMN departure_name TEXT` ×6
- `server/src/routes/reservations.js` (+30) — accept/return `departure_*`/`destination_*` columns

## Key insights from scouting trek/main

1. **Trek already has `airportsApi.search`** (`client/src/api/client.ts:451`) with IATA + airport-name lookup. Better fit for flights than the original's generic `mapsApi.search` (OSM/Nominatim).
2. **Trek has `mapsApi.search` too** — fallback path is available if airport search misses.
3. **`reservations` schema differs**: columns are `reservation_time`, `reservation_end_time`, `type`, `accommodation_id` (already exists), `location`, `status`. NO `departure_*`/`destination_*` columns yet.
4. **Migration system**: trek uses `server/src/db/migrations.ts` + `schema.ts` (`migrations.ts` runs ALTERs on existing DBs; `schema.ts` is for fresh DB creation). Both must be updated.
5. **`ReservationModal.tsx` is 33KB** (vs original 8KB JSX) — file is heavily restructured. Integration points to find: form state, save handler, conditional fields by type.
6. **`MapView.tsx` is 24KB** (vs original ~10KB) — already renders many marker/polyline types. Need to find the right insertion point for the arc layer.

## Design decision (resolved 2026-05-17)

**Picker uses `airportsApi.search`.** Trek's dedicated airports route (IATA + airport-name lookup) is the cleaner fit for flight reservations than the original's generic OSM/Nominatim search. Selected airport's lat/lng + display name are stored in the new `departure_*` / `destination_*` columns.

## Requirements

### Functional
- When `reservation.type === 'flight'`, render two location pickers labelled departure / destination
- Picker is a search input with debounced typeahead, dropdown of matches, click-to-select, clear button
- Selected location persists name + lat + lng to DB
- Reservations with both endpoints render a polyline / arc between them on `MapView.tsx`
- Plane emoji or comparable marker at midpoint of arc, tooltip with route info
- i18n keys added in at least `en.ts` and `de.ts` (15 languages exist; ship `en` always; others optional this phase)

### Non-functional
- TS-clean: no `any` for new fields, no `@ts-ignore`
- New DB migration is idempotent (`ADD COLUMN IF NOT EXISTS`-style or guarded by checks already used in `migrations.ts`)
- No regression to existing reservation flows (non-flight types still save/load unchanged)
- Test stays green: `server/src/...` and `client/src/...` test files must pass after change

## Touchpoints (new TS paths)

**Server:**
- `server/src/db/schema.ts` — add 6 columns inside `CREATE TABLE reservations`
- `server/src/db/migrations.ts` — add migration entry for existing DBs
- `server/src/routes/reservations.ts` — accept new fields in POST/PUT, return them in GET

**Client:**
- `client/src/api/client.ts` — verify `Reservation` type (if exported) covers new fields; otherwise the call sites use `Record<string, unknown>`
- `client/src/components/Planner/ReservationModal.tsx` — add `LocationSearchInput` (extracted as separate file recommended: `client/src/components/Planner/LocationSearchInput.tsx`), wire form state for departure/destination, conditionally render under `type === 'flight'`
- `client/src/components/Map/MapView.tsx` — add great-circle arc layer + plane marker for flight reservations with both endpoints
- `client/src/pages/TripPlannerPage.tsx` — pass-through for new fields in save flow (likely already generic via spread; verify)
- `client/src/i18n/translations/en.ts` and `de.ts` — add 4 new keys

**Tests to verify (not edit unless port adds new behavior):**
- `client/src/components/Planner/ReservationModal.test.tsx`
- `client/src/pages/TripPlannerPage.test.tsx`
- `client/src/components/Map/MapView.test.tsx`

## Implementation steps

1. **Schema:** edit `schema.ts` to add 6 columns to the `reservations` table; edit `migrations.ts` with a new entry adding the columns to existing DBs
2. **Server route:** update `reservations.ts` to include the new columns in select, insert, update SQL — preserve existing column ordering
3. **Client type:** if a `Reservation` interface exists in the shared client types, extend it
4. **New component:** create `LocationSearchInput.tsx` — TS-clean rewrite of the original JSX, using the chosen search API (A/B/C per design decision)
5. **Modal integration:** in `ReservationModal.tsx`, add departure/destination state + conditional render block, wire save handler to flatten nested location objects into `departure_*` / `destination_*` columns
6. **Map arc:** in `MapView.tsx`, find existing reservation rendering, add great-circle arc + plane marker for flights with both lat/lng pairs
7. **i18n:** add 4 keys to `en.ts` + `de.ts`
8. **Run tests:** `cd client && npm test -- --run` and `cd server && npm test -- --run`
9. **Browser test:** spin up dev stack (docker compose), create a flight reservation, pick departure + destination, verify arc renders, plane marker visible, page reload preserves locations

## Todo list

- [ ] Resolve design decision (A / B / C) with user
- [ ] Add schema columns to `schema.ts`
- [ ] Add migration entry in `migrations.ts`
- [ ] Update `reservations.ts` route handlers (select/insert/update)
- [ ] Create `LocationSearchInput.tsx`
- [ ] Wire fields into `ReservationModal.tsx` form + save
- [ ] Render arc + plane marker in `MapView.tsx`
- [ ] Add i18n keys in `en.ts` and `de.ts`
- [ ] Run server tests
- [ ] Run client tests
- [ ] Browser-test end to end (create / load / map render)
- [ ] Commit on `main` as `feat: add flight route arcs and departure/destination location pickers`

## Success criteria

- All existing tests pass; no new lint/type errors anywhere
- Creating a flight reservation with both endpoints persists them across reload
- Map renders an arc between endpoints with a plane marker at midpoint
- Non-flight reservation types unaffected
- Migration runs cleanly on a DB created from previous schema versions

## Risk assessment

- **Schema collision risk** — low. Confirmed no `departure_*` columns currently exist.
- **Form-state shape risk** — medium. New `ReservationModal.tsx` may already use a normalized form schema; flat columns vs nested form must be reconciled.
- **Map perf risk** — low. One extra polyline per flight reservation is negligible.
- **i18n drift risk** — low. Other 13 languages get untranslated English keys; trek likely already has a fallback pattern.

## Security considerations

- Lat/lng inputs are user-provided floats; validate as `number` and within bounds on the server (-90..90, -180..180) to avoid garbage in DB.
- `LocationSearchInput` calls `mapsApi.search` or `airportsApi.search` — both already authenticated routes per trek's existing pattern; no new auth surface introduced.

## Next steps

After this phase ships green: unblock Phase 2 (docker-compose tweak — quick evaluate/apply/skip).
