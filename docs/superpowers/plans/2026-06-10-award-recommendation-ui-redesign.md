# Award Recommendation UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Award Recommendation card in the RFA form with a risk banner strip, improved vendor card hierarchy, coral-coloured auto-recommend button, and a 3-column contract terms panel.

**Architecture:** All changes are self-contained JSX edits inside the `{/* ── Award Recommendation ── */}` block in `src/App.jsx`. No new state, no new helpers, no database changes. The block starts around the `<div style={{ ...styles.card, padding: 0, overflow: "hidden" }}>` that follows the comparison table.

**Tech Stack:** React 19, CSS-in-JS inline styles, design tokens from the `C` object at the top of `App.jsx`.

---

## File Map

| File | Change |
|---|---|
| `src/App.jsx` | All 5 tasks — edits within the Award Recommendation block (~lines 9090–9302) |

No files are created. No helpers are added.

---

### Task 1: Fix auto-recommend button and auto-gen notice colors

**Files:**
- Modify: `src/App.jsx` (Award Recommendation header + auto-gen notice)

**Context:** The button currently uses hard-coded purple (`#7C3AED`, `#F5F3FF`). The auto-gen notice uses the same purple. Both should use the app's coral secondary style (`C.coralLight` / `C.coralDark`).

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

Open http://localhost:5173, navigate to an RFA, go to the Summary & Recommendation tab. Keep it open for visual verification after each task.

- [ ] **Step 2: Fix the auto-recommend button style**

Find this in `src/App.jsx` (inside the Award Recommendation header div):

```jsx
<button onClick={autoRecommend}
  style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 7, border: `1px solid #7C3AED40`, background: "#F5F3FF", color: "#7C3AED", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
  ⚡ Auto-recommend
</button>
```

Replace with:

```jsx
<button onClick={autoRecommend}
  style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 7, border: `1px solid ${C.coral}40`, background: C.coralLight, color: C.coralDark, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
  ⚡ Auto-recommend
