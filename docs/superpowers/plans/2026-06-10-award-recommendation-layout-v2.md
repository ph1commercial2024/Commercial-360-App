# Award Recommendation Layout v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the Award Recommendation section so the two-column grid uses equal columns, contract terms move to a full-width row below the split, and the redundant empty-state placeholder is removed.

**Architecture:** All changes are surgical JSX edits inside a single 140-line block in `src/App.jsx` (~lines 9167–9303). No new state, no new helpers, no logic changes — only layout restructuring and one block deletion.

**Tech Stack:** React 19, CSS-in-JS inline styles, design tokens from the `C` object at the top of `App.jsx`.

---

## File Map

| File | Change |
|---|---|
| `src/App.jsx` | 4 targeted edits inside the Award Recommendation body (~lines 9167–9303) |

---

### Task 1: Restructure Award Recommendation layout

**Files:**
- Modify: `src/App.jsx` lines 9167–9303

This is one cohesive JSX restructuring. All four sub-tasks touch the same block and must be completed together to keep the file in a working state.

**Context:** The Award Recommendation block lives inside the Summary tab IIFE in `src/App.jsx`. The block structure after this task will be:
```
card header
risk banner
[grid 1fr 1fr]
  left: vendor card
  right: justification textarea only
[/grid]
full-width contract terms row  ← moved here from inside right column
footer
```

---

- [ ] **Sub-task A: Change grid ratio + fix stale comment**

Find this exact line (line ~9167):

```jsx
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: 0 }}>
```

Replace with:

```jsx
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
```

Then find the stale comment on the next line (~9169):

```jsx
                    {/* Left: recommended vendor display + risk flags */}
```

Replace with:

```jsx
                    {/* Left: recommended vendor display */}
```

---

- [ ] **Sub-task B: Strip contract terms and empty placeholder from the right column**

Find this entire block inside the right column (starts at the comment, ends with the `)}` of `{!awarV && ...}`):

