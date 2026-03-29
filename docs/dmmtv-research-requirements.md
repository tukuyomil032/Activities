# DMM TV Activity: Investigation and Requirements

Last updated: 2026-03-30

## 1. Goal

Add a new PreMiD Activity so that DMM TV usage is shown in Discord Rich Presence.

Target domains:
- `tv.dmm.com`

Out of scope for first implementation:
- Precise extraction of season/episode numbers from internal API payloads
- Support for every niche page variant in DMM ecosystem outside DMM TV

## 2. Sources Reviewed

Official documents:
- https://docs.premid.app/
- https://docs.premid.app/v1/api/
- Local docs mirror under `docs/v1/api/`

Repository rules and references:
- `.github/CONTRIBUTING.md`
- `docs/v1/guide/guidelines.md`
- Existing Activities in `websites/` (ABEMA, U-NEXT, Disney+, dailymotion, etc.)

Requested repository reference:
- https://github.com/tukuyomil032/Activities

## 3. Key Findings

### 3.1 Activity structure

Minimum required files:
- `metadata.json`
- `presence.ts`

Optional:
- `iframe.ts` (only if embedded players need cross-context messaging)

### 3.2 Repository and guideline constraints

- Must use valid semantic versioning; first version should start at `1.0.0`.
- Must include English description in metadata.
- Should support primary language of the site (Japanese for DMM TV), while preserving PreMiD conventions.
- Use `document.location` rather than `window.location` where practical.
- For media playback, use standard utilities like `getTimestampsFromMedia`.
- Avoid setting fields to undefined after declaration; delete keys when needed.

### 3.3 DMM TV URL behavior (observed)

Observed important routes:
- `/vod/` (catalog / landing)
- `/vod/detail/` (title detail pages)
- `/vod/play/` (video playback)
- `/shorts/` and `/shorts/detail/` (short video pages)
- `/my/item/` (my list)
- query-based detail pages with `season=` parameter

### 3.4 Existing pattern to reuse

- Use one `PresenceData` object per tick.
- Detect `video` element first for playback states.
- Use fallback title extraction from:
  1) page-specific DOM selectors
  2) `meta[property="og:title"]`
  3) cleaned `document.title`

## 4. Requirements Definition

### 4.1 Functional requirements

1. Detect DMM TV pages on `tv.dmm.com`.
2. Show browsing status on major non-playback pages.
3. When video playback is detected, show:
   - current title
   - secondary state (episode, subtitle, or fallback)
   - play/pause small icon
4. Support playback timestamp toggle (on/off).
5. Support privacy mode to hide title/state while still showing a generic watching status.
6. Optional button to open the current page when not in privacy mode.

### 4.2 Non-functional requirements

1. Keep selectors resilient with graceful fallbacks.
2. Keep strings short (Discord display-friendly).
3. Follow existing lint/style conventions in this repository.

## 5. Initial Implementation Plan

1. Create `websites/D/DMM TV/metadata.json` with settings:
   - lang (multiLanguage)
   - privacy
   - timestamp
   - buttons
2. Create `websites/D/DMM TV/presence.ts` with:
   - robust title extraction helper
   - route classification for browsing states
   - playback detection via `video`
3. Update `AGENTS.md` with PreMiD-specific development guardrails in English.
4. Run error checks and lint for touched files, then fix until no relevant errors remain.
5. Update this document with final implementation results.

## 6. Risks and Mitigations

Risk: DMM TV frequently changes front-end selectors.
Mitigation: Prefer layered fallback extraction (`og:title`, `document.title`, multiple selectors).

Risk: Unknown playback route variants.
Mitigation: Route checks use broad prefixes and include fallback behavior when `video` exists.

## 7. Progress Log

- [x] Investigation and requirement definition started.
- [x] Activity implementation complete.
- [x] AGENTS.md guardrails update complete.
- [x] Validation complete with zero relevant errors/warnings.

## 8. Implementation Snapshot (Current)

Implemented files:
- `websites/D/DMM TV/metadata.json`
- `websites/D/DMM TV/presence.ts`
- `AGENTS.md` (appended PreMiD guardrails section in English)

Current behavior summary:
- Detects DMM TV pages under `tv.dmm.com`.
- Uses `video` detection for watch status and play/pause icon.
- Keeps a stable activity elapsed timer from activity start when timestamp display is enabled.
- Supports privacy mode and optional action buttons.
- Uses layered fallback extraction for title/state:
   1) common DOM selectors
   2) Open Graph meta tags
   3) cleaned `document.title`
- Avoids exposing raw season IDs as presence text.
- Supports cover switching via metadata setting (`coverMode`): episode cover or series thumbnail.
- Shows playback progress text plus an ASCII seek bar through slideshow rotation while preserving subtitle display.

Pending:
- None for this implementation scope.

## 9. Validation Results

Checked files:
- `websites/D/DMM TV/presence.ts`
- `websites/D/DMM TV/metadata.json`
- `AGENTS.md`
- `docs/dmmtv-research-requirements.md`

Validation summary:
- `get_errors` on all changed files: no errors
- `npx eslint "websites/D/DMM TV/presence.ts" "websites/D/DMM TV/metadata.json"`: no errors
- `npm run lint -- "websites/D/DMM TV/**"`: no errors

Note:
- Targeted and script-based lint checks both pass for this implementation scope.

## 10. Iteration 2 Adjustments (User Feedback)

Requested fixes addressed:
- Reworked title hierarchy so activity headline prefers series title and secondary line prefers episode subtitle.
- Removed fallback that showed opaque alphanumeric season-like identifiers in the secondary line.
- Added a playback progress state using `current / total` plus an ASCII seek bar.
- Preserved elapsed activity timer continuity across pause/resume by using a stable activity start timestamp.
- Added cover image source switch in metadata (`coverMode`) to choose episode cover vs series thumbnail.
- Improved selector robustness by combining DOM heuristics with JSON-LD structured data extraction for titles and covers.

Files updated in iteration 2:
- `websites/D/DMM TV/presence.ts`
- `websites/D/DMM TV/metadata.json`
