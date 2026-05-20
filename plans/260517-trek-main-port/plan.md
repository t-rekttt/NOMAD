# Trek/main Port Plan

**Date:** 2026-05-17
**Goal:** Adopt `trek/main` (v3.0.21, TypeScript migration) as the new base for NOMAD, and port 14 local feature commits onto the new TS codebase.

## Context

- `origin` = `t-rekttt/NOMAD` (this fork)
- `trek` = `mauriceboe/TREK` (upstream)
- Local `main` was 14 commits ahead of `trek/main`, 1127 behind. Upstream had completed a full JS→TS migration that deleted every `.js/.jsx` file the local commits touched.
- Local main has been reset to `trek/main`. The pre-reset main is preserved as branch `legacy-js-features` on origin (safety backup).
- `origin/main` has **not** been force-pushed yet; will only push after the port is verified end-to-end.

## Feature Groups (Phases)

Local commits are grouped by feature area instead of ported 1:1. Each phase = one feature area = its own implementation pass with review + test gates.

| Phase | Area | Source commits | Status |
|-------|------|----------------|--------|
| 1 | Flight routes & reservation location pickers | `e70f302` | **superseded** — trek's `reservation_endpoints` + `TransportModal` is better |
| 2 | Infra: docker-compose tweak | `6ef09ca` | **skip** — trek's `build-from-sources` script covers the intent |
| 3 | Map enhancements | `9cb95bb`, `b58645b`, `7aa9c66`, `d2c27b5`, `63e9e34` | **deferred** — mostly superseded; revisit if 3 small UX deltas bite in practice |
| 4 | Navigation PDF (Transport) | `c758247`, `0b52632`, `649ffb4`, `cbe3df5` | **DONE** — commit `9344007` |
| 5 | Places URL parsing | `ddc6119`, `856f26a`, `1eacf24` | **DONE** — commit `793eb7b` |

## Triage summary

Initial estimate of 10-20 hours of porting work has shrunk substantially. Trek has independently implemented most of what the local fork added — usually more completely:

- **Phases 1, 2:** completely superseded; no work
- **Phases 3, 5:** mostly superseded; only nuanced UX deltas remain
- **Phase 4:** the only one with substantial new feature work (per-day Navigation PDF + QR codes + Japanese romanization)

**Realistic remaining effort:** ~5-12 hours total, concentrated in Phase 4.

Phase details: see `phase-XX-*.md` files.

## Workflow per phase

1. Re-read source commits (`git show <sha>` against `legacy-js-features`)
2. Map old file paths to new TS file paths
3. Identify schema/contract deltas (DB migrations, new env vars, etc.)
4. Implement on `main`, committing per phase with `feat:` / `fix:` prefixes
5. Browser-test the feature end-to-end via Playwright
6. Mark phase complete; advance to next

## Out of scope this round

- Force-pushing `origin/main` to replace the JS history (done only after all phases ship)
- Squashing the 14 originals — they're preserved on `legacy-js-features` for reference
- Re-implementing anything that turns out to be redundant with trek/main behavior

## Risks

- Trek schema differs from local (different column names, no `departure_*`/`destination_*` columns). Migrations need careful design.
- Trek already has `airports.ts` and `places.ts` server routes — may overlap with local flight / places URL features.
- Components are 3-5× larger now; integration points must be discovered carefully, not assumed.
- Browser testing requires Caddy + dev compose stack standing up cleanly under the new codebase.
