# Award Recommendation Layout v2

**Date:** 2026-06-10
**Status:** Approved

## Problem

After the first redesign round, three issues remain in the Award Recommendation section:

1. **Left panel imbalance** — the left column (vendor card) ends early and leaves empty vertical space while the right column (justification + contract terms stacked) is much taller. The `1fr 1.6fr` ratio makes this worse.
2. **Redundant empty state** — when no vendor is selected, both the left column and the contract terms area show near-identical "☝️ click a vendor column" messages.
3. **Contract terms cramped** — the 3-column terms panel sits inside the right column (1.6fr), giving it less than two-thirds of the card width. Long payment schedule labels get crowded.

Note: a "Print" button was considered but dropped — the existing **📄 Generate Package** button in the RFA top action bar already handles document generation (Recommendation for Award + NOA/NTP + Contract Agreement + Term Sheet).

## Design

### Layout — Equal Columns + Full-Width Terms Row

Change the two-column grid from `1fr 1.6fr` to `1fr 1fr` (equal halves).

Move the contract terms panel **out of the right column** and into a dedicated full-width row directly below the two-column section, still inside the same card. The row uses `background: C.offWhite` to visually separate it from the upper split.

Result:
```
┌────────────────────────────────────────────────────┐
│ Card header + risk banner                          │
├───────────────────┬────────────────────────────────┤
│ Recommended       │ Award Justification            │
│ Vendor (1fr)      │ textarea (1fr)                 │
├───────────────────┴────────────────────────────────┤
│ Recommended Contract Terms  (full card width)      │
│  [coral header bar: Total Contract Amount]         │
│  [Payment Schedule | Required Bonds | Timeline]    │
└────────────────────────────────────────────────────┘
```

The contract terms row renders only when `awarV && awarVc` — same condition as before, just repositioned.

### Empty State — Single Prompt

Remove the `{!awarV && (<div>☝️ Click a vendor column to see the recommended contract terms.</div>)}` block that currently sits at the bottom of the right column. It is redundant with the left column's dashed placeholder.

When no vendor is selected:
- Left column: existing dashed "☝️ No vendor selected" card (keep as-is, it is the single prompt)
- Right column: justification textarea only — always accessible for typing, no placeholder below it
- Contract terms row: does not render (the `awarV && awarVc` condition already handles this with no placeholder needed)

The two-column grid is always rendered (so the justification textarea is always editable). Only the contract terms row appears/disappears based on vendor selection.

### Contract Terms — More Room

Moving the terms panel to full card width automatically resolves the cramping. No changes to the panel's internal structure (3-column grid, coral header bar, colored dots, bond rows, timeline fields) — only its position moves.

## Scope

All changes are in `src/App.jsx`, inside the `{/* ── Award Recommendation ── */}` block (~lines 9167–9302).

Specifically:
- Change `gridTemplateColumns: "1fr 1.6fr"` → `"1fr 1fr"` on the main body grid
- Remove `awarBreakdown` / `awarAutoAmts` / timeline JSX from inside the right column
- Add a new full-width `<div>` below the closing `</div>` of the grid, containing the contract terms panel (currently ~lines 9223–9294)
- Remove the `{!awarV && (<div>☝️ …</div>)}` block (~lines 9296–9300) from the right column

No new state, no new helpers, no database changes.

## What Stays the Same

- Card header, risk banner, footer — unchanged
- Vendor card content and styling — unchanged
- Contract terms panel internals (coral header, 3-column layout, colored dots, bond rows, timeline) — unchanged, only position moves
- Justification textarea, auto-gen notice, auto-recommend button — unchanged
- Left column empty state (dashed "☝️ No vendor selected" card) — unchanged
- Risk flag conditions (`awarV &&` for green banner, no condition for warnings) — unchanged
