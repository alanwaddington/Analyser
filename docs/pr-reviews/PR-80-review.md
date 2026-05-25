# PR #80 Review — Feat: Cross-device label sync via Upstash Redis (#78)

**Date:** 2026-05-25
**Author:** alanwaddington
**Branch:** feature/78-cross-device-label-sync → main
**State:** Open

---

## Summary

| Item | Result |
|------|--------|
| Overall Assessment | Pass with comments ⚠️ |
| Risk Level | Low |
| Test Coverage | Adequate |
| Acceptance Criteria | 22/23 met |

---

## Issues Reviewed

### Issue Hierarchy
- #78 — Cross-device label sync (root — contains both Analysis and Design sections)

---

## Changed Files Audit

### `.env.example` (+5 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | Documents required environment variables for Upstash Redis |
| Issues | #78 |
| Criteria covered | Environment setup documentation |
| Quality | ✅ No issues |
| Test coverage | N/A — configuration file |

### `package.json` (+3 / -1 lines)

| Property | Detail |
|----------|--------|
| Purpose | Add `@upstash/redis@^1.38.0` and `uqr@^0.1.3` dependencies |
| Issues | #78 |
| Criteria covered | QR library ≤10 kB, Redis client dependency |
| Quality | ✅ No issues — both in `dependencies` (not devDeps) which is correct for server and client runtime use |
| Test coverage | N/A — dependency manifest |

### `src/lib/server/redis.ts` (+28 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | Upstash Redis client singleton with lazy initialisation and credential validation |
| Issues | #78 Task 1 |
| Criteria covered | Redis client creation, credential guard |
| Quality | ✅ Clean singleton pattern. Uses `process.env` instead of `$env/dynamic/private` to avoid build-time credential checks — documented trade-off |
| Test coverage | Indirectly tested via API route tests that mock this module |

### `src/routes/api/labels/[uuid]/+server.ts` (+84 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | GET (pull labels) and PUT (push labels + refresh TTL) API routes |
| Issues | #78 Task 1 |
| Criteria covered | GET returns 200/404, PUT stores labels + code with 90-day TTL, UUID validation (400), Redis errors (500) |
| Quality | ✅ Clean separation of validation and business logic. `isLabelsBody` type guard validates all fields including shortCode format and labels value types |
| Test coverage | `server.test.ts` — 11 tests covering GET valid/invalid/missing/error, PUT valid/empty/invalid-uuid/missing-fields/bad-json/error |

### `src/routes/api/labels/resolve/[code]/+server.ts` (+30 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | GET (resolve short code to UUID) API route |
| Issues | #78 Task 1 |
| Criteria covered | Code validation (400), resolve success (200), not found (404), Redis error (500) |
| Quality | ✅ Concise, well-structured |
| Test coverage | `server.test.ts` — 7 tests covering valid/missing/invalid-format/special-chars/empty/error |

### `src/routes/api/labels/[uuid]/server.test.ts` (+198 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | Unit tests for the labels API route handlers |
| Issues | #78 Task 1 |
| Criteria covered | Test coverage for all GET and PUT paths |
| Quality | ✅ Good coverage of happy path, 400, 404, and 500 cases. Mock pattern is clean |
| Test coverage | N/A — is the test file |

### `src/routes/api/labels/resolve/[code]/server.test.ts` (+92 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | Unit tests for the resolve API route handler |
| Issues | #78 Task 1 |
| Criteria covered | Test coverage for resolve GET paths |
| Quality | ✅ Thorough edge case coverage (too short, no dash, special chars, empty) |
| Test coverage | N/A — is the test file |

### `src/lib/stores/sync.ts` (+221 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | Sync identity management: UUID generation, short code derivation, push/pull/resolve, adopt/reset, initSync, syncStatus store |
| Issues | #78 Task 2 |
| Criteria covered | UUID generation, short code derivation, push on label change, pull on page load, resolve code, adopt identity, reset identity, graceful degradation, fire-and-forget hook |
| Quality | ✅ Clean separation from deviceLabels.ts. Error handling is consistent — all network errors caught, surfaced in syncStatus, never thrown. `onLabelChange` hook reads fresh UUID/code from localStorage each time, surviving identity changes |
| Test coverage | `sync.test.ts` — 41 tests |

### `src/lib/stores/sync.test.ts` (+546 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | Comprehensive unit tests for the sync store |
| Issues | #78 Task 2 |
| Criteria covered | All sync operations: first visit, returning visit, hook registration, push/pull success/failure, resolve, adopt, reset, getSyncStatus |
| Quality | ✅ Excellent coverage. Uses `vi.resetModules()` to clear module-level state between tests. Mocks for localStorage, fetch, and crypto.randomUUID are well-isolated |
| Test coverage | N/A — is the test file |

