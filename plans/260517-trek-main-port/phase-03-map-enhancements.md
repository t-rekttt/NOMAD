# Phase 3 — Map enhancements

**Source commits (5, in chronological order):**
- `9cb95bb feat(map): switch to dark tiles in dark mode`
- `b58645b feat(planner): show distance between places in day sidebar`
- `7aa9c66 feat(map): show real road paths, distance on route labels, always-visible sidebar distances`
- `d2c27b5 feat(map): dashed preview lines during route calculation with caching`
- `63e9e34 fix(map): force polyline remount for dashed-to-solid transition`

**Priority:** Low (mostly superseded — small UX deltas only)
**Status:** triage complete — only 3 small possible deltas remain
**Related task:** #3

## Triage outcome (2026-05-17)

Trek already ships the substantive features:
- ✅ `RouteCalculator.ts` with OSRM road geometry + per-leg distance/duration
- ✅ `RouteLabel` rendered on map midpoints with `walkingText` + `drivingText`
- ✅ `dashArray` styling for non-confirmed reservation overlays
- ✅ `DayPlanSidebar.tsx` displays `routeInfo: { distance, duration }` per day

Possible remaining deltas (low-confidence — verify in practice before porting):
1. **Auto-switch to dark tiles when app is in dark mode.** Trek currently lets users set `settings.map_tile_url` manually; no automatic dark-mode override.
2. **Always-visible distances for all expanded days.** Local commit `7aa9c66` made distances visible for every expanded day, not just selected. Trek's behavior here needs in-browser confirmation.
3. **Dashed preview line while OSRM is in-flight.** Local commit `d2c27b5` shows a dashed placeholder during routing then transitions to solid. Trek's current loading UX needs confirmation.

**Recommendation:** Defer until user encounters concrete UX regression. Each delta is a 15-30 min ergonomic tweak, not a porting blocker.

## Overview

Bundle of map UX improvements:
1. Dark map tiles when app is in dark mode
2. Distance labels in planner sidebar between consecutive places
3. Real road-following polylines (vs straight lines) + distance labels on route segments
4. Dashed placeholder while OSRM/routing call is in flight, with cache
5. Force-remount fix so the polyline transitions from dashed→solid cleanly

## Touchpoints (new TS paths)

- `client/src/components/Map/MapView.tsx`
- `client/src/components/Map/RouteCalculator.ts` (already TS in trek — content conflict expected)
- `client/src/components/Planner/DayPlanSidebar.tsx` (new TS name — was `.jsx`)
- Possibly a small route-cache utility module

## Per-commit pre-port questions

- Trek may already have dark-tile support. Verify before porting `9cb95bb`.
- Trek's `RouteCalculator.ts` already exists with a structure that may differ from the source — diff carefully.
- Inspect whether trek already has any per-segment distance labels (could be partial overlap).

## Steps

1. Inspect each commit (`git show <sha>` against `legacy-js-features`)
2. Diff source files vs current trek versions; identify deltas that aren't already covered
3. Implement deltas in trek's TS files
4. Squash-or-keep decision: option to land as one commit `feat(map): dark tiles, road paths, distance labels, dashed preview` rather than five
5. Browser-test: route calculation in light + dark mode, dashed-to-solid transition

## Success criteria

- Dark mode shows dark tiles
- Routes between consecutive places follow real roads (when routing succeeds)
- Distance labels visible on route segments + planner sidebar
- Dashed preview while loading, transitions cleanly to solid
- Existing tests pass; no new lint/type errors