```jsx
                      {/* Recommended terms summary (auto-populated when vendor selected) */}
                      {awarV && awarVc && (
                        <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
                          {/* Header: total amount */}
                          <div style={{ padding: "8px 14px", background: C.coralLight, borderBottom: `1px solid ${C.coral}20`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: 11, fontWeight: 600, color: C.textSec }}>Total Contract Amount</span>
                            <span style={{ fontSize: 14, fontWeight: 700, fontFamily: "monospace", color: C.coral }}>
                              {awarVc.tot > 0 ? `₱ ${fmtPeso(awarVc.tot)}` : "—"}
                            </span>
                          </div>
                          {/* 3-column body */}
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", background: "#fff" }}>
                            {/* Column 1: Payment Schedule */}
                            <div style={{ padding: "10px 14px", borderRight: `1px solid ${C.border}` }}>
                              <div style={{ fontSize: 10, fontWeight: 700, color: C.textTer, textTransform: "uppercase", marginBottom: 6 }}>Payment Schedule</div>
                              {awarBreakdown.length > 0 ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                                  {awarBreakdown.map((row, i) => (
                                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                      <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: C.textSec }}>
                                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: row.color, display: "inline-block", flexShrink: 0 }} />
                                        {row.label}
                                      </span>
                                      <span style={{ fontSize: 11, fontFamily: "monospace", fontWeight: 600, color: C.textPri }}>
                                        {awarVc.tot > 0 ? `₱ ${fmtPeso(row.amount)}` : "—"}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span style={{ fontSize: 11, color: C.textTer }}>—</span>
                              )}
                            </div>
                            {/* Column 2: Required Bonds */}
                            <div style={{ padding: "10px 14px", borderRight: `1px solid ${C.border}` }}>
                              <div style={{ fontSize: 10, fontWeight: 700, color: C.textTer, textTransform: "uppercase", marginBottom: 6 }}>Required Bonds</div>
                              {(awarAutoAmts.surety > 0 || awarAutoAmts.performance > 0 || awarAutoAmts.warranty > 0) ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                  {[
                                    { label: "Surety Bond",      amt: awarAutoAmts.surety },
                                    { label: "Performance Bond", amt: awarAutoAmts.performance },
                                    { label: "Warranty Bond",    amt: awarAutoAmts.warranty },
                                  ].filter(b => b.amt > 0).map(b => (
                                    <div key={b.label} style={{ display: "flex", justifyContent: "space-between" }}>
                                      <span style={{ fontSize: 11, color: C.textSec }}>{b.label}</span>
                                      <span style={{ fontSize: 11, fontFamily: "monospace", fontWeight: 600, color: C.textPri }}>₱ {fmtPeso(b.amt)}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span style={{ fontSize: 11, color: C.textTer }}>None required</span>
                              )}
                            </div>
                            {/* Column 3: Timeline */}
                            <div style={{ padding: "10px 14px" }}>
                              <div style={{ fontSize: 10, fontWeight: 700, color: C.textTer, textTransform: "uppercase", marginBottom: 6 }}>Timeline</div>
                              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                                {[
                                  { label: "Commencement",      value: COMMENCEMENT_TYPES.find(c => c.value === awarVc.ptd.commencement_type)?.label },
                                  { label: "Work Duration",     value: awarVc.ptd.completion_mode === "work_duration" && awarVc.ptd.work_duration ? `${awarVc.ptd.work_duration} ${awarVc.ptd.work_duration_type === "working_days" ? "Working Days" : "Calendar Days"}` : null },
                                  { label: "Target Completion", value: (awarVc.ptd.completion_mode || "end_date") === "end_date" && awarV.completion_date ? fmtShort(awarV.completion_date) : null },
                                  { label: "Warranty / DLP",    value: awarVc.ptd.warranty_period ? `${awarVc.ptd.warranty_period} month(s)` : null },
                                ].filter(f => f.value).map(f => (
                                  <div key={f.label}>
                                    <div style={{ fontSize: 9, fontWeight: 700, color: C.textTer, textTransform: "uppercase", marginBottom: 1 }}>{f.label}</div>
                                    <div style={{ fontSize: 11, fontWeight: 600, color: C.textPri }}>{f.value}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                      {!awarV && (
                        <div style={{ padding: "16px", background: C.offWhite, borderRadius: 10, border: `1px solid ${C.border}`, textAlign: "center" }}>
                          <div style={{ fontSize: 18, marginBottom: 5 }}>☝️</div>
                          <div style={{ fontSize: 12, color: C.textTer }}>Click a vendor column in the comparison table to see the recommended contract terms.</div>
                        </div>
                      )}
```

Delete it entirely. Leave no replacement — the right column now ends after the `autoGenNotice` block. The right column closing `</div>` that follows stays.

---

- [ ] **Sub-task C: Add contract terms as full-width section below the grid**

Find the closing `</div>` of the two-column grid and the start of the footer comment, which look like this:

```jsx
                  </div>

                  {/* Footer: prepared by */}
```

Replace with:

```jsx
                  </div>

                  {/* Contract terms: full-width row below the split */}
                  {awarV && awarVc && (
                    <div style={{ borderTop: `1px solid ${C.border}`, padding: "14px 20px", background: C.offWhite }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: C.textTer, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>Recommended Contract Terms</div>
                      <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
                        {/* Header: total amount */}
                        <div style={{ padding: "8px 14px", background: C.coralLight, borderBottom: `1px solid ${C.coral}20`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: C.textSec }}>Total Contract Amount</span>
                          <span style={{ fontSize: 14, fontWeight: 700, fontFamily: "monospace", color: C.coral }}>
                            {awarVc.tot > 0 ? `₱ ${fmtPeso(awarVc.tot)}` : "—"}
                          </span>
                        </div>
                        {/* 3-column body */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", background: "#fff" }}>
                          {/* Column 1: Payment Schedule */}
                          <div style={{ padding: "10px 14px", borderRight: `1px solid ${C.border}` }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: C.textTer, textTransform: "uppercase", marginBottom: 6 }}>Payment Schedule</div>
                            {awarBreakdown.length > 0 ? (
                              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                                {awarBreakdown.map((row, i) => (
                                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: C.textSec }}>
                                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: row.color, display: "inline-block", flexShrink: 0 }} />
                                      {row.label}
                                    </span>
                                    <span style={{ fontSize: 11, fontFamily: "monospace", fontWeight: 600, color: C.textPri }}>
                                      {awarVc.tot > 0 ? `₱ ${fmtPeso(row.amount)}` : "—"}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span style={{ fontSize: 11, color: C.textTer }}>—</span>
                            )}
                          </div>
                          {/* Column 2: Required Bonds */}
                          <div style={{ padding: "10px 14px", borderRight: `1px solid ${C.border}` }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: C.textTer, textTransform: "uppercase", marginBottom: 6 }}>Required Bonds</div>
                            {(awarAutoAmts.surety > 0 || awarAutoAmts.performance > 0 || awarAutoAmts.warranty > 0) ? (
                              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                {[
                                  { label: "Surety Bond",      amt: awarAutoAmts.surety },
                                  { label: "Performance Bond", amt: awarAutoAmts.performance },
                                  { label: "Warranty Bond",    amt: awarAutoAmts.warranty },
                                ].filter(b => b.amt > 0).map(b => (
                                  <div key={b.label} style={{ display: "flex", justifyContent: "space-between" }}>
                                    <span style={{ fontSize: 11, color: C.textSec }}>{b.label}</span>
                                    <span style={{ fontSize: 11, fontFamily: "monospace", fontWeight: 600, color: C.textPri }}>₱ {fmtPeso(b.amt)}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span style={{ fontSize: 11, color: C.textTer }}>None required</span>
                            )}
                          </div>
                          {/* Column 3: Timeline */}
                          <div style={{ padding: "10px 14px" }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: C.textTer, textTransform: "uppercase", marginBottom: 6 }}>Timeline</div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                              {[
                                { label: "Commencement",      value: COMMENCEMENT_TYPES.find(c => c.value === awarVc.ptd.commencement_type)?.label },
                                { label: "Work Duration",     value: awarVc.ptd.completion_mode === "work_duration" && awarVc.ptd.work_duration ? `${awarVc.ptd.work_duration} ${awarVc.ptd.work_duration_type === "working_days" ? "Working Days" : "Calendar Days"}` : null },
                                { label: "Target Completion", value: (awarVc.ptd.completion_mode || "end_date") === "end_date" && awarV.completion_date ? fmtShort(awarV.completion_date) : null },
                                { label: "Warranty / DLP",    value: awarVc.ptd.warranty_period ? `${awarVc.ptd.warranty_period} month(s)` : null },
                              ].filter(f => f.value).map(f => (
                                <div key={f.label}>
                                  <div style={{ fontSize: 9, fontWeight: 700, color: C.textTer, textTransform: "uppercase", marginBottom: 1 }}>{f.label}</div>
                                  <div style={{ fontSize: 11, fontWeight: 600, color: C.textPri }}>{f.value}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Footer: prepared by */}
```

---

- [ ] **Sub-task D: Build and verify**

Run:
```bash
npm run build
```

Expected: `✓ built in X.XXs` with 383 modules transformed, no errors.

Then open `http://localhost:5173`, navigate to an RFA → Summary & Recommendation tab and verify:

1. **Vendor selected, no risk flags**: two equal columns on top (vendor card left, justification right), then a full-width `Recommended Contract Terms` section below with the coral total header and 3-column grid. Payment schedule labels are no longer cramped.
2. **Vendor selected, risk flag**: same layout, amber/red banner shows between card header and the two-column body.
3. **No vendor selected**: two equal columns show (left has dashed "☝️ No vendor selected", right has empty justification textarea). No second empty-state placeholder below the columns.

- [ ] **Sub-task E: Commit**

```bash
git add src/App.jsx
git commit -m "refactor: move contract terms to full-width row, equal columns, remove redundant empty state"
```

---

## Verification Checklist

- [ ] Grid ratio is `1fr 1fr` (not `1fr 1.6fr`)
- [ ] Right column contains only the justification textarea and auto-gen notice
- [ ] Contract terms panel appears full-width below the grid when a vendor is selected
- [ ] Contract terms section does not render when no vendor is selected
- [ ] The old `{!awarV && <div>☝️ Click a vendor…contract terms</div>}` block is gone
- [ ] Build passes: 383 modules, no errors
- [ ] No console errors in the browser
