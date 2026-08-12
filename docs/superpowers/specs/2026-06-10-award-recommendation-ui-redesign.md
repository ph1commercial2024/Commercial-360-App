# Award Recommendation UI Redesign

**Date:** 2026-06-10
**Status:** Approved

## Problem

The Award Recommendation section in the RFA form has four visual issues:

1. **Auto-recommend button** uses purple (`#7C3AED`) which clashes with the app's coral design system.
2. **Vendor card hierarchy** — vendor name, amount, and label are all the same coral color, making it hard to scan at a glance.
3. **Layout ratio** (`1fr 1.4fr`) gives too little space to the justification textarea, which is the most important input.
4. **Risk flags** are buried in the left column below the vendor card — warnings can go unnoticed.

## Design

### Risk Banner Strip

A colored strip sits between the card header and the two-column body. It replaces the current risk section in the left panel.

- **No vendor selected**: banner is hidden entirely (`riskFlags` is empty and `awarV` is null — don't render the strip).
- **Clean state**: slim green bar (`background: #E6F4EF`, `border-bottom: 1px solid #B6E8D4`) with "✓ No risk flags — all criteria met".
- **Warning/error state**: amber or red banner that expands to show the full flag detail — timeline component chain, days available, shortfall. Uses the existing structured `timeline` flag rendering, relocated here.

This makes risk flags impossible to miss regardless of scroll position.

### Layout — `1fr 1.6fr`

Change from `1fr 1.4fr` to `1fr 1.6fr` to give the justification textarea more horizontal room.

The left panel previously held both the vendor card and the risk flags section. With risk flags moved to the banner, the left panel contains only the vendor card. The freed vertical space is absorbed naturally — no replacement content needed.

### Vendor Card Hierarchy

Inside the vendor card (left panel), fix the color overload:

- `"★ Recommended"` label: keep coral (`C.coral`) — accent only
- Vendor name: `C.textPri` (`#1A1917`) at `fontSize: 15, fontWeight: 700`
- Total amount: `C.coral` at `fontSize: 14, fontFamily: "monospace", fontWeight: 700`
- Payment type badge: unchanged (blue `#2563EB`)
- Card background: `C.surface` (`#F2F1EF`) with `border: 1px solid C.border` — neutral, not coral-tinted

### Auto-recommend Button

Change from purple (`#7C3AED`, `#F5F3FF`) to coral secondary style:

```js
background: C.coralLight,   // #FDF1F0
color: C.coralDark,         // #C94A3F
border: `1px solid ${C.coral}40`
```

### Auto-gen Notice

Change from purple to coral to match the button:

```js
background: C.coralLight,
border: `1px solid ${C.coral}30`,
color: C.coralDark
```

### Contract Terms Panel — 3 Columns

Replace the current vertical layout with a horizontal 3-column panel inside a single bordered container:

| Column | Content |
|---|---|
| Payment Schedule | Colored-dot rows with label and ₱ amount per payment line |
| Required Bonds | Performance / Warranty / Surety bond amounts (hidden when zero) |
| Timeline | Commencement · Duration · Warranty/DLP fields |

Above the 3 columns: a coral header bar showing Total Contract Amount (label + mono ₱ amount).

The container: `border: 1px solid C.border`, `borderRadius: 9`, `background: C.offWhite` wrapper with `background: #fff` inner panel.

## Scope

All changes are in `src/App.jsx`, inside the `{/* ── Award Recommendation ── */}` block (around line 9090–9302).

No new state, no new helpers, no database changes.

## What Stays the Same

- Card header (title, vendor badge, auto-recommend button placement)
- Footer ("Prepared by" + name + date)
- Left panel section label "Recommended Vendor"
- Right panel section label and textarea behavior
- Empty state (no vendor selected) placeholder text
- Risk flag logic — only the rendering location moves (from left panel to banner)
- Contract terms data source (`awarBreakdown`, `awarAutoAmts`, `awarVc.ptd`)
