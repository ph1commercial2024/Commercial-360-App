# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # start Vite dev server (http://localhost:5173)
npm run build    # production build
npm run lint     # ESLint
npm run preview  # preview production build locally
```

## Architecture

React 19 + Vite 8 SPA backed by Supabase.

**Routing** (`src/main.jsx`):
- `/vendor/*` → `src/VendorApp.jsx` (vendor self-service portal)
- `/*` → `src/App.jsx` (admin app)

**`src/App.jsx`** is a single ~9000+ line file containing every page component, helper function, and all state. There are no separate component files — everything lives here. Sections are delimited by `// ─── SECTION NAME ───` comments.

**`src/lib/supabase.js`** — thin wrapper that exports the Supabase client, reading `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from env vars (`.env` file at project root).

## Design System

All colors and tokens are in the `C` object at the top of `App.jsx`:
```js
C.coral, C.coralDark, C.coralLight  // primary brand
C.textPri, C.textSec, C.textTer     // text hierarchy
C.border, C.borderMid               // borders
C.tealBg/tealText, C.greenBg/greenText, C.amberBg/amberText, C.redBg/redText  // semantic colors
```

Styles use CSS-in-JS inline objects. Reusable patterns live in the `styles` object (e.g., `styles.btnPrimary`, `styles.card`, `styles.navItem(active)`).

## Layout Z-index / Sticky Stack

- Global nav (`AppHeader`): `position: fixed; top: 0; height: 56px; zIndex: 200`
- Top bar inside pages: `position: sticky; top: 56px; height: 52px`
- Vendor detail header card (inside RFA form): `position: sticky; top: 108px` (56 + 52)
- Comparison table `<th>`: `position: sticky; top: 0` inside a `maxHeight: 480` overflow container

## Key Helpers (in App.jsx)

| Function | Purpose |
|---|---|
| `computeProposalTotals(proposals)` | Returns `{ subtotal, taxes, total }` |
| `computeTimelineFeasibility(vendor, pr)` | Returns `{ ok, total, avail, shortBy, breakdown, components, durLabel }` |
| `computePaymentBreakdown(ptType, ptData, total)` | Payment schedule breakdown |
| `autoBondAmounts(ptType, ptData, total)` | Auto-compute performance/warranty bonds |
| `defaultPtData()` | Default payment term data shape |

## Payment Type Feature Flags (Sets)

```js
PT_HAS_DP          // has downpayment
PT_HAS_PROGRESS    // has progress billing
PT_HAS_RETENTION   // has retention (non-milestone)
PT_IS_MILESTONE    // milestone billing type
PT_HAS_COMPLETION  // has completion payment
```

Milestone billing has its own opt-in retention via `payment_term_data.milestone_has_retention` (boolean) and `milestone_retention_mode` (`"each"` | `"final"`), separate from `PT_HAS_RETENTION`.

## Supabase Notes

- Project ID: `nrdeigqqrrtgazdkdzlh`
- `rfa_vendors.vendor_id` column is UUID but integer IDs are used in app code — workaround: embed integer id as `payment_term_data.__vendor_id` and pass `null` to the UUID column when saving.
- `vendorEstDays[]` is pre-computed per-vendor to unify `work_duration` and `end_date` completion modes into a single days-to-completion value for timeline comparison.
