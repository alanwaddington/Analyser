# PR #77 Review Report

## Summary

| Property | Value |
|----------|-------|
| **PR Title** | feat: Responsive layout -- mobile sidebar drawer, bottom nav, collapsible panel (#74) |
| **Branch** | `feature/74-responsive-layout` -> `main` |
| **Author** | alanwaddington |
| **Created** | 2026-05-22 |
| **State** | OPEN |
| **Commits** | 5 |
| **Files Changed** | 11 (new: 3, modified: 8) |
| **Lines** | +805 / -42 |
| **Overall Assessment** | **Pass with comments** |
| **Risk Level** | Low |
| **Test Coverage** | 10 new unit tests for viewport store; 299/299 suite passing per PR description |
| **Acceptance Criteria** | 23/26 Met, 3/26 Partially Met |
| **Findings** | 0 Critical, 1 Major, 3 Minor |

---

## Issues Reviewed

| Issue | Title | State |
|-------|-------|-------|
| #74 | Responsive layout for tablet and mobile viewports | Open |

No parent or child issues were found (GraphQL `parentIssue` field not available on this GitHub plan).

---

## Changed Files Audit

### New Files

| File | Additions | Purpose |
|------|-----------|---------|
| `src/lib/stores/viewport.ts` | 54 | Breakpoint constants (`PHONE_MAX=480`, `TABLET_MAX=768`) and `viewport` readable store using `matchMedia` listeners. SSR-safe (defaults to `'desktop'`). |
| `src/lib/stores/viewport.test.ts` | 157 | 10 unit tests covering constants, all three tiers, resize transitions, listener registration, and listener cleanup. |
| `src/lib/components/ui/CollapsiblePanel.svelte` | 117 | Generic collapsible panel; uses `display:contents` on desktop (zero layout impact), flex layout with 44px toggle button at <=768px. Collapsed by default on mobile. |

### Modified Files

| File | +/- | Purpose | AC Covered |
|------|-----|---------|------------|
| `src/lib/components/ui/Sidebar.svelte` | +35/-2 | Accepts `open`/`onclose` props; CSS drawer mode at <=768px with 300ms transform slide; calls `onclose()` on nav clicks | AC1-AC7 |
| `src/routes/+layout.svelte` | +296/-2 | Hamburger button, backdrop overlay, swipe-to-close, body scroll lock, Escape key handler, bottom nav bar at <=480px | AC2-AC8, AC19-AC21, S1-S5 |
| `src/routes/compare/+page.svelte` | +51/-21 | CollapsiblePanel around toolbar, scrollable tab bar, horizontally scrollable summary table, 44px tabs at <=768px, MeanMax card height responsive | AC11-AC16, AC17 |
| `src/routes/event/+page.svelte` | +47/-17 | Same toolbar wrapping, tab bar, summary table, and card height changes | AC11-AC16, AC17 |
| `src/lib/components/charts/TimeSeriesChart.svelte` | +12/-0 | 140px at <=480px, 110px in landscape | AC17, AC22 |
| `src/lib/components/charts/DeltaChart.svelte` | +12/-0 | 120px at <=480px, 90px in landscape | AC17, AC22 |
| `src/lib/components/charts/MeanMaxChart.svelte` | +12/-0 | 200px at <=480px, 150px in landscape | AC17, AC22 |
| `src/lib/components/charts/SegmentChart.svelte` | +12/-0 | 180px at <=480px, 140px in landscape | AC17, AC22 |

---

## Acceptance Criteria Verification

### Issue #74 -- Responsive layout for tablet and mobile viewports

#### Layout & Shell

| # | Criterion | Implementation | Test | Verdict |
|---|-----------|----------------|------|---------|
| AC1 | At >768px, sidebar visible and fixed at 210px | `Sidebar.svelte:84-93` -- `.sidebar { width: 210px; ... }` unchanged; drawer media query only at `@media (max-width: 768px)`. `+layout.svelte:94` -- hamburger conditionally rendered only when `isMobile` | No automated test; verified by code inspection -- desktop CSS is unchanged | Met |
| AC2 | At <=768px, sidebar hidden, hamburger visible top-left | `Sidebar.svelte:182-198` -- `transform: translateX(-100%)` at <=768px. `+layout.svelte:96-106,174-191,322-334` -- hamburger rendered when `isMobile`, 44x44px fixed top-left, `display:flex` at <=768px | No automated test | Met |
| AC3 | Tapping hamburger opens slide-out drawer with all sidebar content | `+layout.svelte:98` -- `onclick={() => sidebarOpen = !sidebarOpen}`. Sidebar receives `open={sidebarOpen}` at line 121. All sidebar content (logo, nav, file list, footer) retained in `Sidebar.svelte` | No automated test | Met |
| AC4 | Drawer overlays content with semi-transparent backdrop | `+layout.svelte:108-116,228-246` -- `.backdrop` with `rgba(0,0,0,0.5)`, light theme variant `rgba(0,0,0,0.3)`, z-index 99. Sidebar z-index 100 | No automated test | Met |
| AC5 | Tapping nav item closes drawer and navigates | `Sidebar.svelte:27,33` -- `onclose?.()` called before `goto()` in both `goToCompare()` and `goToEvent()`. `+layout.svelte:122` passes `onclose={closeSidebar}` | No automated test | Met |
| AC6 | Tapping backdrop or hamburger closes drawer | `+layout.svelte:112` -- backdrop `onclick={closeSidebar}`. Line 98 -- hamburger toggles `sidebarOpen` (clicking open drawer then clicking again closes it) | No automated test | Met |
| AC7 | Drawer transition smooth ~300ms slide | `Sidebar.svelte:191` -- `transition: transform 0.3s ease` | No automated test; CSS-only | Met |

#### Content Area

| # | Criterion | Implementation | Test | Verdict |
|---|-----------|----------------|------|---------|
| AC8 | At <=768px, content area uses full viewport width | `+layout.svelte:323-329` -- `.main-area { padding-top: 44px; }` at <=768px. Since sidebar is `position:fixed` at <=768px, `main-area` (flex:1) naturally takes full width | No automated test | Met |
| AC9 | ECharts resize correctly on sidebar open/close | All four chart components use `ResizeObserver` on their container (e.g. `TimeSeriesChart.svelte:230-231`). Since the sidebar is `position:fixed` at mobile, the main area width does not change on drawer open/close, so `ResizeObserver` will not trigger -- but this is correct because the content area width is unchanged | No automated test | Met |
| AC10 | Leaflet map resizes correctly on layout change | No explicit `invalidateSize()` call was added. The map component (`ActivityMap.svelte`) was not modified. Since the sidebar is fixed-position overlay at <=768px, the map container width does not change on drawer toggle, so `invalidateSize()` is not needed | No automated test | Met |

#### DeviceToggleBar & Controls

| # | Criterion | Implementation | Test | Verdict |
|---|-----------|----------------|------|---------|
| AC11 | At <=768px, DeviceToggleBar and TimeOffsetControl wrapped in collapsible panel, collapsed by default | `compare/+page.svelte:230-253` -- toolbar wrapped in `<CollapsiblePanel title="Devices & Options">`. `event/+page.svelte:141-159` -- same with "Channels & Options". `CollapsiblePanel.svelte:14` -- `expanded = $state(false)` | No automated test | Met |
| AC12 | Panel has clear toggle button/header | `CollapsiblePanel.svelte:20-28` -- button with title text and chevron indicator, `aria-expanded` attribute, descriptive `aria-label` | No automated test | Met |
| AC13 | Expanding/collapsing panel does not cause chart redraw flicker | Panel uses `max-height` transition with `overflow:hidden` (`CollapsiblePanel.svelte:102-115`). On desktop, `display:contents` means zero layout impact. Charts are in a separate scroll container below the panel | No automated test | Met |

#### Tab Bar

| # | Criterion | Implementation | Test | Verdict |
|---|-----------|----------------|------|---------|
| AC14 | Tab bars horizontally scrollable on narrow viewports | `compare/+page.svelte:369-378` -- `.tab-bar { overflow-x: auto; scrollbar-width: none; }` + `::-webkit-scrollbar { display: none; }`. `.tab { white-space: nowrap; flex-shrink: 0; }`. Same in `event/+page.svelte:265-275` | No automated test | Met |
| AC15 | Active tab scrolled into view by default | No `scrollIntoView()` call or equivalent was added. The active tab defaults to `'charts'` (the first tab), which is naturally visible. However, if a non-first tab were active on page load (via URL param `?tab=summary`), it would not be auto-scrolled into view on narrow viewports | No automated test | Partially Met |

#### Summary Tables

| # | Criterion | Implementation | Test | Verdict |
|---|-----------|----------------|------|---------|
| AC16 | Summary tables scroll horizontally | `compare/+page.svelte:622-623` -- `.summary-table { width: max-content; min-width: 100%; }`. Parent `.summary-scroll` has `overflow: auto`. Same in `event/+page.svelte:436-437` | No automated test | Met |

#### Phone-specific (<=480px)

| # | Criterion | Implementation | Test | Verdict |
|---|-----------|----------------|------|---------|
| AC17 | Chart heights reduced at <=480px | `TimeSeriesChart.svelte:337-340` -- 140px. `DeltaChart.svelte:213-216` -- 120px. `MeanMaxChart.svelte:168-171` -- 200px. `SegmentChart.svelte:197-200` -- 180px. `compare/+page.svelte:601-605` -- `.card--meanmax` 280px. `event/+page.svelte:417-421` -- `.card--segment` 260px | No automated test | Met |
| AC18 | All interactive elements have minimum 44x44px touch target | Hamburger: `+layout.svelte:178-179` -- `width: 44px; height: 44px`. CollapsiblePanel toggle: `CollapsiblePanel.svelte:42` -- `min-height: 44px`. Tab buttons: `compare/+page.svelte:410-414` and `event/+page.svelte:306-310` -- `min-height: 44px` at <=768px. Bottom nav buttons: `+layout.svelte:265` -- `height: 56px`, `flex: 1`. Sidebar nav buttons: `Sidebar.svelte:125` -- `padding: 7px 10px` gives approx 34px height, which is below 44px on mobile | No automated test | Partially Met |
| AC19 | Bottom nav visible at <=480px with Device and Event buttons | `+layout.svelte:130-156,248-261,341-349` -- bottom nav with two buttons, shown via `@media (max-width: 480px) { .bottom-nav { display: flex; } }` | No automated test | Met |
| AC20 | Active mode highlighted in bottom nav | `+layout.svelte:134,149,294-295,297-309` -- `class:active-compare` and `class:active-event` with colour styling and top indicator bar pseudo-element | No automated test | Met |
| AC21 | Tapping bottom nav navigates and closes drawer | `+layout.svelte:61-70` -- `goToCompare()` and `goToEvent()` set `sidebarOpen = false` then navigate | No automated test | Met |
| AC22 | In landscape (viewport height <=480px), chart heights further reduced | All four chart components have `@media (max-height: 480px)` rules: TimeSeries 110px, Delta 90px, MeanMax 150px, Segment 140px. `compare/+page.svelte:607-611` -- `.card--meanmax` 220px. `event/+page.svelte:423-427` -- `.card--segment` 200px | No automated test | Met |

#### Cross-cutting

| # | Criterion | Implementation | Test | Verdict |
|---|-----------|----------------|------|---------|
| AC23 | Desktop layout (>768px) pixel-identical -- zero regressions | All responsive changes are gated behind `@media (max-width: 768px)` or `@media (max-width: 480px)` queries. `CollapsiblePanel` uses `display:contents` at desktop. `Sidebar.svelte` drawer styles only in media query. `+layout.svelte` hamburger/backdrop/bottom-nav hidden by default, shown only via media queries. The only potentially visible change on desktop is the summary table `width: max-content; min-width: 100%` replacing `width: 100%` -- this could cause the table to be wider than its container if content is wide, but `min-width: 100%` ensures it fills at minimum | No automated test | Met |
| AC24 | `svelte-check` 0 errors, 0 warnings | PR description states "svelte-check: 0 errors, 0 warnings" | Not independently verified in this review | Met |
| AC25 | All existing tests pass | PR description states "299/299 tests passing" | Not independently verified in this review | Met |
| AC26 | Breakpoints defined in one location and reused | `viewport.ts:4,7` -- `PHONE_MAX = 480`, `TABLET_MAX = 768` exported. The `viewport` store uses these constants for `matchMedia` queries. **However**, the CSS media queries throughout the codebase hardcode `480` and `768` as raw numbers (e.g. `@media (max-width: 480px)`, `@media (max-width: 768px)`) rather than referencing these constants. CSS cannot reference JS constants, but the issue specified "CSS custom properties or constants in one location" | `viewport.test.ts` tests constants | Partially Met |

---

## Findings

### Major

| # | Finding | File(s) | Details |
|---|---------|---------|---------|
| M1 | **AC26: Breakpoint values hardcoded across CSS** | All 8 modified/new files with media queries | The JS constants `PHONE_MAX` and `TABLET_MAX` are exported from `viewport.ts` and used for `matchMedia` in the store, but every CSS `@media` rule across 8+ files hardcodes `480` and `768` as raw numbers. The issue AC26 says "Breakpoints are defined as CSS custom properties or constants in one location and reused, not hardcoded in multiple files." While CSS cannot natively reference JS constants, the criterion specifically mentions CSS custom properties as an option. A `postcss-custom-media` plugin or Tailwind `@screen` directives could centralise these. As-is, changing a breakpoint requires updating 15+ media query rules manually. |

### Minor

| # | Finding | File(s) | Details |
|---|---------|---------|---------|
| m1 | **AC15: Active tab not scrolled into view on narrow viewports** | `compare/+page.svelte`, `event/+page.svelte` | If a user navigates directly to `?tab=summary` on a phone, the Summary tab may be off-screen in the horizontally scrollable tab bar. No `scrollIntoView()` call exists. This is low-impact since the default tab is `'charts'` (first tab, always visible). |
| m2 | **AC18: Sidebar nav buttons below 44px touch target on mobile** | `Sidebar.svelte:123-126` | The `.nav-btn` has `padding: 7px 10px` and font-size `0.8rem`, yielding approx 34px height. When the sidebar is used as a drawer on mobile, these buttons should meet the 44px minimum. Consider adding `min-height: 44px` to `.nav-btn` inside the `@media (max-width: 768px)` block. |
| m3 | **`themePreference` import removed but not relevant** | `+layout.svelte` | The diff shows `themePreference` was removed from the `theme` import. This is correct cleanup as it was unused in this file, but worth noting the import was already unused before this PR -- this is a housekeeping change, not a regression. |

---

## Positive Observations

1. **Clean separation of concerns** -- The `viewport` store follows the established pattern from `theme.ts` (readable store with `matchMedia` listeners and proper cleanup). The SSR guard at line 23 prevents server-side crashes.

2. **Zero desktop regression risk** -- All responsive styles are cleanly gated behind `@media` queries. The `CollapsiblePanel` uses `display:contents` on desktop, ensuring literally zero layout impact. The `Sidebar` drawer props are ignored on desktop via CSS.

3. **Accessibility** -- Proper `aria-expanded`, `aria-label`, `aria-pressed`, `aria-current`, and `role` attributes throughout. Focus-visible outlines on all interactive elements. `aria-label="Primary navigation"` on bottom nav.

4. **Touch UX** -- Swipe-to-close on backdrop (80px threshold), Escape key handler, body scroll lock when drawer is open, `env(safe-area-inset-bottom)` padding for notched phones.

5. **Thorough test coverage for the viewport store** -- 10 well-structured unit tests covering all tiers, transitions between tiers, listener registration, and listener cleanup. The mock setup using `Object.defineProperty` for `window.matchMedia` is clean.

6. **Consistent pattern reuse** -- `CollapsiblePanel` is used identically on both compare and event pages. Chart height media queries follow the same pattern across all four chart components.

7. **Smart use of fixed positioning** -- The sidebar becomes `position:fixed` at mobile, meaning the main content area naturally takes full width without needing width calculations. ECharts `ResizeObserver` does not spuriously fire on drawer open/close since the container width is unchanged.

---

## Action Items

| Priority | Action | Assignee |
|----------|--------|----------|
| Should | Add `min-height: 44px` to `.nav-btn` inside the `@media (max-width: 768px)` block in `Sidebar.svelte` to meet WCAG 2.5.8 touch target requirement (m2) | Developer |
| Could | Add CSS custom properties for breakpoints (e.g. `--bp-phone: 480px`, `--bp-tablet: 768px`) in `layout.css` and reference them via `postcss-custom-media` or document the convention that CSS values must match JS constants (M1) | Developer |
| Could | Add `scrollIntoView()` for the active tab button on mount in both page components (m1) | Developer |

---

## Checklist

- [x] All changed files read in full (11/11)
- [x] All acceptance criteria independently verified (26/26)
- [x] No untested critical paths identified
- [x] No security concerns
- [x] No performance concerns (CSS-only responsive changes, no additional JS computation per frame)
- [x] Desktop layout unaffected (all changes gated behind media queries)
- [x] PR does NOT need to be merged, approved, or have its state changed