### `src/lib/stores/deviceLabels.ts` (+31 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | Add `setOnLabelChange` hook, `getAllLabels()`, and `replaceAllLabels()` for sync integration |
| Issues | #78 Task 2 |
| Criteria covered | Hook fires on every label write/delete, getAllLabels returns plain object, replaceAllLabels overwrites cache without triggering hook |
| Quality | ✅ Minimal, non-breaking additions. Hook is fire-and-forget (no async coupling). `replaceAllLabels` intentionally skips the hook to prevent sync loops |
| Test coverage | `deviceLabels.test.ts` — 9 new tests for getAllLabels, replaceAllLabels, setOnLabelChange |

### `src/lib/stores/deviceLabels.test.ts` (+88 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | New tests for getAllLabels, replaceAllLabels, and setOnLabelChange hook |
| Issues | #78 Task 2 |
| Criteria covered | Empty store, populated store, replace overwrites, replace persists, replace with empty clears, replace does not trigger hook, hook fires on set/remove, no-callback doesn't throw, callback called after write |
| Quality | ✅ Thorough, including the important negative test that replaceAllLabels does NOT trigger the hook |
| Test coverage | N/A — is the test file |

### `src/lib/components/ui/SyncPanel.svelte` (+457 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | Collapsible sync panel with QR code, copy link, short code display, code entry, status/error, and reset identity |
| Issues | #78 Task 3 |
| Criteria covered | QR code display, copy link with feedback, short code in monospace, code entry with resolve, status display, error with retry, reset identity |
| Quality | ✅ Follows existing sidebar footer control patterns. QR wrapper uses white background for scannability. Uses `$derived` for reactive QR/URL generation. SSR-safe (guards with `browser` check). Styling is consistent with existing components |
| Test coverage | Runtime/Playwright verification (consistent with project approach — no .svelte unit tests) |

### `src/lib/components/ui/Sidebar.svelte` (+2 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | Add `<SyncPanel />` to sidebar footer |
| Issues | #78 Task 4 |
| Criteria covered | Sync panel accessible from sidebar footer |
| Quality | ✅ Minimal change — import + render |
| Test coverage | Runtime verification |

### `src/routes/+layout.svelte` (+17 / -1 lines)

| Property | Detail |
|----------|--------|
| Purpose | Call `initSync()` on mount; handle `?sync=` URL parameter for device linking |
| Issues | #78 Task 4 |
| Criteria covered | initSync called once on mount, ?sync= param handling, URL cleaning, identity adoption before initSync |
| Quality | ✅ Correctly awaits `adoptSyncIdentity` before `initSync` so the adopted identity isn't overwritten. URL cleaning via `history.replaceState` avoids navigation |
| Test coverage | Runtime verification |

### `src/routes/+page.svelte` (+12 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | Clean `?sync=` parameter from landing page URL |
| Issues | #78 Task 4 |
| Criteria covered | URL cleanup on landing page |
| Quality | ✅ Defensive — identity adoption is handled in layout, this just cleans the URL |
| Test coverage | Runtime verification |

### `package-lock.json` (+24 / -1 lines)

| Property | Detail |
|----------|--------|
| Purpose | Lock file updates for new dependencies |
| Issues | #78 |
| Criteria covered | N/A |
| Quality | ✅ Auto-generated |
| Test coverage | N/A |

---

## Acceptance Criteria Verification

### #78 — Cross-device label sync

