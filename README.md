# Rowlet Dates

A browser-only set of date and time tools, deployed at <https://dates.houndlings.com/>.

## Purpose and scope

Rowlet Dates has two small tools. Hours is a personal work-log and time-block scratchpad: enter activities, adjust times, inspect totals, copy a daily log, and save snapshots. Diff counts calendar dates for overseas trip planning, with weekends and a user-entered day limit visible so dates can be checked against travel plans. Hours does not distinguish planned from completed activities.

Keep this a browser-only utility on the existing React, Tailwind, and DaisyUI stack. Accounts, cloud sync, collaboration, calendar integration, and a project-management workflow are outside the current scope. Preserve existing saved snapshots and minute-precision times.

Diff is a calendar counter, not a country-specific visa eligibility checker. Count both ends of a trip explicitly; do not infer visa rules, rolling-stay windows, or allowance already used on earlier trips. Public holidays are optional and outside the current implementation.

### UI direction

Keep the interface extremely minimal, close to the original utility: a plain white page, small navigation links, compact input rows, inline totals, textareas, and a thin timeline. Do not turn it into a branded dashboard. No hero copy, cards, oversized statistics, decorative color palette, repeated instructional paragraphs, or inflated spacing. Preserve accessibility and functional safeguards without adding visual ceremony.

## Current features

- **Hours** (`/hours`, also the default `/` destination): compact time-block rows, inline totals, and a full-width Markdown daily log with **Copy**.
- **Timeline**: choose **Start** or **End** for an activity, then select one of the 48 half-hour slots. Only that endpoint changes. Exact manual times such as `09:15` or `23:59` remain available and are not rounded by unrelated edits. Each slot row is one Tab stop; Left/Right and Home/End move focus without editing, and Enter/Space applies the focused time. On narrow screens, scroll the timeline sideways.
- **Lines**: paste `HH:MM-HH:MM description`, one per line, then choose **Apply text** to replace the rows. Invalid or empty text leaves the current rows untouched with a visible error. **Export rows** fills the editor from the current rows.
- **Saved**: **Save** stores the current day using localForage. The list loads automatically, refreshes after saving, and shows newest first with dates and activity previews. **Load** restores a snapshot; changed current logs require confirmation. Save/load failures retain current input; a load that finishes after newer edits is rejected instead of overwriting them. Snapshots survive reloads but do not sync between browsers or devices. Clearing site data removes them.
- **Diff** (`/diff`): trip dates counted inclusively, weekday and Saturday/Sunday totals, and marked weekends in a seven-column Sunday-to-Saturday grid. Dates remain chronological, with the first date aligned under its weekday; cells show month-day, with full dates available to assistive technology and on hover. An optional day limit compares the whole range with a positive whole number you enter, showing remaining days or days over and the last inclusive date within that limit. Selecting dates does not reduce the trip count. Destination visa rules, previous trips, rolling windows, and public holidays are not calculated. Cleared/reversed ranges remain editable. Long ranges initially render six months; totals always cover the whole range.
- **Diff keyboard/mobile**: the date grid is one Tab stop. Left/Right move a day; Up/Down move a week. Home/End move to the first/last available date in the week; Ctrl+Home/End move to the first/last shown date. Enter/Space mark or unmark; Tab/Shift+Tab leave the grid. **Keyboard help** exposes these instructions. **Show next 6 months** focuses the first newly revealed date, **Swap dates** returns focus to Start, and Clear/Remove focus the selected-date heading. On small screens and coarse pointers, controls are at least 44px high and editable fields use 16px text. All seven columns fit at 320px with normal text; enlarged text can scroll within the calendar without forcing the page sideways.
- **About** (`/about`): usage, duration rules, and browser-local storage limitations.

Current drafts restore after refresh or reopening the page: Hours date, timezone, rows, and unapplied Lines text; Diff start/end dates, raw day-limit input, and marked dates. Small active drafts are written synchronously to browser `localStorage` on edits, separately from localForage's historical snapshots. Blank and incomplete form values are retained rather than validated away. Storage errors are shown inline and leave the current input usable; keep the page open or copy your data if saving fails. Drafts and snapshots are scoped to the browser profile and URL origin, so localhost and the tailnet URL have separate data. Clearing site data removes both. Multiple tabs use last-write-wins; there is no cross-tab merge or cross-device sync.

The timezone field defaults to `GMT+8` and is a label, not a conversion setting. Durations use the absolute difference between same-day clock times; a backwards range is not an overnight shift. Invalid/incomplete time rows are visibly excluded from totals and the report and cannot be saved until corrected. Overlapping activities are summed independently, not deduplicated.

## Development

Requires Node.js 22 or newer and Yarn Classic 1.22.22. `yarn.lock` is the dependency source of truth; do not generate a second lockfile with `npm install`.

Current delivery mode is **local trunk on `next`**. Do not open PRs, push branches, update remote issues, or trigger Vercel deployments without new operator authorization. Local preview and build commands do not publish the app.

If Yarn is not installed globally:

```sh
npx --yes yarn@1.22.22 install --frozen-lockfile
npm run dev
```

`npm run` only runs scripts; installation remains Yarn-owned.

```sh
npm run lint
npm run build
npm run preview
```

The pre-push hook runs `npm run build`. Vercel's rewrite in `vercel.json` supports direct navigation to client-side routes.

## Dependency maintenance

The dependency-maintenance slice moves Vite to 6.4.5 and React Router to 7.18.4, updates TypeScript ESLint to 8.72.0, and refreshes compatible dependencies in `yarn.lock`. React 18, Tailwind 3, and DaisyUI 4 are retained.

Run the known-advisory scan with:

```sh
npx --yes yarn@1.22.22 audit
```

### Known audit metadata discrepancy

The audit still reports [CVE-2026-104844 / GHSA-rj75-hqrm-r3gf](https://github.com/advisories/GHSA-rj75-hqrm-r3gf) twice, through Tailwind and postcss-nested. Its affected range is `<7.1.6`, but installed `postcss-selector-parser@6.1.5` contains the security backport for the 6.x line. See that installed package's `CHANGELOG.md` and `dist/parser.js`: the three quadratic membership scans use Sets. A local smoke probe parsed the advisory's 400 KB flat-selector shape without changing its output in 199 ms.

The advisory also states that ordinary build-time parsing of trusted sources is not affected. This app uses the parser through its CSS build, not a service accepting user-supplied CSS. No audit suppression or cross-major dependency override is installed. Revisit this note when upstream advisory metadata or Tailwind's parser dependency changes; an audit report is not a complete security assessment.

## Delivery

[Issue #2](https://github.com/odjhey/rowlet-dates/issues/2), clickable Gantt cells for adjusting times, is implemented through the endpoint-editing timeline above. The work was developed locally on `next`; the operator subsequently authorized publishing the completed changes directly to `origin/next`. No PR or remote issue update is part of this publication. Future publication still requires operator authorization as described above.