</button>
```

- [ ] **Step 3: Fix the auto-gen notice style**

Find this (inside the justification div, below the textarea):

```jsx
{autoGenNotice && (
  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, padding: "5px 10px", borderRadius: 6, background: "#F5F3FF", border: "1px solid #7C3AED30" }}>
    <span style={{ fontSize: 13 }}>⚡</span>
    <span style={{ fontSize: 10, color: "#7C3AED", fontWeight: 600 }}>Auto-generated — review and edit as needed</span>
  </div>
)}
```

Replace with:

```jsx
{autoGenNotice && (
  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, padding: "5px 10px", borderRadius: 6, background: C.coralLight, border: `1px solid ${C.coral}30` }}>
    <span style={{ fontSize: 12 }}>⚡</span>
    <span style={{ fontSize: 10, color: C.coralDark, fontWeight: 600 }}>Auto-generated — review and edit as needed</span>
  </div>
)}
```

- [ ] **Step 4: Verify visually**

Check in the browser: the ⚡ Auto-recommend button should now be coral-tinted (same warm red-pink as the rest of the UI, not purple). Click it — the auto-gen notice below the textarea should also be coral, not purple.

---

### Task 2: Fix vendor card hierarchy

**Files:**
- Modify: `src/App.jsx` (vendor card inside left panel, ~lines 9116–9134)

**Context:** Currently every text element in the vendor card is `color: C.coral` — name, amount, and the label all look the same. Fix: label stays coral (accent only), name becomes dark (`C.textPri`), amount stays coral, card background becomes neutral.

- [ ] **Step 1: Replace the vendor card inner div**

Find this block (the filled vendor card, inside the left panel):

```jsx
<div style={{ padding: "12px 14px", borderRadius: 9, background: C.coralLight, border: `2px solid ${C.coral}40` }}>
  <div style={{ fontSize: 9, fontWeight: 700, color: C.coral, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}>
    Vendor {awarVi + 1} · ★ Recommended
  </div>
  <div style={{ fontSize: 14, fontWeight: 700, color: C.coral, marginBottom: 5 }}>
    {awarVInfo?.full_name || "—"}
  </div>
  {awarVc?.tot > 0 && (
    <div style={{ fontSize: 13, fontFamily: "monospace", fontWeight: 600, color: C.coral, marginBottom: 5 }}>
      ₱ {fmtPeso(awarVc.tot)}
    </div>
  )}
  {awarVc?.ptLabel && (
    <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 9px", borderRadius: 20, background: "#EFF6FF", color: "#2563EB", border: "1px solid #BFDBFE" }}>
      {awarVc.ptLabel}
    </span>
  )}
</div>
```

Replace with:

```jsx
<div style={{ padding: "12px 14px", borderRadius: 9, background: C.surface, border: `1px solid ${C.border}` }}>
  <div style={{ fontSize: 9, fontWeight: 700, color: C.coral, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>
    ★ Recommended
  </div>
  <div style={{ fontSize: 15, fontWeight: 700, color: C.textPri, marginBottom: 3 }}>
    {awarVInfo?.full_name || "—"}
  </div>
  {awarVc?.tot > 0 && (
    <div style={{ fontSize: 14, fontFamily: "monospace", fontWeight: 700, color: C.coral, marginBottom: 8 }}>
      ₱ {fmtPeso(awarVc.tot)}
    </div>
  )}
  {awarVc?.ptLabel && (
    <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 9px", borderRadius: 20, background: "#EFF6FF", color: "#2563EB", border: "1px solid #BFDBFE" }}>
      {awarVc.ptLabel}
    </span>
  )}
</div>
```

- [ ] **Step 2: Verify visually**

The vendor card should now show: small coral "★ Recommended" label → large dark vendor name → coral monospace amount → blue payment type badge. The card background is neutral gray, not coral-tinted.

---

### Task 3: Move risk flags to a banner strip + fix layout ratio

**Files:**
- Modify: `src/App.jsx` (header block, grid div, left panel)

**Context:** Risk flags currently live in the left panel below the vendor card. They move to a colored banner strip between the card header and the two-column body. The grid ratio also changes from `1fr 1.4fr` to `1fr 1.6fr`.

- [ ] **Step 1: Add the risk banner after the header div**

Find the closing tag of the Award Recommendation header div. It looks like this:

```jsx
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 0 }}>
```

Replace the opening grid div line (keep everything else):

```jsx
                  </div>
                </div>

                {/* ── Risk banner ── */}
                {awarV && riskFlags.length === 0 && (
                  <div style={{ padding: "7px 20px", background: C.tealBg, borderBottom: `1px solid #B6E8D4`, display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: C.tealText }}>✓ No risk flags — all criteria met</span>
                  </div>
                )}
                {riskFlags.length > 0 && (
                  <div style={{ padding: "10px 20px", borderBottom: `1px solid ${C.border}` }}>
                    {riskFlags.map((f, i) => {
                      const bg    = f.level === "error" ? C.redBg  : f.level === "warn" ? C.amberBg : "#EFF6FF";
                      const color = f.level === "error" ? C.redText : f.level === "warn" ? C.amberText : "#2563EB";
                      const icon  = f.level === "error" ? "🔴" : f.level === "warn" ? "⚠" : "ℹ";

                      if (f.type === "timeline") {
                        const { feas } = f;
                        return (
                          <div key={i} style={{ background: bg, borderRadius: 8, padding: "10px 12px", border: `1px solid ${color}30`, marginBottom: i < riskFlags.length - 1 ? 6 : 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                              <span>🔴</span>
                              <span style={{ fontSize: 11, fontWeight: 700, color }}>Timeline Feasibility Warning</span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
                              {feas.components.map((c, ci) => (
                                <React.Fragment key={ci}>
                                  <div style={{ fontSize: 10, padding: "3px 8px", borderRadius: 5, background: "rgba(0,0,0,0.07)", color, fontWeight: 600 }}>
                                    <span style={{ fontSize: 12 }}>{c.days}d</span>
                                    <span style={{ fontWeight: 400, marginLeft: 3 }}>{c.label}</span>
                                  </div>
                                  {ci < feas.components.length - 1 && <span style={{ color, fontSize: 11 }}>+</span>}
                                </React.Fragment>
                              ))}
                              <span style={{ color, fontSize: 11 }}>=</span>
                              <div style={{ fontSize: 10, padding: "3px 8px", borderRadius: 5, background: color, color: "#fff", fontWeight: 700 }}>
                                {feas.total}d total
                              </div>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "130px 1fr", gap: "3px 0", fontSize: 11 }}>
                              <span style={{ color }}>Days to Completion</span>
                              <span style={{ fontWeight: 700, color, fontFamily: "monospace" }}>{feas.total} days</span>
                              <span style={{ color }}>Available</span>
                              <span style={{ fontFamily: "monospace", color }}>{feas.avail} days</span>
                              <span style={{ borderTop: `1px solid ${color}40`, paddingTop: 3, color }}></span>
                              <span style={{ borderTop: `1px solid ${color}40`, paddingTop: 3, fontWeight: 700, color, fontFamily: "monospace" }}>
                                Short by {feas.shortBy} day{feas.shortBy !== 1 ? "s" : ""}
                              </span>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div key={i} style={{ fontSize: 11, padding: "7px 10px", borderRadius: 7, lineHeight: 1.4, background: bg, color, marginBottom: i < riskFlags.length - 1 ? 6 : 0 }}>
                          {icon} {f.msg}
                        </div>
                      );
                    })}
                  </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: 0 }}>
```

- [ ] **Step 2: Remove the Risk & Deviation Flags section from the left panel**

Find this entire block inside the left panel (comes right after the vendor card closing `</div>`):

```jsx
                      {/* Risk flags */}
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: C.textTer, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>Risk & Deviation Flags</div>
                        {riskFlags.length === 0 ? (
                          <div style={{ fontSize: 11, padding: "8px 12px", background: "#D1FAE5", borderRadius: 7, color: C.greenText, fontWeight: 600 }}>✓ No issues detected</div>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                            {riskFlags.map((f, i) => {
                              const bg    = f.level === "error" ? "#FEE2E2" : f.level === "warn" ? C.amberBg : "#EFF6FF";
                              const color = f.level === "error" ? C.redText  : f.level === "warn" ? C.amberText : "#2563EB";
                              const icon  = f.level === "error" ? "🔴" : f.level === "warn" ? "⚠" : "ℹ";

                              // ── Structured timeline card ──
                              if (f.type === "timeline") {
                                const { feas } = f;
                                return (
                                  <div key={i} style={{ background: bg, borderRadius: 8, padding: "10px 12px", border: `1px solid ${color}30` }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                                      <span>🔴</span>
                                      <span style={{ fontSize: 11, fontWeight: 700, color }}>Timeline Feasibility Warning</span>
                                    </div>
                                    {/* Component chain */}
                                    <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
                                      {feas.components.map((c, ci) => (
                                        <React.Fragment key={ci}>
                                          <div style={{ fontSize: 10, padding: "3px 8px", borderRadius: 5, background: "rgba(0,0,0,0.07)", color, fontWeight: 600 }}>
                                            <span style={{ fontSize: 12 }}>{c.days}d</span>
                                            <span style={{ fontWeight: 400, marginLeft: 3 }}>{c.label}</span>
                                          </div>
                                          {ci < feas.components.length - 1 && <span style={{ color, fontSize: 11 }}>+</span>}
                                        </React.Fragment>
                                      ))}
                                      <span style={{ color, fontSize: 11 }}>=</span>
                                      <div style={{ fontSize: 10, padding: "3px 8px", borderRadius: 5, background: color, color: "#fff", fontWeight: 700 }}>
                                        {feas.total}d total
                                      </div>
                                    </div>
                                    {/* Comparison */}
                                    <div style={{ display: "grid", gridTemplateColumns: "130px 1fr", gap: "3px 0", fontSize: 11 }}>
                                      <span style={{ color }}>Days to Completion</span>
                                      <span style={{ fontWeight: 700, color, fontFamily: "monospace" }}>{feas.total} days</span>
                                      <span style={{ color }}>Available</span>
                                      <span style={{ fontFamily: "monospace", color }}>{feas.avail} days</span>
                                      <span style={{ borderTop: `1px solid ${color}40`, paddingTop: 3, color }}></span>
                                      <span style={{ borderTop: `1px solid ${color}40`, paddingTop: 3, fontWeight: 700, color, fontFamily: "monospace" }}>
                                        Short by {feas.shortBy} day{feas.shortBy !== 1 ? "s" : ""}
                                      </span>
                                    </div>
                                  </div>
                                );
                              }

                              // ── Default plain flag ──
                              return (
                                <div key={i} style={{ fontSize: 11, padding: "7px 10px", borderRadius: 7, lineHeight: 1.4, background: bg, color }}>
                                  {icon} {f.msg}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
```

Delete that entire block (leave no replacement — the left panel will only contain the vendor card section).

- [ ] **Step 3: Verify visually**

- When a vendor is selected with no issues: a slim green "✓ No risk flags" bar should appear between the card header and the two-column body.
- When a vendor has a timeline warning: the amber/red banner expands with the component chain.
- The left panel should only contain "Recommended Vendor" — no more risk section below it.
- The right panel (justification) should be noticeably wider than before.

---

### Task 4: Rebuild contract terms as a 3-column panel

**Files:**
- Modify: `src/App.jsx` (contract terms section in right panel, ~lines 9226–9291)

**Context:** The current contract terms section is a vertical list inside a coral-bordered card. Replace it with a 3-column horizontal panel (Payment Schedule | Required Bonds | Timeline) inside a neutral-bordered container, with a coral header bar showing the total amount.

- [ ] **Step 1: Replace the entire contract terms block**

Find this block (the filled state, starting with the comment):

```jsx
                      {/* Recommended terms summary (auto-populated when vendor selected) */}
                      {awarV && awarVc && (
                        <div style={{ border: `1px solid ${C.coral}30`, borderRadius: 10, overflow: "hidden" }}>
                          <div style={{ padding: "9px 14px", background: C.coralLight, borderBottom: `1px solid ${C.coral}20` }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: C.coral }}>Recommended Contract Terms — {awarVInfo?.full_name || `Vendor ${awarVi + 1}`}</span>
                          </div>
```

...all the way through the closing `</div>` of `{awarV && awarVc && (`, ending just before:

```jsx
                      {!awarV && (
```

Replace the entire `{awarV && awarVc && ( ... )}` block with:

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
```

- [ ] **Step 2: Verify visually**

Select a vendor. The contract terms section should now show three side-by-side columns inside a single bordered container: payment schedule with colored dots and amounts on the left, bond amounts in the middle, timeline fields on the right. The coral header bar shows the total amount.

- [ ] **Step 3: Check edge cases**
  - Vendor with no bonds: "None required" shows in the bonds column.
  - Vendor using `end_date` mode: Work Duration row is hidden, Target Completion shows.
  - Vendor using `work_duration` mode: Work Duration shows, Target Completion is hidden.
  - Vendor with no warranty period: Warranty/DLP row is hidden.

---

## Verification Checklist

After all 4 tasks are done, verify the full section:

- [ ] Auto-recommend button: coral tint, not purple
- [ ] Auto-gen notice: coral tint, not purple
- [ ] Vendor card: dark name, coral amount, neutral background
- [ ] No vendor selected: no risk banner visible, empty state placeholders show as before
- [ ] Vendor selected, no issues: slim green banner between header and body
- [ ] Vendor selected, timeline warning: amber/red banner expands with component chain
- [ ] Left panel contains only the vendor card (risk flags section gone)
- [ ] Right panel is visibly wider than the left
- [ ] Contract terms: 3-column layout with total amount in coral header bar
- [ ] No console errors in the browser