| # | Criterion | Implementation | Test | Verdict |
|---|-----------|----------------|------|---------|
| 1 | UUID sync identity auto-generated via `crypto.randomUUID()` on first visit and stored in localStorage | `sync.ts:188-192` | `sync.test.ts:139-145` | ✅ Met |
| 2 | 8-character short code derived from UUID and registered in KV as `code:{shortcode}` → `{uuid}` | `sync.ts:50-55` (derivation), `+server.ts:78` (registration) | `sync.test.ts:113-132` | ✅ Met |
| 3 | `GET /api/labels/{uuid}` returns stored label map (200) or 404 | `[uuid]/+server.ts:25-43` | `server.test.ts:52-69` | ✅ Met |
| 4 | `PUT /api/labels/{uuid}` stores labels + refreshes 90-day TTL on both keys | `[uuid]/+server.ts:50-84` | `server.test.ts:106-124` | ✅ Met |
| 5 | `GET /api/labels/resolve/{code}` returns `{ uuid }` for valid code, 404 for unknown | `resolve/[code]/+server.ts:12-30` | `resolve/server.test.ts:38-55` | ✅ Met |
| 6 | On every page load, pullLabels fetches from KV and overwrites localStorage | `sync.ts:206-207` (returning visit path) | `sync.test.ts:213-222` | ✅ Met |
| 7 | On every setDeviceLabel/removeDeviceLabel, pushLabels sends full label map to KV | `deviceLabels.ts:86,94` (hook call), `sync.ts:213-220` (hook registration) | `sync.test.ts:239-258` | ✅ Met |
| 8 | If KV API unreachable, app continues with local labels — inline error in SyncPanel only | `sync.ts:82-86` (push catch), `sync.ts:112-115` (pull catch) | `sync.test.ts:307-320` (push), `sync.test.ts:359-371` (pull) | ✅ Met |
| 9 | Sync panel accessible via ☁ icon in sidebar footer | `SyncPanel.svelte:177-186` (toggle row), `Sidebar.svelte` (renders `<SyncPanel />` in footer) | Runtime verified | ✅ Met |
| 10 | Sync panel displays QR code encoding sync URL | `SyncPanel.svelte:27-35` (qrSvg derived), `SyncPanel.svelte:127-131` (render) | Runtime verified | ✅ Met |
| 11 | "Copy link" button copies sync URL to clipboard | `SyncPanel.svelte:63-71` (copyLink), `SyncPanel.svelte:139-141` (button) | Runtime verified | ✅ Met |
| 12 | Short code displayed in large monospace text | `SyncPanel.svelte:135-136` (shortcode div), `SyncPanel.svelte:295-303` (styling) | Runtime verified | ✅ Met |
| 13 | "Enter a code" input resolves code via API and stores resolved UUID | `SyncPanel.svelte:74-88` (submitCode), `SyncPanel.svelte:147-164` (input + button) | `sync.test.ts:389-409` (resolveCode), runtime verified | ✅ Met |
| 14 | After entering valid code, device immediately pulls labels and joins sync ring | `sync.ts:143-149` (adoptSyncIdentity calls pullLabels) | `sync.test.ts:432-439` | ✅ Met |
| 15 | Entering invalid code shows inline error message | `SyncPanel.svelte:83-84` (codeError set), `SyncPanel.svelte:165-167` (render) | Runtime verified — but see finding M1 | ⚠️ Partially Met |
| 16 | Sync panel shows "Syncing across devices ✓" with last-synced timestamp | `SyncPanel.svelte:121` (status line), `SyncPanel.svelte:40-48` (formatAge) | Runtime verified | ✅ Met |
| 17 | "Reset sync identity" generates new UUID, registers new short code, pushes current labels | `sync.ts:155-163` | `sync.test.ts:463-514` | ✅ Met |
| 18 | Both KV keys expire after 90 days (TTL refreshed on every push) | `[uuid]/+server.ts:5` (TTL_SECONDS = 90 * 24 * 60 * 60), lines 76-78 (set with `{ ex: TTL_SECONDS }`) | `server.test.ts:113-123` | ✅ Met |
| 19 | Existing localStorage labels pushed to KV on first sync | `sync.ts:193-194` (pushLabels after first-time UUID generation) | `sync.test.ts:176-184` | ✅ Met |
| 20 | QR code generated client-side; library ≤ 10 kB gzipped | `SyncPanel.svelte:3` (import renderSVG from 'uqr'), bundle verified at 7.8 kB | N/A — verified via build output | ✅ Met |
| 21 | All 3 API routes validate input (UUID format, code format, reject malformed with 400) | `[uuid]/+server.ts:28-29,52-53,64-69`, `resolve/+server.ts:15-16` | `server.test.ts:71-93`, `resolve/server.test.ts:57-81` | ✅ Met |
| 22 | API routes return appropriate HTTP status codes (200, 400, 404, 500) | All routes implement all four status codes | All test files cover all status codes | ✅ Met |
| 23 | `deviceLabels.test.ts` existing tests continue to pass | Existing tests unchanged; new functions are additive | All 394 tests passing | ✅ Met |

**Summary:** 22/23 criteria met. 1 partially met (criterion 15 — error message UX).

---

## Findings

### Major (should fix)

#### M1 — Code entry error message shows raw HTTP status instead of user-friendly message
- **Category:** Code Quality / UX
- **Location:** `src/lib/stores/sync.ts:129`, `src/lib/components/ui/SyncPanel.svelte:83`
- **Description:** When a user enters a format-invalid code (e.g. `BAD-CODE` which doesn't match the server's `XXX-XXXXX` regex), the server returns 400 and `resolveCode()` throws `"Resolve failed: 400"`. The SyncPanel displays this raw technical message to the user. The acceptance criterion says the error should be "Code not found" or similar user-friendly text. The `resolveCode` function handles 404 with `"Code not found"` but passes through other status codes as `"Resolve failed: {status}"`.
- **Recommendation:** Add client-side format validation in `SyncPanel.svelte`'s `submitCode()` before calling `resolveCode()`. If the trimmed input doesn't match `/^[A-Z0-9]{3}-[A-Z0-9]{5}$/`, set `codeError = 'Code must be in XXX-XXXXX format'` and return early. This also avoids a network round-trip for obviously invalid input.

