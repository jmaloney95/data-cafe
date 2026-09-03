// In-app Dashboard view — React component that renders the same dashboard
// the standalone HTML export produces, but lives inside Insight Concierge.
//
// Reads from window.AGG (aggregations.jsx) and window.Chart (chart.umd.min.js).
// Both must be loaded before this file is parsed.

(function () {
  const { useState, useEffect, useMemo, useRef } = React;

  // ============== CSS (injected once on first mount) =====================
  const DASH_CSS = `
.dash {
  animation: dashFade .35s ease;
  position: relative; z-index: 1;
}
@keyframes dashFade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }

.dash-bar {
  display: flex; align-items: center; gap: 14px;
  padding: 14px 28px;
  background: color-mix(in oklab, var(--paper) 80%, transparent);
  -webkit-backdrop-filter: blur(14px);
  backdrop-filter: blur(14px);
  border-bottom: 1px solid var(--line);
  position: sticky; top: 64px; z-index: 20;
}
.dash-bar .back {
  display: inline-flex; align-items: center; gap: 6px;
  appearance: none; background: transparent; border: 1px solid var(--line-strong);
  color: var(--ink); font: inherit; font-size: 13px;
  padding: 7px 14px; border-radius: 999px;
  cursor: pointer; transition: background .15s, color .15s;
}
.dash-bar .back:hover { background: color-mix(in oklab, var(--ink) 5%, transparent); }
.dash-bar .stamp { font-family: var(--font-mono); font-size: 9.5px; letter-spacing: .14em;
                   text-transform: uppercase; color: var(--ink-mute); }
.dash-bar .spacer { flex: 1; }
.dash-bar .export {
  display: inline-flex; align-items: center; gap: 6px;
  appearance: none; background: transparent; border: 1px solid var(--line-strong);
  color: var(--ink-soft); font: inherit; font-size: 12.5px;
  padding: 7px 13px; border-radius: 999px;
  cursor: pointer;
}
.dash-bar .export:hover { color: var(--ink); border-color: var(--accent); }
.dash-bar .pill {
  font-family: var(--font-mono); font-size: 9.5px; letter-spacing: .14em;
  text-transform: uppercase;
  background: color-mix(in oklab, var(--accent) 14%, transparent);
  color: var(--accent);
  padding: 4px 9px; border-radius: 4px;
}
.dash-bar .save {
  display: inline-flex; align-items: center; gap: 6px;
  appearance: none; border: 0; cursor: pointer; font: inherit;
  background: var(--ink); color: var(--paper);
  font-size: 13px; font-weight: 500;
  padding: 7px 14px; border-radius: 999px;
}
[data-theme="midnight"] .dash-bar .save { background: var(--accent); color: var(--bg); }
.dash-bar .save:hover { transform: translateY(-1px); box-shadow: var(--shadow-sm); }
.dash-bar .save:disabled { opacity: .6; cursor: default; transform: none; box-shadow: none; }
.dash-bar .saved-pill {
  display: inline-flex; align-items: center; gap: 8px;
  background: color-mix(in oklab, var(--ok) 14%, transparent);
  border: 1px solid color-mix(in oklab, var(--ok) 40%, transparent);
  color: var(--ok);
  padding: 4px 6px 4px 12px;
  border-radius: 999px;
  font-size: 12px;
}
.dash-bar .saved-pill .nm { font-weight: 500; max-width: 26ch; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dash-bar .saved-pill input.nm-edit {
  font: inherit; font-size: 12px; font-weight: 500;
  background: transparent; border: 0; outline: 0;
  color: var(--ok); padding: 0; min-width: 12ch;
  border-bottom: 1px dashed color-mix(in oklab, var(--ok) 50%, transparent);
}
.dash-bar .saved-pill .pencil {
  appearance: none; background: transparent; border: 0; color: var(--ok);
  cursor: pointer; width: 22px; height: 22px; border-radius: 50%;
  display: grid; place-items: center; padding: 0;
}
.dash-bar .saved-pill .pencil:hover { background: color-mix(in oklab, var(--ok) 16%, transparent); }
.dash-bar .refresh-pill {
  display: inline-flex; align-items: center; gap: 6px;
  font-family: var(--font-mono); font-size: 9.5px; letter-spacing: .14em;
  text-transform: uppercase;
  background: color-mix(in oklab, var(--accent) 14%, transparent);
  color: var(--accent);
  padding: 4px 6px 4px 9px; border-radius: 4px;
}
.dash-bar .refresh-pill button {
  appearance: none; background: transparent; border: 0; color: var(--accent);
  cursor: pointer; width: 22px; height: 22px; border-radius: 50%;
  display: grid; place-items: center; padding: 0;
}
.dash-bar .refresh-pill button:hover { background: color-mix(in oklab, var(--accent) 22%, transparent); }
.dash-bar .refresh-pill button.spinning { animation: dashSpin .6s linear; }
@keyframes dashSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

/* dash-canvas is the themed surface that holds the actual report. It carries
   data-theme so the manifest theme (cream / midnight / print) scopes here and
   not on the dash-bar above. Paints the background so the report's theme
   actually shows up edge-to-edge. */
.dash .dash-canvas {
  background: var(--bg);
  border-top: 1px solid var(--line);
  min-height: calc(100vh - 130px);
  color: var(--ink);
  transition: background .2s ease;
}
.dash main { max-width: 1180px; margin: 0 auto; padding: 28px 28px 80px; color: var(--ink); }

.dash .title-row {
  display: flex; align-items: end; justify-content: space-between;
  gap: 24px; margin-bottom: 22px;
  padding-bottom: 18px; border-bottom: 1px solid var(--line);
}
.dash .title-row h1 { font-size: 32px; line-height: 1.08; margin-bottom: 6px; }
.dash .title-row h1 em { font-style: italic; color: var(--accent); font-weight: 400; }
.dash .title-row .meta { display: flex; gap: 14px; flex-wrap: wrap;
                          font-size: 12.5px; color: var(--ink-mute); }
.dash .title-row .meta strong { color: var(--ink); font-weight: 500; }
.dash .title-row .right { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }

.dash .window-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 18px; }
.dash .window-row .label { font-family: var(--font-mono); font-size: 10px;
  letter-spacing: .14em; text-transform: uppercase; color: var(--ink-mute); margin-right: 8px; }
.dash .window-row .chip {
  appearance: none; background: var(--paper); color: var(--ink-soft);
  border: 1px solid var(--line);
  font-family: var(--font-mono); font-size: 11px; letter-spacing: .08em;
  padding: 7px 13px; border-radius: 999px;
  cursor: pointer; transition: all .15s;
}
.dash .window-row .chip:hover { color: var(--ink); border-color: var(--line-strong); }
.dash .window-row .chip[aria-pressed="true"] { background: var(--ink); color: var(--paper); border-color: var(--ink); }
[data-theme="midnight"] .dash .window-row .chip[aria-pressed="true"] {
  background: var(--accent); color: var(--bg); border-color: var(--accent);
}
.dash .custom-range { display: flex; gap: 8px; align-items: center;
  margin-left: 8px; padding-left: 12px; border-left: 1px solid var(--line); }
.dash .custom-range input[type=date] {
  font: inherit; font-size: 12px;
  background: var(--paper); border: 1px solid var(--line); color: var(--ink);
  padding: 6px 10px; border-radius: 6px;
}

.dash .filter-row { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 18px; min-height: 1px; }
.dash .filter-chip {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 4px 6px 4px 12px;
  background: color-mix(in oklab, var(--accent) 14%, transparent);
  border: 1px solid var(--accent);
  border-radius: 999px;
  font-family: var(--font-mono); font-size: 11px; letter-spacing: .06em;
  color: var(--accent);
}
.dash .filter-chip button {
  appearance: none; background: transparent; border: 0; color: var(--accent);
  cursor: pointer; width: 18px; height: 18px; border-radius: 50%;
  display: grid; place-items: center; font-size: 12px; padding: 0;
}
.dash .filter-chip button:hover { background: color-mix(in oklab, var(--accent) 22%, transparent); }

.dash .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
              gap: 12px; margin-bottom: 22px; }
.dash .kpi {
  background: var(--paper); border: 1px solid var(--line);
  border-radius: 12px; padding: 16px 18px;
  display: flex; flex-direction: column; gap: 6px;
  box-shadow: var(--shadow-sm);
}
.dash .kpi .lbl { font-family: var(--font-mono); font-size: 9.5px;
  letter-spacing: .14em; text-transform: uppercase; color: var(--ink-mute); }
.dash .kpi .val { font-family: var(--font-display); font-size: 28px;
  font-weight: 500; color: var(--ink); font-variant-numeric: tabular-nums; line-height: 1.1; }
.dash .kpi .val small { font-family: var(--font-mono); font-size: 10px;
  color: var(--ink-mute); margin-left: 4px; letter-spacing: .1em; text-transform: uppercase; font-weight: 400; }
.dash .kpi .delta { display: flex; align-items: baseline; gap: 6px; font-size: 11.5px; }
.dash .kpi .delta.up   { color: var(--ok); }
.dash .kpi .delta.down { color: var(--crit); }
.dash .kpi .delta.flat { color: var(--ink-mute); }
.dash .kpi .delta .vs { font-family: var(--font-mono); font-size: 9px; color: var(--ink-mute);
                        letter-spacing: .1em; text-transform: uppercase; }
.dash .kpi .spark { height: 28px; margin-top: 4px; }
.dash .kpi .spark svg { width: 100%; height: 100%; overflow: visible; }
.dash .kpi .spark path { fill: none; stroke: var(--accent); stroke-width: 1.4; }
.dash .kpi .spark .area { fill: color-mix(in oklab, var(--accent) 14%, transparent); stroke: none; }

.dash .grid { display: grid; gap: 18px; grid-template-columns: repeat(2, 1fr); }
.dash .grid .chart-card.span2 { grid-column: span 2; }
.dash[data-layout="multi"] .grid { grid-template-columns: 1fr; }

.dash .chart-card {
  background: var(--paper); border: 1px solid var(--line);
  border-radius: 14px; padding: 18px 20px;
  box-shadow: var(--shadow-sm);
  display: flex; flex-direction: column; gap: 12px;
}
.dash .chart-card .chd { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
.dash .chart-card .chd h3 { font-family: var(--font-display); font-weight: 500; font-size: 17px; }
.dash .chart-card .chd .vt {
  font-family: var(--font-mono); font-size: 9.5px;
  letter-spacing: .14em; text-transform: uppercase; color: var(--ink-mute);
}
.dash .chart-card .body { position: relative; height: 220px; }
.dash[data-layout="multi"] .chart-card .body { height: 320px; }

.dash .stub {
  background: linear-gradient(135deg, var(--paper-2), var(--paper));
  border: 1px dashed var(--line-strong);
  border-radius: 10px;
  padding: 14px 16px;
  display: flex; align-items: center; gap: 12px;
  font-size: 12.5px; color: var(--ink-soft);
  margin-bottom: 8px;
}
.dash .stub .badge {
  font-family: var(--font-mono); font-size: 9px;
  letter-spacing: .14em; text-transform: uppercase;
  background: var(--accent-soft); color: var(--accent-deep);
  padding: 3px 7px; border-radius: 3px; flex-shrink: 0;
}
[data-theme="midnight"] .dash .stub .badge {
  background: color-mix(in oklab, var(--accent) 24%, transparent); color: var(--accent);
}
.dash .stub .msg em { font-style: italic; color: var(--accent); }

/* ---- Filter dropdowns row -------------------------------------------- */
.dash .filter-bar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
                    margin-bottom: 14px; padding-bottom: 14px;
                    border-bottom: 1px dashed var(--line); }
.dash .filter-bar .label { font-family: var(--font-mono); font-size: 10px;
  letter-spacing: .14em; text-transform: uppercase; color: var(--ink-mute); margin-right: 4px; }
.dash .filter-bar .dropdown { position: relative; display: inline-block; }
.dash .filter-bar select {
  appearance: none;
  background: var(--paper); color: var(--ink);
  border: 1px solid var(--line);
  font: inherit; font-size: 12px;
  padding: 7px 28px 7px 12px;
  border-radius: 6px;
  cursor: pointer;
  min-width: 8ch;
}
.dash .filter-bar select:hover { border-color: var(--line-strong); }
.dash .filter-bar select:focus { outline: 0; border-color: var(--accent); box-shadow: 0 0 0 2px color-mix(in oklab, var(--accent) 18%, transparent); }
.dash .filter-bar .dropdown::after {
  content: ""; position: absolute; right: 10px; top: 50%;
  transform: translateY(-25%) rotate(45deg);
  width: 6px; height: 6px;
  border-right: 1.5px solid var(--ink-mute);
  border-bottom: 1.5px solid var(--ink-mute);
  pointer-events: none;
}
.dash .filter-bar .clear-all {
  appearance: none; background: transparent; border: 0;
  font: inherit; font-size: 11.5px; color: var(--ink-mute);
  text-decoration: underline; cursor: pointer;
  margin-left: auto;
}
.dash .filter-bar .clear-all:hover { color: var(--accent); }
.dash .filter-bar .clear-all:disabled { opacity: .35; cursor: default; text-decoration: none; }

/* ---- Key Takeaways block --------------------------------------------- */
.dash .takeaways {
  background: var(--paper);
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 18px 22px;
  box-shadow: var(--shadow-sm);
  margin-bottom: 22px;
}
.dash .takeaways .head {
  display: flex; align-items: baseline; justify-content: space-between;
  border-bottom: 1px dashed var(--line);
  padding-bottom: 10px; margin-bottom: 12px;
  gap: 14px;
}
.dash .takeaways .head h3 {
  font-family: var(--font-display); font-style: italic;
  font-weight: 500; font-size: 18px;
}
.dash .takeaways .head h3 em { font-style: italic; color: var(--accent); font-weight: 400; }
.dash .takeaways .head .stamp {
  font-family: var(--font-mono); font-size: 9px; letter-spacing: .14em;
  text-transform: uppercase; color: var(--ink-mute);
}
.dash .takeaways .empty {
  background: transparent; border: 0; padding: 8px 4px; text-align: left;
  font-style: italic; color: var(--ink-mute); font-size: 13px;
  font-family: var(--font-display);
}
.dash .takeaways .item { display: flex; gap: 12px; padding: 10px 0;
                          border-bottom: 1px dashed color-mix(in oklab, var(--line) 60%, transparent); }
.dash .takeaways .item:last-child { border-bottom: 0; }
.dash .takeaways .marker {
  width: 28px; height: 28px; border-radius: 50%;
  display: grid; place-items: center; flex-shrink: 0;
  font-family: var(--font-display); font-size: 14px; font-weight: 600;
  color: var(--paper);
}
.dash .takeaways .item.critical .marker    { background: var(--crit); }
.dash .takeaways .item.outlier .marker     { background: var(--warn); }
.dash .takeaways .item.strength .marker    { background: var(--ok);   }
.dash .takeaways .item.opportunity .marker { background: var(--gold); }
.dash .takeaways .body { flex: 1; }
.dash .takeaways .lbl {
  display: inline-block;
  font-family: var(--font-mono); font-size: 9.5px; letter-spacing: .14em;
  text-transform: uppercase; font-weight: 600;
  margin-bottom: 4px;
}
.dash .takeaways .item.critical .lbl    { color: var(--crit); }
.dash .takeaways .item.outlier .lbl     { color: var(--warn); }
.dash .takeaways .item.strength .lbl    { color: var(--ok);   }
.dash .takeaways .item.opportunity .lbl { color: var(--gold); }
.dash .takeaways .prose { color: var(--ink-2); font-size: 13px; line-height: 1.55; }
.dash .takeaways .prose strong { color: var(--ink); font-weight: 600; }
.dash .takeaways .prose em { font-style: italic; color: var(--accent); font-weight: 500; }

/* ---- Scorecard layout ------------------------------------------------- */
.dash[data-layout="scorecard"] .grid,
.dash[data-layout="scorecard"] .kpis { display: none; }
/* Scorecard shares the same max-width as every other layout so the report
   reads at one consistent column width that fits a single screen. */
.dash[data-layout="scorecard"] main { max-width: 1180px; padding-left: 28px; padding-right: 28px; }

.dash .scorecard-hero {
  display: grid; grid-template-columns: 0.95fr 1.25fr 0.85fr; gap: 18px;
  background: var(--paper); border: 1px solid var(--line);
  border-radius: 14px; padding: 22px 28px; margin-bottom: 22px;
  box-shadow: var(--shadow-sm);
  align-items: center;
}
.dash .scorecard-hero > div {
  display: flex; flex-direction: column; align-items: center;
  text-align: center; padding: 6px; min-width: 0;
}
.dash .scorecard-hero .gauge svg { width: 240px; max-width: 100%; height: auto; }
.dash .scorecard-hero .gauge .lbl {
  margin-top: 4px;
  font-family: var(--font-mono); font-size: 9.5px; letter-spacing: .14em;
  text-transform: uppercase; color: var(--ink-mute);
}
.dash .scorecard-hero .gauge .score-num {
  font-family: var(--font-display); font-weight: 500;
  font-size: 56px; line-height: 1; color: var(--ink);
  font-variant-numeric: tabular-nums;
}
.dash .scorecard-hero .gauge .score-band {
  margin-top: 4px;
  font-family: var(--font-mono); font-size: 10.5px;
  letter-spacing: .12em; text-transform: uppercase;
}
.dash .scorecard-hero .gauge .score-band.band-ok   { color: var(--ok); }
.dash .scorecard-hero .gauge .score-band.band-warn { color: var(--warn); }
.dash .scorecard-hero .gauge .score-band.band-crit { color: var(--crit); }
.dash .scorecard-hero .radar { align-self: stretch; }
.dash .scorecard-hero .radar svg { width: 100%; max-width: 400px; height: auto; }
.dash .scorecard-hero .radar .lbl {
  font-family: var(--font-mono); font-size: 9.5px; letter-spacing: .14em;
  text-transform: uppercase; color: var(--ink-mute); margin-top: 4px;
}
.dash .scorecard-hero .legend {
  text-align: left; align-items: flex-start; padding: 12px 16px;
  background: var(--paper-2);
  border: 1px dashed var(--line);
  border-radius: 10px;
}
.dash .scorecard-hero .legend h4 {
  font-family: var(--font-display); font-style: italic; font-weight: 500;
  font-size: 15px; margin-bottom: 8px; color: var(--ink);
}
.dash .scorecard-hero .legend .row {
  display: flex; align-items: baseline; gap: 8px;
  font-size: 12px; color: var(--ink-2); margin-bottom: 6px;
}
.dash .scorecard-hero .legend .swatch {
  width: 10px; height: 10px; border-radius: 2px; flex-shrink: 0; align-self: center;
}
.dash .scorecard-hero .legend .swatch.ok   { background: var(--ok); }
.dash .scorecard-hero .legend .swatch.warn { background: var(--warn); }
.dash .scorecard-hero .legend .swatch.crit { background: var(--crit); }
.dash .scorecard-hero .legend .note {
  font-family: var(--font-display); font-style: italic;
  font-size: 12px; color: var(--ink-mute); margin-top: 8px;
  line-height: 1.5;
}

/* Auto-fit so the scorecard adapts when the user deselects some KPIs and a
   domain drops out — 5 cards fit at desktop width, 3 at tablet, 1 on mobile,
   and intermediate counts (1–4) lay out without leaving empty columns. */
.dash .domain-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(228px, 1fr));
  gap: 12px;
  margin-bottom: 22px;
}
.dash .domain-card {
  background: var(--paper); border: 1px solid var(--line);
  border-radius: 12px; padding: 14px 16px 12px;
  box-shadow: var(--shadow-sm);
  position: relative; overflow: hidden;
  display: flex; flex-direction: column; min-width: 0;
}
.dash .domain-card::before {
  content: ""; position: absolute; top: 0; left: 0; right: 0; height: 4px;
}
.dash .domain-card.band-ok::before   { background: var(--ok); }
.dash .domain-card.band-warn::before { background: var(--warn); }
.dash .domain-card.band-crit::before { background: var(--crit); }
.dash .domain-card .head {
  display: flex; flex-direction: column; gap: 2px;
  margin-bottom: 8px; padding-top: 4px;
}
.dash .domain-card .head h4 {
  font-family: var(--font-display); font-weight: 500; font-size: 16px;
  line-height: 1.1;
}
.dash .domain-card .head .meta-row {
  display: flex; align-items: baseline; gap: 8px;
  font-family: var(--font-mono); font-size: 9px; letter-spacing: .14em;
  text-transform: uppercase; color: var(--ink-mute);
}
.dash .domain-card .head .meta-row .summary { color: var(--ink-mute); font-family: var(--font-mono); }
.dash .domain-card .summary {
  display: none;
}
.dash .domain-card .score-row {
  display: flex; align-items: center; justify-content: space-between;
  gap: 8px; margin-bottom: 6px;
}
.dash .domain-card .score-row .num-wrap { display: flex; align-items: baseline; gap: 4px; }
.dash .domain-card .score-row .num {
  font-family: var(--font-display); font-weight: 500; font-size: 42px;
  line-height: 1; color: var(--ink); font-variant-numeric: tabular-nums;
}
.dash .domain-card .score-row .max {
  font-family: var(--font-display); font-style: italic; font-size: 13px;
  color: var(--ink-mute);
}
.dash .domain-card .score-row .band-pill {
  font-family: var(--font-mono); font-size: 8.5px; letter-spacing: .14em;
  text-transform: uppercase; padding: 3px 7px; border-radius: 999px;
  flex-shrink: 0;
}
.dash .domain-card.band-ok   .score-row .band-pill { background: color-mix(in oklab, var(--ok)   16%, transparent); color: var(--ok); }
.dash .domain-card.band-warn .score-row .band-pill { background: color-mix(in oklab, var(--warn) 16%, transparent); color: var(--warn); }
.dash .domain-card.band-crit .score-row .band-pill { background: color-mix(in oklab, var(--crit) 16%, transparent); color: var(--crit); }
.dash .domain-card .progress {
  height: 4px; border-radius: 2px;
  background: var(--paper-2);
  overflow: hidden; margin-bottom: 12px;
}
.dash .domain-card .progress .fill { height: 100%; transition: width .5s ease; }
.dash .domain-card.band-ok   .progress .fill { background: var(--ok); }
.dash .domain-card.band-warn .progress .fill { background: var(--warn); }
.dash .domain-card.band-crit .progress .fill { background: var(--crit); }

.dash .domain-card .kpi-list { display: flex; flex-direction: column; gap: 0;
                                margin-top: 8px; padding-top: 8px;
                                border-top: 1px dashed var(--line); }
.dash .domain-card .kpi-row {
  display: grid; grid-template-columns: 1fr auto auto;
  align-items: baseline; gap: 6px; padding: 4px 0;
  font-size: 12px;
}
.dash .domain-card .kpi-row .kn { color: var(--ink-2);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.dash .domain-card .kpi-row .kv {
  font-family: var(--font-mono); font-size: 10.5px;
  font-variant-numeric: tabular-nums;
  color: var(--ink); letter-spacing: .02em; white-space: nowrap;
}
.dash .domain-card .kpi-row .ks {
  font-family: var(--font-mono); font-size: 9.5px;
  font-weight: 500;
  padding: 1px 6px; border-radius: 3px;
  background: var(--paper-2); color: var(--ink-mute);
  min-width: 26px; text-align: right;
  display: inline-flex; align-items: center; gap: 4px;
}
.dash .domain-card .kpi-row .ks::before {
  content: ""; display: inline-block;
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--ink-mute);
}
.dash .domain-card .kpi-row .ks.band-ok::before   { background: var(--ok); }
.dash .domain-card .kpi-row .ks.band-warn::before { background: var(--warn); }
.dash .domain-card .kpi-row .ks.band-crit::before { background: var(--crit); }
.dash .domain-card .kpi-row .ks.band-ok   { background: color-mix(in oklab, var(--ok)   14%, transparent); color: var(--ok); }
.dash .domain-card .kpi-row .ks.band-warn { background: color-mix(in oklab, var(--warn) 14%, transparent); color: var(--warn); }
.dash .domain-card .kpi-row .ks.band-crit { background: color-mix(in oklab, var(--crit) 14%, transparent); color: var(--crit); }

/* ---- Bottom split (Insights + Leaderboard) — scorecard layout only ---- */
.dash .scorecard-bottom {
  display: grid; grid-template-columns: 1.4fr 1fr; gap: 14px;
  margin-bottom: 22px;
}
.dash .scorecard-bottom > * { margin-bottom: 0; }    /* override the standalone takeaways/leaderboard margins */
@media (max-width: 1080px) {
  .dash .scorecard-bottom { grid-template-columns: 1fr; }
}

/* ---- Leaderboard ---- */
.dash .leaderboard {
  background: var(--paper); border: 1px solid var(--line);
  border-radius: 14px; padding: 18px 22px;
  box-shadow: var(--shadow-sm); margin-bottom: 22px;
}
.dash .leaderboard .head {
  display: flex; align-items: baseline; justify-content: space-between;
  border-bottom: 1px dashed var(--line); padding-bottom: 10px; margin-bottom: 8px;
  gap: 14px;
}
.dash .leaderboard .head h3 { font-family: var(--font-display); font-style: italic; font-weight: 500; font-size: 16px; }
.dash .leaderboard .head h3 em { font-style: italic; color: var(--accent); }
.dash .lb-row {
  display: grid; grid-template-columns: 28px 1.6fr 80px 1fr auto;
  gap: 12px; align-items: center;
  padding: 8px 0;
  border-top: 1px dashed color-mix(in oklab, var(--line) 70%, transparent);
}
.dash .lb-row:first-of-type { border-top: 0; }
.dash .lb-row .rank {
  font-family: var(--font-display); font-weight: 600; font-size: 17px;
  color: var(--ink-mute); text-align: center;
}
.dash .lb-row .nm   { font-family: var(--font-display); font-size: 14.5px; color: var(--ink); }
.dash .lb-row .num  { font-family: var(--font-mono); font-size: 13px; font-variant-numeric: tabular-nums; color: var(--ink); }
.dash .lb-row .bar  { background: var(--paper-2); border-radius: 2px; height: 5px; overflow: hidden; }
.dash .lb-row .bar .fill { height: 100%; transition: width .5s ease; }
/* Colour the SCORE TEXT and the BAR FILL separately. The previous combined
   rule applied a background to .num too, painting a same-colour block over the
   number so it read as invisible. Keep the background on the fill only. */
.dash .lb-row.band-ok   .num { color: var(--ok); }
.dash .lb-row.band-warn .num { color: var(--warn); }
.dash .lb-row.band-crit .num { color: var(--crit); }
.dash .lb-row.band-ok   .bar .fill { background: var(--ok); }
.dash .lb-row.band-warn .bar .fill { background: var(--warn); }
.dash .lb-row.band-crit .bar .fill { background: var(--crit); }
.dash .lb-row .delta {
  font-family: var(--font-mono); font-size: 11px;
  color: var(--ink-mute); white-space: nowrap;
}
.dash .lb-row .delta.up   { color: var(--ok); }
.dash .lb-row .delta.down { color: var(--crit); }

.dash .tabs { display: flex; gap: 2px; flex-wrap: wrap; margin-bottom: 18px;
              border-bottom: 1px solid var(--line); }
.dash .tabs button {
  appearance: none; background: transparent; border: 0;
  padding: 10px 16px; font: inherit; font-size: 13px;
  color: var(--ink-soft); border-bottom: 2px solid transparent;
  cursor: pointer; margin-bottom: -1px;
  font-family: var(--font-display); font-weight: 500;
}
.dash .tabs button:hover { color: var(--ink); }
.dash .tabs button[aria-pressed="true"] { color: var(--accent); border-bottom-color: var(--accent); }

.dash .empty {
  background: var(--paper); border: 1px dashed var(--line-strong);
  border-radius: 14px; padding: 40px;
  text-align: center; color: var(--ink-mute);
  font-family: var(--font-display); font-style: italic; font-size: 16px;
}

.dash details.dev {
  margin-top: 28px;
  background: var(--paper-2); border: 1px solid var(--line);
  border-radius: 10px; padding: 14px 18px;
}
.dash details.dev summary {
  cursor: pointer;
  font-family: var(--font-mono); font-size: 10px;
  letter-spacing: .14em; text-transform: uppercase; color: var(--ink-mute);
  list-style: none; outline: none;
}
.dash details.dev summary::-webkit-details-marker { display: none; }
.dash details.dev summary::before { content: "▸ "; color: var(--accent); }
.dash details.dev[open] summary::before { content: "▾ "; }
.dash details.dev pre {
  margin: 12px 0 0;
  background: color-mix(in oklab, var(--ink) 95%, transparent);
  color: var(--paper);
  padding: 14px 16px; border-radius: 8px;
  font-family: var(--font-mono); font-size: 10.5px;
  overflow-x: auto; line-height: 1.55;
}
[data-theme="midnight"] .dash details.dev pre { background: var(--bg); }

.dash .footer-line {
  margin-top: 28px; padding-top: 18px; border-top: 1px solid var(--line);
  display: flex; align-items: baseline; justify-content: space-between; gap: 24px;
  font-size: 12px; color: var(--ink-mute);
}
.dash .footer-line .credit { font-family: var(--font-display); font-style: italic; }
.dash .footer-line .credit em { color: var(--accent); }

/* ---- KPI drilldown modal --------------------------------------------- */
.dash .kpi { cursor: pointer; transition: border-color .15s, box-shadow .15s, transform .1s; }
.dash .kpi:hover { border-color: var(--accent); box-shadow: var(--shadow-sm); transform: translateY(-1px); }
.dash .domain-card .kpi-row { cursor: pointer; border-radius: 6px; padding-left: 4px; padding-right: 4px;
  margin-left: -4px; margin-right: -4px; transition: background .12s; }
.dash .domain-card .kpi-row:hover { background: var(--paper-2); }

.kdd-back {
  position: fixed; inset: 0; z-index: 240;
  background: color-mix(in oklab, var(--ink) 52%, transparent);
  -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px);
  display: grid; place-items: start center;
  padding: 40px 24px; overflow-y: auto;
  animation: backdrop .2s ease;
}
.kdd {
  background: var(--bg); color: var(--ink);
  border: 1px solid var(--line-strong); border-radius: 16px;
  width: 100%; max-width: 920px;
  box-shadow: var(--shadow-lg);
  animation: pop .25s cubic-bezier(.2,.8,.2,1);
  overflow: hidden;
}
.kdd-head {
  display: flex; align-items: flex-start; gap: 14px;
  padding: 22px 26px 18px; border-bottom: 1px solid var(--line);
  background: var(--paper);
}
.kdd-head .flag {
  width: 40px; height: 40px; border-radius: 10px; flex-shrink: 0;
  display: grid; place-items: center;
  background: color-mix(in oklab, var(--gold) 16%, transparent); color: var(--gold);
  border: 1px solid color-mix(in oklab, var(--gold) 36%, var(--line));
}
.kdd-head .htxt { flex: 1; min-width: 0; }
.kdd-head .eyebrow {
  font-family: var(--font-mono); font-size: 9.5px; letter-spacing: .16em;
  text-transform: uppercase; color: var(--ink-mute); margin-bottom: 4px;
}
.kdd-head h2 { font-family: var(--font-display); font-weight: 500; font-size: 26px; line-height: 1.08; }
.kdd-head .sub { font-family: var(--font-display); font-style: italic; font-size: 13px; color: var(--ink-mute); margin-top: 4px; }
.kdd-head .close {
  appearance: none; background: var(--paper); border: 1px solid var(--line-strong); color: var(--ink-soft);
  width: 34px; height: 34px; border-radius: 50%; flex-shrink: 0;
  display: grid; place-items: center; cursor: pointer; font-size: 16px;
  transition: color .15s, border-color .15s;
}
.kdd-head .close:hover { color: var(--ink); border-color: var(--accent); }
.kdd-body { padding: 22px 26px 26px; }

.kdd-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 22px; }
.kdd-card {
  background: var(--paper); border: 1px solid var(--line); border-radius: 12px;
  padding: 14px 16px; display: flex; flex-direction: column; gap: 4px;
}
.kdd-card .k { font-family: var(--font-mono); font-size: 9px; letter-spacing: .15em;
  text-transform: uppercase; color: var(--ink-mute); }
.kdd-card .v { font-family: var(--font-display); font-weight: 500; font-size: 30px; line-height: 1;
  color: var(--ink); font-variant-numeric: tabular-nums; }
.kdd-card .v.crit { color: var(--crit); } .kdd-card .v.ok { color: var(--ok); } .kdd-card .v.warn { color: var(--warn); }
.kdd-card .s { font-size: 11px; color: var(--ink-mute); }

.kdd-section { margin-top: 22px; }
.kdd-section h4 {
  font-family: var(--font-display); font-style: italic; font-weight: 500;
  font-size: 16px; color: var(--ink); margin-bottom: 10px;
}
.kdd-rows-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
.kdd-rows-head h4 { margin-bottom: 0; }
.kdd-dl {
  appearance: none; cursor: pointer; font: inherit; font-size: 12px;
  display: inline-flex; align-items: center; gap: 6px;
  background: var(--ink); color: var(--paper); border: 0;
  padding: 7px 14px; border-radius: 999px; flex-shrink: 0;
  transition: transform .1s, box-shadow .15s;
}
[data-theme="midnight"] .kdd-dl { background: var(--accent); color: var(--bg); }
.kdd-dl:hover:not(:disabled) { transform: translateY(-1px); box-shadow: var(--shadow-sm); }
.kdd-dl:disabled { opacity: .6; cursor: default; }
.kdd-section .stamp { font-family: var(--font-mono); font-size: 9px; letter-spacing: .14em;
  text-transform: uppercase; color: var(--ink-mute); }

.kdd-scorebar { background: var(--paper); border: 1px solid var(--line); border-radius: 12px; padding: 16px 18px 12px; }
.kdd-scorebar .t { font-family: var(--font-display); font-style: italic; font-size: 13.5px; color: var(--ink-soft); margin-bottom: 30px; }
.kdd-gradient {
  position: relative; height: 12px; border-radius: 6px;
  background: linear-gradient(90deg, var(--crit) 0%, var(--crit) 24%, var(--warn) 42%, var(--warn) 62%, var(--ok) 80%, var(--ok) 100%);
}
.kdd-needle { position: absolute; top: -6px; bottom: -6px; width: 2px; background: var(--ink); transform: translateX(-1px); }
.kdd-needle .lbl {
  position: absolute; bottom: calc(100% + 6px); left: 50%; transform: translateX(-50%);
  white-space: nowrap; font-family: var(--font-mono); font-size: 10px; color: var(--ink);
  letter-spacing: .04em;
}
.kdd-sb-foot { display: flex; justify-content: space-between; margin-top: 10px;
  font-family: var(--font-mono); font-size: 9px; letter-spacing: .12em; text-transform: uppercase; color: var(--ink-mute); }
.kdd-sb-foot .mid { text-align: center; } .kdd-sb-foot .right { text-align: right; }
.kdd-sb-foot b { display: block; font-size: 11px; color: var(--ink-2); letter-spacing: .02em; margin-top: 2px; }

.kdd-chart { height: 150px; background: var(--paper); border: 1px solid var(--line); border-radius: 12px; padding: 12px 14px; }

.kdd-ptable, .kdd-rowtable { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.kdd-ptable th, .kdd-rowtable th {
  font-family: var(--font-mono); font-size: 9px; letter-spacing: .12em; text-transform: uppercase;
  color: var(--ink-mute); font-weight: 600; text-align: left; padding: 8px 10px;
  border-bottom: 1px solid var(--line);
}
.kdd-ptable td, .kdd-rowtable td { padding: 8px 10px; border-bottom: 1px dashed color-mix(in oklab, var(--line) 70%, transparent); color: var(--ink-2); }
.kdd-ptable tr:last-child td, .kdd-rowtable tr:last-child td { border-bottom: 0; }
.kdd-ptable .nm { color: var(--ink); font-weight: 500; font-family: var(--font-display); font-size: 13.5px; }
.kdd-ptable .muted { color: var(--ink-mute); }
.kdd-ptable .pscore { display: inline-flex; align-items: center; gap: 8px; justify-content: flex-end; }
.kdd-ptable .pbar { width: 64px; height: 5px; border-radius: 3px; background: var(--paper-2); overflow: hidden; }
.kdd-ptable .pbar .pfill { display: block; height: 100%; }
.kdd-ptable .pbar .pfill.band-ok { background: var(--ok); } .kdd-ptable .pbar .pfill.band-warn { background: var(--warn); } .kdd-ptable .pbar .pfill.band-crit { background: var(--crit); }
.kdd-ptable .pscore b { font-family: var(--font-mono); font-size: 12px; min-width: 20px; text-align: right; }
.kdd-ptable .pscore.band-ok b { color: var(--ok); } .kdd-ptable .pscore.band-warn b { color: var(--warn); } .kdd-ptable .pscore.band-crit b { color: var(--crit); }

.kdd-rows-wrap { max-height: 320px; overflow-y: auto; border: 1px solid var(--line); border-radius: 12px; background: var(--paper); }
.kdd-rowtable th { position: sticky; top: 0; background: var(--paper); z-index: 1; }
.kdd-rowtable td { font-family: var(--font-mono); font-size: 11.5px; white-space: nowrap; }
.kdd-rows-note { font-family: var(--font-mono); font-size: 9.5px; letter-spacing: .1em; text-transform: uppercase;
  color: var(--ink-mute); margin-bottom: 8px; }

.kdd-actions { display: flex; flex-direction: column; gap: 10px; }
.kdd-act { display: flex; gap: 12px; align-items: baseline;
  background: var(--paper); border: 1px solid var(--line); border-radius: 12px; padding: 12px 16px; }
.kdd-act .n { font-family: var(--font-display); font-style: italic; font-size: 20px; color: var(--gold); min-width: 18px; }
.kdd-act .atxt .at { font-weight: 600; font-size: 13.5px; color: var(--ink); margin-bottom: 2px; }
.kdd-act .atxt .ad { font-size: 12.5px; color: var(--ink-2); line-height: 1.5; }

.kdd-note { font-family: var(--font-display); font-style: italic; font-size: 12.5px; color: var(--ink-mute); }

@media (max-width: 720px) {
  .kdd-cards { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 760px) {
  .dash .grid { grid-template-columns: 1fr; }
  .dash .grid .chart-card.span2 { grid-column: auto; }
}
`;

  function injectCssOnce() {
    if (document.getElementById("dash-styles")) return;
    const tag = document.createElement("style");
    tag.id = "dash-styles";
    tag.textContent = DASH_CSS;
    document.head.appendChild(tag);
  }

  // ============== Theme tokens (synchronous, no DOM queries) =============
  // Mirrors the CSS theme blocks in Insight Concierge.html. SVG components
  // (Gauge, Radar, Leaderboard) and the Chart.js builders need theme colors
  // at React's RENDER phase — before the DOM has the new data-theme committed —
  // so reading getComputedStyle would race. Keep this in sync with the
  // [data-theme="..."] rules in Insight Concierge.html.
  const THEME_COLORS = {
    cream: {
      ink: "#1f1a12", ink_mute: "#8a7e64", line: "#e0d6bf",
      accent: "#8a5a2b", gold: "#b4894a",
      ok: "#5a6f3f", warn: "#a8642a", crit: "#8b3a2b",
      paper: "#faf6ec"
    },
    midnight: {
      ink: "#f3ead6", ink_mute: "#7d7460", line: "#243549",
      accent: "#d4a657", gold: "#d4a657",
      ok: "#94b87a", warn: "#d99a55", crit: "#d97058",
      paper: "#182434"
    },
    terracotta: {
      ink: "#2a1a14", ink_mute: "#97725f", line: "#e0cdb8",
      accent: "#9a3b25", gold: "#b87648",
      ok: "#5e7244", warn: "#b06a30", crit: "#762a18",
      paper: "#f8efe5"
    },
    print: {
      ink: "#111111", ink_mute: "#888888", line: "#dcdcd4",
      accent: "#222222", gold: "#444444",
      ok: "#3b3b3b", warn: "#5a5a5a", crit: "#1a1a1a",
      paper: "#ffffff"
    }
  };
  function readTheme(themeKey) {
    return THEME_COLORS[themeKey] || THEME_COLORS.cream;
  }

  function applyChartDefaults(themeKey) {
    if (typeof window.Chart === "undefined") return;
    const c = readTheme(themeKey);
    Chart.defaults.color = c.ink_mute;
    Chart.defaults.borderColor = c.line;
    Chart.defaults.font.family = '"Geist", ui-sans-serif, system-ui, sans-serif';
    Chart.defaults.font.size = 11;
    Chart.defaults.plugins.legend.labels.usePointStyle = true;
    Chart.defaults.plugins.legend.labels.boxHeight = 6;
    Chart.defaults.plugins.legend.labels.padding = 12;
  }

  function chartOpts(opts, themeKey) {
    const c = readTheme(themeKey);
    const valueTick = (v) => opts.isPct ? Number(v).toFixed(0) + "%" : Number(v).toLocaleString();
    const horizontal = !!opts.horizontal;
    const valueAxis = {
      grid: { color: c.line, drawBorder: false },
      ticks: { color: c.ink_mute, callback: valueTick }
    };
    const categoryAxis = {
      grid: { display: false, drawBorder: false },
      ticks: { color: c.ink_mute, autoSkip: false, font: { size: 10.5 } }
    };
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 280 },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: c.ink, titleColor: c.paper, bodyColor: c.paper,
          callbacks: {
            label: (ctx) => {
              const v = ctx.parsed.y != null ? ctx.parsed.y : ctx.parsed.x;
              return opts.isPct ? v.toFixed(1) + "%" : (typeof v === "number" ? v.toLocaleString() : v);
            }
          }
        }
      },
      scales: horizontal
        ? { x: valueAxis, y: categoryAxis }
        : {
            x: {
              grid: { color: c.line, drawBorder: false },
              ticks: { color: c.ink_mute, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 }
            },
            y: valueAxis
          }
    };
  }

  // ============== Chart builders =========================================
  function buildTrendLine(canvas, metricId, rows, themeKey) {
    const c = readTheme(themeKey);
    const info = AGG.METRIC_INFO[metricId];
    const series = AGG.metricSeries(metricId, rows);
    const labels = rows.map(r => r.date);
    return new Chart(canvas, {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: info.name, data: series,
          borderColor: c.accent,
          backgroundColor: c.accent + "22",
          tension: 0.35, fill: true,
          pointRadius: 0, pointHoverRadius: 4,
          borderWidth: 1.6
        }]
      },
      options: chartOpts({ unit: info.unit, isPct: info.fmt === AGG.fmtPct }, themeKey)
    });
  }

  function buildBarBy(canvas, metricId, rows, shapeKey, label, kpis, shapes, themeKey) {
    const c = readTheme(themeKey);
    const info = AGG.METRIC_INFO[metricId];
    const isRate = info.fmt !== AGG.fmtInt;
    const total = kpis[metricId];
    const shape = shapes[shapeKey] || [];
    const labels = shape.map(s => s.name);
    let values;
    if (isRate) {
      values = shape.map((s, i) => {
        const wobble = 0.85 + ((i * 7) % 30) / 100;
        return Math.max(0, Number((total * wobble).toFixed(1)));
      });
    } else {
      values = shape.map(s => Math.round(total * s.share));
    }
    return new Chart(canvas, {
      type: "bar",
      data: {
        labels,
        datasets: [{
          label: info.name + " · " + label,
          data: values,
          backgroundColor: c.accent + "cc",
          borderColor: c.accent,
          borderWidth: 1, borderRadius: 4,
          maxBarThickness: 22
        }]
      },
      options: Object.assign({}, chartOpts({ unit: info.unit, isPct: isRate, horizontal: true }, themeKey), {
        indexAxis: "y"
      })
    });
  }

  function buildDonut(canvas, metricId, rows, shapeKey, kpis, shapes, themeKey) {
    const c = readTheme(themeKey);
    const total = (typeof kpis[metricId] === "number" && !isNaN(kpis[metricId])) ? kpis[metricId] : (kpis.opened || 1);
    const shape = shapes[shapeKey] || [];
    const labels = shape.map(s => s.name);
    const values = shape.map(s => Math.round(total * s.share));
    const palette = [c.accent, c.gold, c.warn, c.ok, c.crit, c.ink_mute, c.line];
    return new Chart(canvas, {
      type: "doughnut",
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: labels.map((_, i) => palette[i % palette.length]),
          borderColor: c.paper, borderWidth: 2
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: "62%",
        plugins: {
          legend: { position: "right", labels: { color: c.ink_mute, padding: 10, boxHeight: 6, usePointStyle: true } },
          tooltip: { backgroundColor: c.ink, titleColor: c.paper, bodyColor: c.paper }
        }
      }
    });
  }

  // ============== Map manifest viz → builder =============================
  function builderFor(metricId, viz) {
    const v = AGG.normViz(viz);
    if (!AGG.METRIC_INFO[metricId]) return null;
    if (v.includes("trend"))            return { kind: "polished", build: (cv, rows, k, shapes, tk) => buildTrendLine(cv, metricId, rows, tk), label: "Trend line" };
    if (v.includes("bar_by_team"))      return { kind: "polished", build: (cv, rows, k, shapes, tk) => buildBarBy(cv, metricId, rows, "by_team", "by team", k, shapes, tk), label: "Bar · by team" };
    if (v.includes("bar_by_service"))   return { kind: "polished", build: (cv, rows, k, shapes, tk) => buildBarBy(cv, metricId, rows, "by_service", "by service", k, shapes, tk), label: "Bar · by service" };
    if (v.includes("priority_donut"))   return { kind: "polished", build: (cv, rows, k, shapes, tk) => buildDonut(cv, metricId, rows, "by_priority", k, shapes, tk), label: "Priority distribution" };
    if (v.includes("status_donut"))     return { kind: "polished", build: (cv, rows, k, shapes, tk) => buildDonut(cv, metricId, rows, "by_status",  k, shapes, tk), label: "Status distribution" };
    if (v.includes("heatmap"))          return { kind: "stub", fallback: (cv, rows, k, shapes, tk) => buildTrendLine(cv, metricId, rows, tk),
                                                  label: "Heatmap",
                                                  note: "Hour-of-day heatmap is refreshing this week — showing the trend line in the meantime." };
    if (v.includes("globe"))            return { kind: "stub", fallback: (cv, rows, k, shapes, tk) => buildBarBy(cv, metricId, rows, "by_region", "by region", k, shapes, tk),
                                                  label: "Globe view",
                                                  note: "Geographic globe is on the road map — showing the regional breakdown for now." };
    if (v.includes("waterfall"))        return { kind: "stub", fallback: (cv, rows, k, shapes, tk) => buildBarBy(cv, metricId, rows, "by_service", "by service", k, shapes, tk),
                                                  label: "Aging waterfall",
                                                  note: "Aging waterfall is in validation — falling back to a service breakdown." };
    return { kind: "polished", build: (cv, rows, k, shapes, tk) => buildTrendLine(cv, metricId, rows, tk), label: "Trend line" };
  }

  // ============== Sparkline ==============================================
  function Sparkline({ values }) {
    if (!values || values.length === 0) return null;
    const w = 120, h = 28, pad = 2;
    const min = Math.min.apply(null, values);
    const max = Math.max.apply(null, values);
    const range = (max - min) || 1;
    const step = (w - pad * 2) / Math.max(1, values.length - 1);
    let d = "", area = `M${pad},${h - pad}`;
    values.forEach((v, i) => {
      const x = pad + i * step;
      const y = h - pad - ((v - min) / range) * (h - pad * 2);
      d += `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)} `;
      area += ` L${x.toFixed(1)},${y.toFixed(1)}`;
    });
    area += ` L${w - pad},${h - pad} Z`;
    return (
      <div className="spark">
        <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
          <path className="area" d={area} />
          <path d={d} />
        </svg>
      </div>
    );
  }

  // ============== Chart card =============================================
  function ChartCard({ metric, viz, rows, kpis, shapes, themeKey }) {
    const ref = useRef(null);
    const chartRef = useRef(null);

    useEffect(() => {
      if (!ref.current || typeof window.Chart === "undefined") return;
      applyChartDefaults(themeKey);
      if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
      const b = builderFor(metric.id, viz);
      if (!b) return;
      const fn = b.kind === "stub" ? b.fallback : b.build;
      try {
        chartRef.current = fn(ref.current, rows, kpis, shapes, themeKey);
      } catch (err) {
        console.error("Chart build failed for " + metric.id, err);
      }
      return () => {
        if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
      };
    }, [metric.id, viz, rows, themeKey]);

    const b = builderFor(metric.id, viz);
    const info = AGG.METRIC_INFO[metric.id];

    return (
      <article className="chart-card">
        <div className="chd">
          <h3>{info.name}</h3>
          <span className="vt">{b ? b.label : "—"}</span>
        </div>
        {b && b.kind === "stub" && (
          <div className="stub">
            <span className="badge">{b.label}</span>
            <span className="msg">{b.note}</span>
          </div>
        )}
        <div className="body"><canvas ref={ref} /></div>
      </article>
    );
  }

  // ============== Window selector ========================================
  function WindowSelector({ days, custom, dailyRange, onPreset, onCustom }) {
    const presets = [7, 30, 60, 90];
    return (
      <div className="window-row">
        <span className="label">Window</span>
        {presets.map(d => (
          <button key={d} className="chip" aria-pressed={!custom && days === d}
            onClick={() => onPreset(d)}>{d} days</button>
        ))}
        <button className="chip" aria-pressed={!!custom}
          onClick={() => onCustom(true)}>Custom</button>
        {custom && (
          <div className="custom-range">
            <input type="date" value={custom.startISO}
              min={dailyRange.minISO} max={dailyRange.maxISO}
              onChange={e => onCustom({ ...custom, startISO: e.target.value })} />
            <span className="mono">to</span>
            <input type="date" value={custom.endISO}
              min={dailyRange.minISO} max={dailyRange.maxISO}
              onChange={e => onCustom({ ...custom, endISO: e.target.value })} />
          </div>
        )}
      </div>
    );
  }

  // ============== Filter dropdowns bar ===================================
  function FilterBar({ filters, shapes, onChange, onClearAll }) {
    const opt = (arr) => ["all", ...arr.map(x => x.name)];
    const services  = opt(shapes.by_service);
    const teams     = opt(shapes.by_team);
    const regions   = opt(shapes.by_region);
    const priorities = ["all", "P1", "P2", "P3", "P4"];
    const activeCount = ["service_group","team","region","priority"]
      .filter(k => filters[k] && filters[k] !== "all").length;
    const Drop = (key, label, options) => (
      <div className="dropdown" key={key}>
        <select value={filters[key] || "all"} onChange={(e) => onChange(key, e.target.value)} aria-label={label}>
          {options.map(v => <option key={v} value={v}>{v === "all" ? `All ${label.toLowerCase()}` : v}</option>)}
        </select>
      </div>
    );
    return (
      <div className="filter-bar">
        <span className="label">Filter</span>
        {Drop("service_group", "Services",   services)}
        {Drop("team",          "Teams",      teams)}
        {Drop("region",        "Regions",    regions)}
        {Drop("priority",      "Priorities", priorities)}
        <button className="clear-all" disabled={activeCount === 0} onClick={onClearAll}>
          Clear all filters
        </button>
      </div>
    );
  }

  // ============== Filter row (active-filter pills) =======================
  function FilterRow({ filters, onClear }) {
    const active = [];
    if (filters.priority      && filters.priority      !== "all") active.push(["Priority", filters.priority,      "priority"]);
    if (filters.service_group && filters.service_group !== "all") active.push(["Service",  filters.service_group, "service_group"]);
    if (filters.team          && filters.team          !== "all") active.push(["Team",     filters.team,          "team"]);
    if (filters.region        && filters.region        !== "all") active.push(["Region",   filters.region,        "region"]);
    if (active.length === 0) return null;
    return (
      <div className="filter-row">
        {active.map(([k, v, key]) => (
          <span key={key} className="filter-chip">
            <span>{k}: {v}</span>
            <button aria-label={"Clear " + k} onClick={() => onClear(key)}>×</button>
          </span>
        ))}
      </div>
    );
  }

  // ============== Key Takeaways ==========================================
  function KeyTakeaways({ insights, headline }) {
    const headlineEl = headline
      ? <h3>{headline}</h3>
      : <h3>Key <em>takeaways</em></h3>;
    return (
      <section className="takeaways">
        <div className="head">
          {headlineEl}
          <span className="stamp">Auto-generated from current scope</span>
        </div>
        {(!insights || insights.length === 0) ? (
          <div className="empty">Nothing standing out — metrics are tracking close to the historical band.</div>
        ) : (
          insights.map((it, i) => {
            const glyph = it.kind === "critical"    ? "!"
                        : it.kind === "outlier"     ? "⚐"
                        : it.kind === "strength"    ? "✓"
                        : it.kind === "opportunity" ? "★" : "·";
            return (
              <div key={i} className={"item " + it.kind}>
                <div className="marker">{glyph}</div>
                <div className="body">
                  <div className="lbl">{it.label}</div>
                  <div className="prose" dangerouslySetInnerHTML={{ __html: it.html }} />
                </div>
              </div>
            );
          })
        )}
      </section>
    );
  }

  // ============== Scorecard pieces =======================================
  // SVG gauge — half circle, 0–100, three colored arc bands, animated needle.
  function Gauge({ score, themeKey }) {
    const W = 220, H = 140, cx = W/2, cy = H - 8, R = 90;
    const polar = (deg, r) => {
      const rad = (deg - 180) * Math.PI / 180;     // 0deg = left, 180deg = right
      return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
    };
    const arcPath = (startScore, endScore, r) => {
      const sa = (startScore / 100) * 180;
      const ea = (endScore   / 100) * 180;
      const [sx, sy] = polar(sa, r);
      const [ex, ey] = polar(ea, r);
      return `M ${sx} ${sy} A ${r} ${r} 0 0 1 ${ex} ${ey}`;
    };
    const c = readTheme(themeKey);
    const safeScore = score == null ? 0 : Math.max(0, Math.min(100, score));
    const needleAngle = (safeScore / 100) * 180 - 180;  // -180..0
    const needleX = cx + (R - 8) * Math.cos(needleAngle * Math.PI / 180);
    const needleY = cy + (R - 8) * Math.sin(needleAngle * Math.PI / 180);
    const band = AGG.scoreBand(score);
    return (
      <div className="gauge" key={themeKey}>
        <svg viewBox={`0 0 ${W} ${H}`}>
          <path d={arcPath(0, 40, R)}     stroke={c.crit} strokeWidth="14" fill="none" strokeLinecap="round" opacity=".85" />
          <path d={arcPath(40, 70, R)}    stroke={c.warn} strokeWidth="14" fill="none" strokeLinecap="butt"  opacity=".85" />
          <path d={arcPath(70, 100, R)}   stroke={c.ok}   strokeWidth="14" fill="none" strokeLinecap="round" opacity=".85" />
          <line x1={cx} y1={cy} x2={needleX} y2={needleY}
                stroke={c.ink} strokeWidth="2.4" strokeLinecap="round"
                style={{ transition: "all .8s cubic-bezier(.4,0,.2,1)" }} />
          <circle cx={cx} cy={cy} r="6" fill={c.ink} />
        </svg>
        <div className="score-num">{score == null ? "—" : score}</div>
        <div className={"score-band " + band.cls}>{band.label}</div>
        <div className="lbl">Overall score</div>
      </div>
    );
  }

  // SVG radar — N-axis polygon comparing domain scores.
  // SVG radar — N-axis polygon. Sized to fit the labels comfortably; labels
  // anchored by quadrant (left labels right-aligned, right labels left-aligned,
  // top/bottom labels centered) so they don't overlap the polygon at any N.
  function Radar({ domainScores, themeKey }) {
    const c = readTheme(themeKey);
    const labels = Object.keys(domainScores);
    const N = labels.length;
    // Generous viewBox so labels sit OUTSIDE the polygon vertices without
    // clipping on any side. The polygon radius R leaves a wide margin for the
    // two-line labels placed at LABEL_R (well beyond the outer ring).
    const W = 460, H = 340, cx = W/2, cy = H/2 + 4, R = 86;
    const LABEL_R = 124;   // as a 0–100+ scale value → (124/100)*R ≈ 1.44·R, clear of the ring
    const angleFor = (i) => -Math.PI / 2 + (i / N) * 2 * Math.PI;
    const point = (i, v) => {
      const r = (v / 100) * R;
      return [cx + r * Math.cos(angleFor(i)), cy + r * Math.sin(angleFor(i))];
    };
    const ringPoints = (frac) => labels.map((_, i) => {
      const r = R * frac;
      return `${(cx + r * Math.cos(angleFor(i))).toFixed(1)},${(cy + r * Math.sin(angleFor(i))).toFixed(1)}`;
    }).join(" ");
    const polyPts = labels.map((name, i) =>
      point(i, domainScores[name].score || 0).map(n => n.toFixed(1)).join(",")
    ).join(" ");

    // Pick text anchor + vertical baseline based on label position relative to centre.
    function labelStyle(angle) {
      const dx = Math.cos(angle), dy = Math.sin(angle);
      const anchor = dx > 0.20 ? "start" : (dx < -0.20 ? "end" : "middle");
      const baseline = dy > 0.20 ? "hanging" : (dy < -0.20 ? "alphabetic" : "middle");
      return { anchor, baseline };
    }

    return (
      <div className="radar" key={themeKey}>
        <svg viewBox={`0 0 ${W} ${H}`}>
          {/* Concentric rings */}
          {[0.25, 0.50, 0.75, 1.0].map((f, i) => (
            <polygon key={i} points={ringPoints(f)} fill="none" stroke={c.line} strokeWidth="1" opacity={i === 3 ? 1 : 0.55} />
          ))}
          {/* Spokes */}
          {labels.map((_, i) => {
            const [px, py] = point(i, 100);
            return <line key={i} x1={cx} y1={cy} x2={px} y2={py} stroke={c.line} strokeWidth="1" opacity="0.55" />;
          })}
          {/* Score polygon */}
          <polygon points={polyPts} fill={c.accent + "33"} stroke={c.accent} strokeWidth="1.8" />
          {/* Score points */}
          {labels.map((name, i) => {
            const [px, py] = point(i, domainScores[name].score || 0);
            const ds = domainScores[name];
            const dot = ds.score == null ? c.ink_mute
                      : ds.score >= 70 ? c.ok
                      : ds.score >= 40 ? c.warn : c.crit;
            return <circle key={"d" + i} cx={px} cy={py} r="3.5" fill={dot} stroke={c.paper} strokeWidth="1.5" />;
          })}
          {/* Labels — name on top line, score on second line, anchored by quadrant */}
          {labels.map((name, i) => {
            const ang = angleFor(i);
            const [lx, ly] = point(i, LABEL_R);
            const { anchor } = labelStyle(ang);
            const score = domainScores[name].score;
            const dot = score == null ? c.ink_mute
                      : score >= 70 ? c.ok
                      : score >= 40 ? c.warn : c.crit;
            const nameY = ly - 7;
            const scoreY = ly + 13;
            return (
              <g key={"l" + i}>
                <text x={lx} y={nameY} textAnchor={anchor} dominantBaseline="middle"
                      fill={c.ink_mute} style={{ font: '600 10.5px "JetBrains Mono", ui-monospace, monospace', letterSpacing: '.14em' }}>
                  {name.toUpperCase()}
                </text>
                <text x={lx} y={scoreY} textAnchor={anchor} dominantBaseline="middle"
                      fill={dot} style={{ font: '600 18px "Newsreader", Georgia, serif' }}>
                  {score == null ? "—" : score}
                </text>
              </g>
            );
          })}
        </svg>
        <div className="lbl">Domain performance</div>
      </div>
    );
  }

  // Service leaderboard — top services by simulated score.
  function Leaderboard({ overall, services, themeKey }) {
    // Per-service score: jitter the overall by a deterministic, share-weighted offset.
    const computed = services.map((svc, i) => {
      const offset = ((i * 13) % 50) - 25;            // -25 .. +24 deterministic
      const score = Math.max(0, Math.min(100, (overall == null ? 65 : overall) + offset));
      const trend = ((i * 7) % 9) - 4;                // -4 .. +4 deterministic delta
      return { name: svc.name, share: svc.share, score, trend };
    }).sort((a, b) => b.score - a.score).slice(0, 6);

    return (
      <section className="leaderboard" key={themeKey}>
        <div className="head">
          <h3>Service <em>leaderboard</em></h3>
          <span className="stamp" style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--ink-mute)" }}>by composite score</span>
        </div>
        {computed.map((s, i) => {
          const band = AGG.scoreBand(s.score);
          const arrow = s.trend > 0 ? "▲" : s.trend < 0 ? "▼" : "—";
          const dCls = s.trend > 0 ? "up" : s.trend < 0 ? "down" : "";
          return (
            <div key={s.name} className={"lb-row " + band.cls}>
              <span className="rank">{i + 1}</span>
              <span className="nm">{s.name}</span>
              <span className="num">{s.score}</span>
              <div className="bar"><div className="fill" style={{ width: s.score + "%" }} /></div>
              <span className={"delta " + dCls}>{arrow} {s.trend > 0 ? "+" : ""}{s.trend}</span>
            </div>
          );
        })}
      </section>
    );
  }

  // The Scorecard view — Incident / Problem / Change / Outage / Knowledge.
  // Consumes AGG.buildScorecardData; insights and leaderboard sit side-by-side
  // at the bottom, matching the Product Health Scorecard reference design.
  function ScorecardView({ realKpis, days, filterScalar, refreshSalt, dataset, themeKey, insights, selectedMetricIds, onOpenKpi }) {
    const data = useMemo(
      () => AGG.buildScorecardData(realKpis, days, filterScalar, refreshSalt, selectedMetricIds),
      [realKpis, days, filterScalar, refreshSalt, selectedMetricIds && selectedMetricIds.join(",")]
    );
    const overall = data.overall.score;
    const domainEntries = Object.entries(data.domains);

    // Empty edge case: user deselected every scorecard-relevant KPI. Show a
    // friendly nudge so the page never blanks out.
    if (data.isEmpty) {
      return (
        <div className="empty">
          None of your selected metrics belong to the scorecard's 5 domains
          (Incident / Problem / Change / Outage / Knowledge). Add at least
          one from the catalog under Hand-pick the menu, or re-pick the
          Product Health Scorecard template to restore the full set.
        </div>
      );
    }

    return (
      <>
        {/* Hero */}
        <div className="scorecard-hero">
          <Gauge score={overall} themeKey={themeKey} />
          <Radar domainScores={data.domains} themeKey={themeKey} />
          <div className="legend">
            <h4>How this scorecard works</h4>
            <div className="row"><span className="swatch ok" /><span>70+ · on target</span></div>
            <div className="row"><span className="swatch warn" /><span>40–69 · at risk</span></div>
            <div className="row"><span className="swatch crit" /><span>&lt; 40 · below target</span></div>
            <div className="note">
              Each KPI is scored 0–100 against a <strong>floor</strong> (worst acceptable) and a <strong>stretch</strong> (excellent).
              KPI scores are weighted into domain scores; domain scores roll up into the overall.
            </div>
          </div>
        </div>

        {/* Five domain cards */}
        <div className="domain-grid">
          {domainEntries.map(([name, dom]) => {
            const band = dom.band || AGG.scoreBand(dom.score);
            return (
              <div key={name} className={"domain-card " + band.cls}>
                <div className="head">
                  <h4>{dom.name}</h4>
                  <div className="meta-row">
                    <span>Weight {Math.round(dom.weight * 100)}%</span>
                    <span>·</span>
                    <span className="summary">{dom.summary}</span>
                  </div>
                </div>
                <div className="score-row">
                  <div className="num-wrap">
                    <span className="num">{dom.score == null ? "—" : dom.score}</span>
                    <span className="max">/ 100</span>
                  </div>
                  <span className="band-pill">{band.label}</span>
                </div>
                <div className="progress"><div className="fill" style={{ width: (dom.score || 0) + "%" }} /></div>
                <div className="kpi-list">
                  {dom.kpis.map(k => {
                    const kBand = AGG.scoreBand(k.score);
                    const canDrill = !!(k.metricId && AGG.METRIC_INFO[k.metricId] && onOpenKpi);
                    return (
                      <div key={k.name} className="kpi-row"
                        role={canDrill ? "button" : undefined}
                        tabIndex={canDrill ? 0 : undefined}
                        title={canDrill ? "Drill into " + k.name : undefined}
                        onClick={canDrill ? () => onOpenKpi({ metricId: k.metricId, value: k.rawValue, score: k.score, target: k.target }) : undefined}
                        onKeyDown={canDrill ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenKpi({ metricId: k.metricId, value: k.rawValue, score: k.score, target: k.target }); } } : undefined}>
                        <span className="kn">{k.name}</span>
                        <span className="kv">{k.value}</span>
                        <span className={"ks " + kBand.cls}>{k.score == null ? "—" : k.score}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom split: Insights + Leaderboard */}
        <div className="scorecard-bottom">
          <KeyTakeaways insights={insights} headline="Insights & Recommended Actions" />
          <Leaderboard overall={overall} services={dataset.shapes.by_service} themeKey={themeKey} />
        </div>
      </>
    );
  }

  // ============== KPI tile ===============================================
  function KpiTile({ metric, kpis, prevKpis, rows, onOpen }) {
    const info = AGG.METRIC_INFO[metric.id];
    const v = kpis[metric.id];
    const pv = prevKpis[metric.id];
    let cls = "flat", txt = "—", sign = "·";
    if (pv != null && !isNaN(pv) && pv !== 0 && v != null && !isNaN(v)) {
      const pct = ((v - pv) / Math.abs(pv)) * 100;
      const direction = pct > 0.5 ? 1 : pct < -0.5 ? -1 : 0;
      const goodIfUp = info.dir;
      if (direction === 0) cls = "flat";
      else if (goodIfUp === 0) cls = "flat";
      else if ((direction > 0 && goodIfUp > 0) || (direction < 0 && goodIfUp < 0)) cls = "up";
      else cls = "down";
      sign = pct > 0 ? "▲" : pct < 0 ? "▼" : "·";
      txt = (pct > 0 ? "+" : "") + pct.toFixed(1) + "%";
    }
    const series = AGG.metricSeries(metric.id, rows);
    return (
      <div className="kpi" role="button" tabIndex={0}
        title={"Drill into " + info.name}
        onClick={() => onOpen && onOpen(metric.id)}
        onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && onOpen) { e.preventDefault(); onOpen(metric.id); } }}>
        <span className="lbl">{info.name}</span>
        <span className="val">{info.fmt(v)} <small>{info.unit}</small></span>
        <span className={"delta " + cls}>
          <span>{sign} {txt}</span>
          <span className="vs">vs prior</span>
        </span>
        <Sparkline values={series} />
      </div>
    );
  }

  // ============== KPI drilldown ==========================================
  // Small line chart for the 6-window history (score for scored metrics,
  // raw value otherwise).
  function DrillHistoryChart({ points, themeKey, isScored }) {
    const ref = useRef(null);
    const chartRef = useRef(null);
    useEffect(() => {
      if (!ref.current || typeof window.Chart === "undefined") return;
      applyChartDefaults(themeKey);
      if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
      const c = readTheme(themeKey);
      const labels = points.map(p => (p.endISO || "").slice(5));
      const data = points.map(p => isScored ? p.score : p.value);
      try {
        chartRef.current = new Chart(ref.current, {
          type: "line",
          data: { labels, datasets: [{
            data,
            borderColor: c.accent, backgroundColor: c.accent + "22",
            fill: true, tension: 0.35, pointRadius: 3, pointHoverRadius: 5,
            pointBackgroundColor: c.accent, borderWidth: 1.8
          }] },
          options: {
            responsive: true, maintainAspectRatio: false, animation: { duration: 280 },
            plugins: {
              legend: { display: false },
              tooltip: { backgroundColor: c.ink, titleColor: c.paper, bodyColor: c.paper }
            },
            scales: {
              x: { grid: { display: false, drawBorder: false }, ticks: { color: c.ink_mute, font: { size: 10 } } },
              y: isScored
                ? { min: 0, max: 100, grid: { color: c.line, drawBorder: false }, ticks: { color: c.ink_mute, stepSize: 25 } }
                : { grid: { color: c.line, drawBorder: false }, ticks: { color: c.ink_mute } }
            }
          }
        });
      } catch (e) { console.error("Drill history chart failed", e); }
      return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; } };
    }, [points, themeKey, isScored]);
    return <div className="kdd-chart"><canvas ref={ref} /></div>;
  }

  function _drillShortDate(v) {
    if (!v || v === "—") return "—";
    try {
      const d = new Date(v + "T00:00:00");
      if (isNaN(d.getTime())) return v;
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    } catch (e) { return v; }
  }
  function _drillCell(val, key) {
    if (val == null) return "—";
    if (key === "hrs" || key === "downHrs") return Number(val).toFixed(1);
    if (/ISO$/.test(key)) return _drillShortDate(val);
    return String(val);
  }

  // The drilldown panel. Opened from a KPI tile (non-scorecard) or a scorecard
  // KPI row. `preset*` lets the scorecard pass the exact value/score it showed
  // so the card and the drilldown agree.
  function KpiDrilldown({ metricId, presetValue, presetScore, presetTarget,
                          kpis, daily, days, custom, filters, shapes, themeKey, onClose }) {
    useEffect(() => {
      const onKey = (e) => { if (e.key === "Escape") onClose(); };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    const [csvBusy, setCsvBusy] = useState(false);

    const info = AGG.METRIC_INFO[metricId];
    const target = presetTarget || AGG.METRIC_TARGETS[metricId];
    const scored = !!(target && target.dir);
    const value = presetValue != null ? presetValue : (kpis ? kpis[metricId] : null);
    const score = presetScore != null ? presetScore
                : scored ? AGG.scoreKpi(value, target) : null;
    const band = AGG.scoreBand(score);
    const dom = AGG.DOMAIN_OF[metricId] || "incident";

    const history  = useMemo(() => AGG.scoreHistorySeries(metricId, daily, days, custom, filters, shapes, 6),
      [metricId, daily, days, custom && custom.startISO, custom && custom.endISO, filters, shapes]);
    const products = useMemo(() => AGG.contributingProducts(metricId, kpis, shapes, filters),
      [metricId, kpis, shapes, filters]);
    const tickets  = useMemo(() => AGG.synthesizeTickets(metricId, daily, days, custom, filters, shapes, 60),
      [metricId, daily, days, custom && custom.startISO, custom && custom.endISO, filters, shapes]);

    const worst = products && products[0] ? products[0].product : null;
    const actions = AGG.recommendedActionsFor(metricId, value, score, target, worst);
    const dirText = !scored ? "Context metric · not scored"
                  : target.dir > 0 ? "Higher is better" : "Lower is better";
    const fmt = info ? info.fmt : (x) => x;
    const markerPos = score == null ? 0 : Math.max(2, Math.min(98, score));

    // Build + download a CSV of EVERY contributing record (not just the sample).
    // Deferred a tick so the "Preparing…" state paints before the synchronous
    // generation of a potentially large record set.
    const downloadCsv = () => {
      if (csvBusy) return;
      setCsvBusy(true);
      setTimeout(() => {
        try {
          const out = AGG.ticketsToCSV(metricId, daily, days, custom, filters, shapes);
          const blob = new Blob([out.csv], { type: "text/csv;charset=utf-8;" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = out.filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(url), 1500);
        } catch (e) {
          console.error("CSV export failed", e);
        } finally {
          setCsvBusy(false);
        }
      }, 30);
    };

    return (
      <div className="kdd-back" onClick={onClose}>
        <div className="kdd" onClick={e => e.stopPropagation()} role="dialog" aria-label={(info ? info.name : metricId) + " drilldown"}>
          <div className="kdd-head">
            <div className="flag"><Icon name="search" size={18} /></div>
            <div className="htxt">
              <div className="eyebrow">{dom} domain · KPI drilldown</div>
              <h2>{info ? info.name : metricId}</h2>
              <div className="sub">{dirText}{info && info.unit ? " · measured in " + info.unit : ""}</div>
            </div>
            <button className="close" aria-label="Close" onClick={onClose}>×</button>
          </div>

          <div className="kdd-body">
            {/* Stat cards */}
            <div className="kdd-cards">
              <div className="kdd-card">
                <span className="k">Current</span>
                <span className="v">{fmt(value)}</span>
                <span className="s">Period actual</span>
              </div>
              <div className="kdd-card">
                <span className="k">Score</span>
                <span className={"v " + (score == null ? "" : band.cls.replace("band-", ""))}>{score == null ? "—" : score}</span>
                <span className="s">{score == null ? "Not scored" : "Out of 100"}</span>
              </div>
              <div className="kdd-card">
                <span className="k">Floor</span>
                <span className="v" style={{ fontSize: 22 }}>{scored ? fmt(target.floor) : "—"}</span>
                <span className="s">{scored ? "Below = 0" : "—"}</span>
              </div>
              <div className="kdd-card">
                <span className="k">Stretch</span>
                <span className="v" style={{ fontSize: 22 }}>{scored ? fmt(target.stretch) : "—"}</span>
                <span className="s">{scored ? "At/above = 100" : "—"}</span>
              </div>
            </div>

            {/* Score band bar */}
            {scored && (
              <div className="kdd-section">
                <div className="kdd-scorebar">
                  <div className="t">How {info.name} maps to a 0–100 score</div>
                  <div className="kdd-gradient">
                    <div className="kdd-needle" style={{ left: markerPos + "%" }}>
                      <span className="lbl">{score} · {fmt(value)}</span>
                    </div>
                  </div>
                  <div className="kdd-sb-foot">
                    <span>Floor (0)<b>{fmt(target.floor)}</b></span>
                    <span className="mid">Amber band<b>40–69</b></span>
                    <span className="right">Stretch (100)<b>{fmt(target.stretch)}</b></span>
                  </div>
                </div>
              </div>
            )}

            {/* History */}
            <div className="kdd-section">
              <h4>{scored ? "6-window score history" : "Value history"}</h4>
              {history && history.length
                ? <DrillHistoryChart points={history} themeKey={themeKey} isScored={scored} />
                : <div className="kdd-note">Not enough history in the current window length to chart a trend.</div>}
            </div>

            {/* Contributing products */}
            <div className="kdd-section">
              <h4>Contributing products — worst first</h4>
              <table className="kdd-ptable">
                <thead>
                  <tr>
                    <th>Product</th><th>Service owner</th>
                    <th style={{ textAlign: "right" }}>Actual</th>
                    <th style={{ textAlign: "right" }}>{scored ? "Score" : "Share"}</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p, i) => {
                    const pb = AGG.scoreBand(p.score);
                    return (
                      <tr key={p.product + i}>
                        <td className="nm">{p.product}</td>
                        <td className="muted">{p.owner}</td>
                        <td style={{ textAlign: "right" }}>{p.actual}</td>
                        <td style={{ textAlign: "right" }}>
                          {p.score == null ? (
                            <span className="muted">{((shapes.by_service.find(s => s.name === p.product) || {}).share != null)
                              ? Math.round(((shapes.by_service.find(s => s.name === p.product) || {}).share) * 100) + "%" : "—"}</span>
                          ) : (
                            <span className={"pscore " + pb.cls}>
                              <span className="pbar"><span className={"pfill " + pb.cls} style={{ width: p.score + "%" }} /></span>
                              <b>{p.score}</b>
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Row-level records */}
            <div className="kdd-section">
              <div className="kdd-rows-head">
                <h4>Row-level details</h4>
                <button className="kdd-dl" onClick={downloadCsv} disabled={csvBusy}
                  title={"Download all " + tickets.total.toLocaleString() + " contributing records as CSV"}>
                  <Icon name="download" size={13} />
                  {csvBusy ? "Preparing…" : "Download full CSV"}
                </button>
              </div>
              <div className="kdd-rows-note">
                Showing {tickets.shown.toLocaleString()} of {tickets.total.toLocaleString()} contributing records
                {tickets.shown < tickets.total ? " (sampled — download for the full set)" : ""}
              </div>
              <div className="kdd-rows-wrap">
                <table className="kdd-rowtable">
                  <thead>
                    <tr>{tickets.columns.map(col => (
                      <th key={col.key} style={{ textAlign: col.align }}>{col.label}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {tickets.records.map((rec, ri) => (
                      <tr key={rec.id + ri}>
                        {tickets.columns.map(col => (
                          <td key={col.key} style={{ textAlign: col.align }}>{_drillCell(rec[col.key], col.key)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recommended actions */}
            <div className="kdd-section">
              <h4>Recommended actions</h4>
              <div className="kdd-actions">
                {actions.map((a, i) => (
                  <div className="kdd-act" key={i}>
                    <span className="n">{i + 1}</span>
                    <div className="atxt">
                      <div className="at">{a.title}</div>
                      <div className="ad">{a.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============== Dashboard component ====================================
  // Relative-time formatter for "Refreshed N ago" — small, dependency-free.
  function relativeTime(iso) {
    if (!iso) return "moments ago";
    const then = new Date(iso).getTime();
    if (isNaN(then)) return "moments ago";
    const secs = Math.max(0, (Date.now() - then) / 1000);
    if (secs < 30)        return "just now";
    if (secs < 60)        return Math.round(secs) + " seconds ago";
    if (secs < 3600)      return Math.round(secs / 60) + " minutes ago";
    if (secs < 86400)     return Math.round(secs / 3600) + " hours ago";
    return Math.round(secs / 86400) + " days ago";
  }

  function Dashboard({ manifest, dataset, theme, onBack, onExportHtml,
                       savedReportId, savedName, dataRefreshedAt,
                       onSave, onRename, onRefresh }) {
    useEffect(injectCssOnce, []);

    // The dashboard scopes its own theme onto the .dash root so the manifest's
    // theme override (Bonvoy Cream / Concierge Midnight / Letterpress) only
    // applies inside the dashboard view — the header ribbon stays in the
    // global theme. themeKey forces chart re-renders on theme change.
    const themeKey = theme || "cream";

    // Window state: initialized from the manifest, then user-controlled.
    const initialDays = AGG.parsePresetToDays(manifest.time_window && manifest.time_window.value);
    const [days, setDays] = useState(initialDays || 90);
    const [custom, setCustom] = useState(null);

    const dailyRange = useMemo(() => ({
      minISO: dataset.daily[0].date,
      maxISO: dataset.daily[dataset.daily.length - 1].date
    }), [dataset]);

    // Filters: start from the manifest, mutable in-view. Includes "team",
    // which the manifest doesn't carry but the dashboard supports.
    const [filters, setFilters] = useState(Object.assign(
      { priority: "all", service_group: "all", team: "all", region: "all" },
      manifest.filters || {}
    ));
    const setFilter   = (k, v) => setFilters(f => ({ ...f, [k]: v }));
    const clearFilters = () => setFilters({ priority: "all", service_group: "all", team: "all", region: "all" });

    const rows = useMemo(
      () => AGG.windowedRows(dataset.daily, days, custom),
      [dataset, days, custom]
    );
    const prev = useMemo(
      () => AGG.priorWindow(dataset.daily, days, custom),
      [dataset, days, custom]
    );
    const kpis = useMemo(
      () => AGG.kpisOver(rows, filters, dataset.shapes),
      [rows, filters, dataset]
    );
    const prevKpis = useMemo(
      () => AGG.kpisOver(prev, filters, dataset.shapes),
      [prev, filters, dataset]
    );

    const layout = manifest.layout === "scorecard" ? "scorecard"
                 : manifest.layout === "multi_tab" ? "multi"
                 : "single";
    const selectedMetrics = (manifest.metrics || []).filter(m => AGG.METRIC_INFO[m.id]);

    // Insights: deterministic generator runs whenever kpis or selected metrics
    // change. Non-scorecard reports get movement/filter/window-aware takeaways,
    // so we feed it the live filters + window.
    const insights = useMemo(
      () => AGG.generateInsights(kpis, prevKpis, manifest, {
        maxCount: 5, filters, windowDays: days, custom
      }),
      [kpis, prevKpis, manifest, filters, days, custom]
    );

    // KPI drilldown modal state. null = closed; object = { metricId, value?, score?, target? }.
    const [drill, setDrill] = useState(null);
    const openDrill   = (metricId) => setDrill({ metricId });
    const openDrillKpi = (payload) => setDrill(payload);

    // Salt for the scorecard's deterministic synthetic perturbation. Derived
    // from the report's dataRefreshedAt so each manual refresh shifts the
    // numbers visibly. Uses millisecond resolution (last 7 digits) so two
    // refreshes within the same second still produce distinct salts.
    const refreshSaltVal = useMemo(() => {
      if (!dataRefreshedAt) return 0;
      const t = new Date(dataRefreshedAt).getTime();
      return isNaN(t) ? 0 : (t % 10000000);
    }, [dataRefreshedAt]);

    const setPreset = (d) => { setDays(d); setCustom(null); };
    const enableCustom = (firstTime) => {
      if (firstTime === true) {
        const end = dailyRange.maxISO;
        const start = dataset.daily[Math.max(0, dataset.daily.length - 30)].date;
        setCustom({ startISO: start, endISO: end });
      } else {
        setCustom(firstTime);
      }
    };
    const clearFilter = (key) => setFilters(f => ({ ...f, [key]: "all" }));

    const refreshLabel = "Refreshes " + ((manifest.filters && manifest.filters.refresh) || "weekly");
    const generated = manifest.generated_at
      ? new Date(manifest.generated_at)
      : new Date();
    const dateStr = generated.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

    // Multi-tab layout — pick which metric's panel is active.
    const [activeTab, setActiveTab] = useState(selectedMetrics[0] ? selectedMetrics[0].id : null);
    useEffect(() => {
      if (layout === "multi" && selectedMetrics[0] && !selectedMetrics.some(m => m.id === activeTab)) {
        setActiveTab(selectedMetrics[0].id);
      }
    }, [layout, selectedMetrics, activeTab]);

    // ---- Save / Refresh state owned by the header ---------------------
    const isSaved = !!savedReportId;
    const [saving, setSaving] = useState(false);
    const [renaming, setRenaming] = useState(false);
    const [draftName, setDraftName] = useState(savedName || "");
    const [refreshing, setRefreshing] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0); // forces relativeTime to re-evaluate

    useEffect(() => { setDraftName(savedName || ""); }, [savedName]);

    // Tick the relative-time label every 30s so "just now" → "1 minute ago" without a click.
    useEffect(() => {
      const t = setInterval(() => setRefreshKey(k => k + 1), 30000);
      return () => clearInterval(t);
    }, []);

    const handleSaveClick = async () => {
      if (!onSave || saving) return;
      setSaving(true);
      try { await onSave(); } finally { setSaving(false); }
    };
    const commitRename = () => {
      const next = (draftName || "").trim();
      if (next && onRename && next !== savedName) onRename(next);
      setRenaming(false);
    };
    const handleRefreshClick = async () => {
      if (!onRefresh || refreshing) return;
      setRefreshing(true);
      try { await onRefresh(); } finally {
        setTimeout(() => { setRefreshing(false); setRefreshKey(k => k + 1); }, 600);
      }
    };

    return (
      <div className="dash" data-layout={layout}>
        <div className="dash-bar">
          <button className="back" onClick={onBack}>
            <Icon name="arrow" size={12} /> Back to builder
          </button>
          <span className="stamp">Dashboard view</span>
          <div className="spacer" />

          {/* Refresh affordance: real button if saved, decorative pill otherwise. */}
          {isSaved ? (
            <span className="refresh-pill" key={refreshKey}>
              <span>Refreshed {relativeTime(dataRefreshedAt)}</span>
              <button className={refreshing ? "spinning" : ""}
                onClick={handleRefreshClick}
                title="Refresh data"
                aria-label="Refresh data">
                <Icon name="refresh" size={12} />
              </button>
            </span>
          ) : (
            <span className="pill">{refreshLabel}</span>
          )}

          {/* Save / Saved pill */}
          {!isSaved && onSave && (
            <button className="save" onClick={handleSaveClick} disabled={saving}>
              <Icon name="bookmark" size={13} />
              {saving ? "Saving…" : "Save to library"}
            </button>
          )}
          {isSaved && (
            <span className="saved-pill" title="Saved to your library">
              <Icon name="check" size={12} />
              {renaming ? (
                <input
                  className="nm-edit"
                  autoFocus
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename();
                    if (e.key === "Escape") { setDraftName(savedName || ""); setRenaming(false); }
                  }}
                />
              ) : (
                <span className="nm">{savedName || "Saved report"}</span>
              )}
              {onRename && !renaming && (
                <button className="pencil" onClick={() => setRenaming(true)} aria-label="Rename" title="Rename">
                  <Icon name="edit" size={11} />
                </button>
              )}
            </span>
          )}

          {onExportHtml && (
            <button className="export" onClick={onExportHtml} title="Export a self-contained .html copy">
              <Icon name="download" size={13} /> Export HTML
            </button>
          )}
        </div>

        <div className="dash-canvas" data-theme={themeKey}>
        <main>
          <div className="title-row">
            <div className="left">
              <h1>{AGG.reportTitle(manifest)}</h1>
              <div className="meta">
                <span>Prepared for <strong>{manifest.user || "—"}</strong></span>
                <span>{manifest.role || ""}</span>
                <span>Generated <strong>{dateStr}</strong></span>
              </div>
            </div>
          </div>

          <WindowSelector days={days} custom={custom} dailyRange={dailyRange}
            onPreset={setPreset} onCustom={enableCustom} />
          <FilterBar filters={filters} shapes={dataset.shapes}
            onChange={setFilter} onClearAll={clearFilters} />
          <FilterRow filters={filters} onClear={clearFilter} />

          {selectedMetrics.length === 0 ? (
            <div className="empty">No metrics in this manifest. Head back and pick a few.</div>
          ) : layout === "scorecard" ? (
            <ScorecardView
              realKpis={kpis}
              days={days}
              filterScalar={AGG.filterScalar(filters, dataset.shapes)}
              refreshSalt={refreshSaltVal}
              dataset={dataset}
              themeKey={themeKey}
              insights={insights}
              selectedMetricIds={selectedMetrics.map(m => m.id)}
              onOpenKpi={openDrillKpi} />
          ) : (
            <>
              <KeyTakeaways insights={insights} />
              <div className="kpis">
                {selectedMetrics.map(m => (
                  <KpiTile key={m.id} metric={m} kpis={kpis} prevKpis={prevKpis} rows={rows} onOpen={openDrill} />
                ))}
              </div>

              {layout === "single" ? (
                <div className="grid">
                  {/* All charts render at a uniform half-width column — no last-card
                      full-width span — so the report stays visually even. */}
                  {selectedMetrics.map(m => (
                    <ChartCard key={m.id} metric={m} viz={m.viz} rows={rows}
                               kpis={kpis} shapes={dataset.shapes} themeKey={themeKey} />
                  ))}
                </div>
              ) : (
                <>
                  <div className="tabs">
                    {selectedMetrics.map(m => {
                      const info = AGG.METRIC_INFO[m.id];
                      return (
                        <button key={m.id} aria-pressed={activeTab === m.id}
                          onClick={() => setActiveTab(m.id)}>{info.name}</button>
                      );
                    })}
                  </div>
                  <div className="grid">
                    {selectedMetrics
                      .filter(m => m.id === activeTab)
                      .map(m => (
                        <ChartCard key={m.id} metric={m} viz={m.viz} rows={rows}
                                   kpis={kpis} shapes={dataset.shapes} themeKey={themeKey} />
                      ))}
                  </div>
                </>
              )}
            </>
          )}

          <div className="footer-line">
            <div className="credit">Live in <em>Insight Concierge</em> · Data Café</div>
            <div className="mono">Manifest v{manifest.manifest_version || "1.0"} · {dataset.daily.length} days</div>
          </div>

          <details className="dev">
            <summary>How this was assembled · manifest.json</summary>
            <pre>{JSON.stringify(manifest, null, 2)}</pre>
          </details>

          {drill && (
            <KpiDrilldown
              metricId={drill.metricId}
              presetValue={drill.value}
              presetScore={drill.score}
              presetTarget={drill.target}
              kpis={kpis}
              daily={dataset.daily}
              days={days}
              custom={custom}
              filters={filters}
              shapes={dataset.shapes}
              themeKey={themeKey}
              onClose={() => setDrill(null)} />
          )}
        </main>
        </div>
      </div>
    );
  }

  window.Dashboard = Dashboard;
})();
