# Phase 2 — Docker-compose tweak

**Source commit:** `6ef09ca Comment out image in docker-compose.yml`
**Priority:** Low (likely obsolete)
**Status:** **skip — superseded by `build-from-sources` script**

## Triage outcome (2026-05-17)

Trek ships `build-from-sources` (top-level bash script) that builds client + server locally and stages assets. Trek's `docker-compose.yml` uses `image: mauriceboe/trek:latest` plus hardening (read_only, no-new-privileges, cap_drop, tmpfs) — converting it to `build: .` for a dev override loses those defaults and is a personal preference. Anyone wanting a build-from-source dev flow can run `./build-from-sources` or maintain a personal `docker-compose.override.yml`.

**Action:** none. No commit needed.
**Related task:** #2

## Overview

Original commit commented out a published `image:` field in `docker-compose.yml` so the local dev environment built from source instead of pulling. Trek's compose file has been substantially rewritten since; this phase first evaluates whether the original intent still applies, then either applies the same edit or documents why it's a no-op.

## Steps

1. `git show 6ef09ca` — re-read the exact lines
2. `diff <(git show legacy-js-features:docker-compose.yml) docker-compose.yml` — see what trek's compose looks like now
3. Decide: apply, adapt, or skip
4. If applying: commit on `main` as `chore(docker): comment out image to build from source in dev`
5. If skipping: append rationale to this phase file

## Success criteria

- Decision is documented in this file
- `docker compose config` validates cleanly
- Dev stack still spins up via the documented command