### Minor (nice to fix)

#### m1 — `process.env` not loaded from `.env.local` in Vite dev server
- **Category:** Reliability / DX
- **Location:** `src/lib/server/redis.ts:17-18`
- **Description:** The Redis singleton reads credentials from `process.env` to avoid build-time checks with `$env/dynamic/private`. However, Vite's dev server only injects `.env.local` values into `import.meta.env` and SvelteKit's `$env/*` modules, not into `process.env`. Local development requires exporting the vars in the shell (`export UPSTASH_REDIS_REST_URL=...`) before running `npm run dev`. The `.env.example` and `.env.local` files exist but don't work as expected for local dev.
- **Recommendation:** Document the shell export requirement in `.env.example` comments, or add a `dotenv` import at the top of `redis.ts` for development mode. Alternatively, consider switching to `$env/dynamic/private` with a `try/catch` around the import so the build can still succeed without credentials present.

#### m2 — No confirmation feedback after successful code adoption
- **Category:** Code Quality / UX
- **Location:** `src/lib/components/ui/SyncPanel.svelte:74-88`
- **Description:** When a user enters a valid short code and successfully adopts a sync identity, the `codeInput` is cleared but there is no visible confirmation (e.g. "Linked!" or brief success message). The panel silently updates to the new identity. Users may wonder if the action succeeded, especially if they don't notice the short code changing.
- **Recommendation:** Add a brief success state (similar to the "✓ Copied!" feedback on the copy button) after successful adoption.

#### m3 — `SHORT_CODE_REGEX` duplicated across three files
- **Category:** Code Quality
- **Location:** `src/routes/api/labels/[uuid]/+server.ts:11`, `src/routes/api/labels/resolve/[code]/+server.ts:6`
- **Description:** The regex `/^[A-Z0-9]{3}-[A-Z0-9]{5}$/i` is defined identically in two route files. If the format ever changes, both must be updated.
- **Recommendation:** Extract to a shared constants file (e.g. `src/lib/server/validation.ts` or `src/lib/constants.ts`) and import in both routes.

### Suggestions (optional)

#### S1 — Consider rate limiting on resolve endpoint
- **Category:** Security
- **Location:** `src/routes/api/labels/resolve/[code]/+server.ts`
- **Description:** The resolve endpoint is unauthenticated and has a keyspace of 36^8 (~2.8T). While brute-force is impractical at this scale, a determined attacker could enumerate active codes. For the current user base this is a non-issue, but if the app scales, rate limiting per IP on the resolve endpoint would be prudent.
- **Recommendation:** No action needed now. Consider Vercel's built-in rate limiting if usage grows.

---

## Positive Observations

- Clean separation of concerns: `deviceLabels.ts` handles CRUD, `sync.ts` handles identity and network, `SyncPanel.svelte` handles UI. No circular dependencies.
- Fire-and-forget pattern for push is well-implemented — the `onLabelChange` hook captures fresh UUID/shortCode from localStorage each time, correctly surviving identity changes.
- Error handling is consistent across all sync operations: catch, log, surface in `syncStatus.error`, never throw to caller.
- Test coverage is thorough: 72 new tests across 3 files. The `vi.resetModules()` pattern cleanly isolates module-level state between tests.
- The `isLabelsBody` type guard in the PUT route validates not just structure but also value types (`Object.values(b.labels).every(v => typeof v === 'string')`).
- QR generation with `uqr` (7.8 kB) is well under the 10 kB budget and generates clean SVG with no server dependency.
- `replaceAllLabels` intentionally does NOT trigger the `onLabelChange` hook, preventing infinite push-pull loops. This is tested explicitly.

---

## Action Items

### Immediate Fixes (block merge)
(none — no critical findings)

### Should fix before merge
- [ ] M1: Add client-side format validation in `submitCode()` for user-friendly error message on invalid code format

### Post-merge improvements
- [ ] m1: Document or fix `.env.local` + `process.env` gap for local development
- [ ] m2: Add brief success feedback after code adoption
- [ ] m3: Extract `SHORT_CODE_REGEX` to shared constants

---

## Checklist

- [x] All acceptance criteria from the full issue hierarchy verified by reading actual code
- [x] Every changed file read and audited
- [x] Tests cover happy path, error paths, and edge cases
- [x] No security vulnerabilities introduced
- [x] No performance regressions
- [x] Error handling complete and consistent
- [x] Logging adequate for debugging production issues
- [x] Code follows existing codebase conventions
- [x] No unnecessary changes outside scope of the issue
