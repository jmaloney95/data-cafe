// Report template — buildReportHtml(manifest, dataset) → self-contained HTML string.
//
// The output is a single HTML document with inlined CSS + JS that:
//   • reads window.__MANIFEST__ and window.__DATA__ (injected at build time)
//   • renders KPI tiles, charts (Chart.js inlined or CDN), and a live time-window slicer
//   • supports cream / midnight / print themes + single-page / multi-tab layouts
//   • supports filters from the manifest, applied as scaling factors on shapes
//
// Chart.js: fetched once at module load from /chart.umd.min.js (sibling file)
// and cached on window.__CHART_JS_SOURCE__. buildReportHtml inlines that source
// into every generated report. If the fetch fails (e.g. running from file://
// without the static server), buildReportHtml falls back to the CDN URL so the
// report still works on a connected machine.

(function () {
  // -------------------- Chart.js inline-source loader --------------------
  // Fires immediately when this file is parsed. Result lands on
  // window.__CHART_JS_SOURCE__ as a (possibly large) string. By the time the
  // user clicks Generate, this fetch is almost certainly done.
  const CHART_JS_PATH    = "chart.umd.min.js";
  const CHART_JS_CDN_URL = "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js";
  if (typeof window !== "undefined" && !window.__CHART_JS_SOURCE__ && !window.__CHART_JS_LOADING__) {
    window.__CHART_JS_LOADING__ = true;
    fetch(CHART_JS_PATH)
      .then(r => r.ok ? r.text() : Promise.reject(new Error("HTTP " + r.status)))
      .then(src => {
        // </script> inside a string would terminate the host <script> tag.
        // Defensive escape so the inlined source survives the report's parser.
        window.__CHART_JS_SOURCE__ = src.replace(/<\/script>/gi, "<\\/script>");
        window.__CHART_JS_LOADING__ = false;
      })
      .catch(err => {
        console.warn("[report-template] Chart.js inline-source fetch failed:", err.message,
                     "— generated reports will use the CDN fallback.");
        window.__CHART_JS_LOADING__ = false;
      });
  }


  // -------------------- helpers (used at build time) --------------------
  const TEMPLATE_NAMES = {
    exec_health: "Executive Health Overview",
    routing:     "Routing Efficiency Audit",
    daily:       "Daily Operational Snapshot",
    quarterly:   "Quarterly Board Briefing",
    deep_dive:   "Full Incident Deep Dive",
    regional:    "Regional Property Performance"
  };
  const VIZ_NORM = (v) => (v || "").toString().toLowerCase().replace(/\s+/g, "_");

  function reportTitle(manifest) {
    const tid = manifest.template_id || manifest.template;
    if (tid && TEMPLATE_NAMES[tid]) return TEMPLATE_NAMES[tid];
    if (manifest.metrics && manifest.metrics.length) {
      const first = manifest.metrics[0].id;
      if (first === "reassign" || first === "reopen") return "Service Quality Brief";
      if (first === "p1")    return "Critical Incident Watch";
      if (first === "mttr")  return "Velocity & Resolution Brief";
      return "Custom Incident Report";
    }
    return "Custom Report";
  }

  function reportFilename(manifest) {
    const t = (manifest.template_id || manifest.template || "report")
      .replace(/[^a-z0-9_-]/gi, "-").toLowerCase();
    const d = new Date().toISOString().slice(0, 10);
    return `${t}_${d}`;
  }

  // -------------------- the HTML/CSS/JS payload -------------------------
  // NOTE: this is a single template literal. Anything inside ${ } executes at
  // BUILD time (in the Insight Concierge tab). Anything in plain backticks is
  // emitted into the report verbatim and runs at OPEN time (in the new tab).
  function buildReportHtml(manifest, dataset) {
    const title = reportTitle(manifest);
    const themeMap = { brand_light: "cream", modern_dark: "midnight", minimal_print: "print" };
    const theme = themeMap[manifest.theme] || "cream";
    const layout = manifest.layout === "multi_tab" ? "multi" : "single";

    const manifestJson = JSON.stringify(manifest, null, 2);
    const datasetJson  = JSON.stringify(dataset);

    // Chart.js: prefer inlined source (zero network dependency); fall back to CDN.
    const inlinedChart = (typeof window !== "undefined" && window.__CHART_JS_SOURCE__) || null;
    const chartTag = inlinedChart
      ? `<script>/* Chart.js 4.4.1 — inlined for offline portability */\n${inlinedChart}\n</script>`
      : `<script src="${CHART_JS_CDN_URL}"></script>`;

    return `<!DOCTYPE html>
<html lang="en" data-theme="${theme}" data-layout="${layout}">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${title} · Data Café</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,300;0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&family=Geist:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
${chartTag}
<style>
  /* ---- Theme tokens (mirror Insight Concierge for visual continuity) ---- */
  html[data-theme="cream"] {
    --bg:#f4eee3; --bg-soft:#ece4d2; --paper:#faf6ec; --paper-2:#f7f1e2;
    --ink:#1f1a12; --ink-2:#3a3225; --ink-soft:#5b513f; --ink-mute:#8a7e64;
    --line:#e0d6bf; --line-strong:#c9bd9f;
    --accent:#8a5a2b; --accent-deep:#6e4520; --accent-soft:#f0e4ce; --accent-ink:#faf6ec;
    --gold:#b4894a; --ok:#5a6f3f; --warn:#a8642a; --crit:#8b3a2b;
    --shadow-sm:0 1px 2px rgba(57,42,18,.06);
    --shadow-md:0 1px 2px rgba(57,42,18,.06), 0 8px 24px -10px rgba(57,42,18,.18);
  }
  html[data-theme="midnight"] {
    --bg:#0e1722; --bg-soft:#16202d; --paper:#182434; --paper-2:#1d2c3f;
    --ink:#f3ead6; --ink-2:#e3d8be; --ink-soft:#b9ad91; --ink-mute:#7d7460;
    --line:#243549; --line-strong:#34495f;
    --accent:#d4a657; --accent-deep:#b6873e; --accent-soft:#2a3548; --accent-ink:#0e1722;
    --gold:#d4a657; --ok:#94b87a; --warn:#d99a55; --crit:#d97058;
    --shadow-sm:0 1px 2px rgba(0,0,0,.4);
    --shadow-md:0 1px 2px rgba(0,0,0,.4), 0 12px 28px -12px rgba(0,0,0,.6);
  }
  html[data-theme="print"] {
    --bg:#fafaf7; --bg-soft:#f1f1ed; --paper:#ffffff; --paper-2:#f5f5f1;
    --ink:#111111; --ink-2:#2a2a2a; --ink-soft:#555; --ink-mute:#888;
    --line:#dcdcd4; --line-strong:#bcbcb4;
    --accent:#222; --accent-deep:#000; --accent-soft:#eaeae3; --accent-ink:#fff;
    --gold:#444; --ok:#3b3b3b; --warn:#5a5a5a; --crit:#1a1a1a;
    --shadow-sm:none; --shadow-md:0 1px 2px rgba(0,0,0,.06);
  }

  *, *::before, *::after { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: "Geist", ui-sans-serif, system-ui, sans-serif;
    background: var(--bg); color: var(--ink);
    font-size: 14px; line-height: 1.45;
    -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility;
    min-height: 100vh;
  }
  body::before {
    content: ""; position: fixed; inset: 0; pointer-events: none;
    background-image:
      radial-gradient(rgba(0,0,0,.018) 1px, transparent 1px),
      radial-gradient(rgba(255,255,255,.03) 1px, transparent 1px);
    background-size: 3px 3px, 7px 7px; background-position: 0 0, 1px 2px;
    mix-blend-mode: multiply; opacity: .55; z-index: 0;
  }
  html[data-theme="midnight"] body::before { mix-blend-mode: overlay; opacity: .35; }
  html[data-theme="print"] body::before { display: none; }

  h1, h2, h3, h4 {
    font-family: "Newsreader", "Iowan Old Style", Georgia, serif;
    font-weight: 500; letter-spacing: -0.011em; margin: 0; color: var(--ink);
  }
  h1 { font-size: 32px; line-height: 1.08; }
  h2 { font-size: 22px; line-height: 1.2; }
  h3 { font-size: 16px; font-weight: 600; }
  em.brand { font-style: italic; color: var(--accent); font-weight: 400; }
  .mono { font-family: "JetBrains Mono", ui-monospace, monospace;
          font-size: 11px; letter-spacing: .04em; text-transform: uppercase;
          color: var(--ink-mute); }
  .eyebrow { font-family: "JetBrains Mono", ui-monospace, monospace;
             font-size: 10.5px; letter-spacing: .14em; text-transform: uppercase;
             color: var(--ink-mute); }

  /* ---- Layout shell ---- */
  .app { position: relative; z-index: 1; }
  .hdr {
    position: sticky; top: 0; z-index: 30;
    display: flex; align-items: center; gap: 18px;
    padding: 16px 28px;
    background: color-mix(in oklab, var(--bg) 88%, transparent);
    backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
    border-bottom: 1px solid var(--line);
  }
  .brand-mark {
    width: 36px; height: 36px; flex-shrink: 0;
    border-radius: 8px; background: var(--ink); color: var(--paper);
    display: grid; place-items: center;
    font-family: "Newsreader", serif; font-style: italic; font-weight: 500; font-size: 20px;
  }
  html[data-theme="midnight"] .brand-mark { background: var(--accent); color: var(--bg); }
  .brand-stack { display: flex; flex-direction: column; gap: 1px; }
  .brand-name { font-family: "Newsreader", serif; font-size: 15px; font-weight: 500; }
  .brand-name em { font-style: italic; color: var(--accent); font-weight: 400; }
  .brand-sub { font-family: "JetBrains Mono", monospace; font-size: 9px;
               letter-spacing: .18em; text-transform: uppercase; color: var(--ink-mute); }
  .hdr-spacer { flex: 1; }
  .hdr-pill {
    font-family: "JetBrains Mono", monospace; font-size: 9.5px;
    letter-spacing: .14em; text-transform: uppercase;
    background: var(--accent-soft); color: var(--accent-deep);
    padding: 4px 9px; border-radius: 4px;
  }
  html[data-theme="midnight"] .hdr-pill { background: color-mix(in oklab, var(--accent) 24%, transparent); color: var(--accent); }

  main { max-width: 1240px; margin: 0 auto; padding: 32px 28px 80px; }

  /* ---- Title block ---- */
  .title-row { display: flex; align-items: end; justify-content: space-between; gap: 24px;
               margin-bottom: 22px; padding-bottom: 18px; border-bottom: 1px solid var(--line); }
  .title-row .left h1 { margin-bottom: 6px; }
  .title-row .left .meta { display: flex; gap: 14px; flex-wrap: wrap;
                           font-size: 12.5px; color: var(--ink-mute); }
  .title-row .left .meta strong { color: var(--ink); font-weight: 500; }
  .title-row .right { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }

  /* ---- Window selector ---- */
  .window-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
                margin-bottom: 22px; }
  .window-row .label { font-family: "JetBrains Mono", monospace; font-size: 10px;
                       letter-spacing: .14em; text-transform: uppercase;
                       color: var(--ink-mute); margin-right: 8px; }
  .chip {
    appearance: none; background: var(--paper); color: var(--ink-soft);
    border: 1px solid var(--line);
    font-family: "JetBrains Mono", monospace; font-size: 11px;
    letter-spacing: .08em; padding: 7px 13px; border-radius: 999px;
    cursor: pointer; transition: all .15s;
  }
  .chip:hover { color: var(--ink); border-color: var(--line-strong); }
  .chip[aria-pressed="true"] {
    background: var(--ink); color: var(--paper); border-color: var(--ink);
  }
  html[data-theme="midnight"] .chip[aria-pressed="true"] { background: var(--accent); color: var(--bg); border-color: var(--accent); }
  .custom-range { display: none; gap: 10px; align-items: center;
                  margin-left: 8px; padding-left: 12px; border-left: 1px solid var(--line); }
  .custom-range.show { display: flex; }
  .custom-range input[type=date] {
    font: inherit; font-size: 12px;
    background: var(--paper); border: 1px solid var(--line);
    color: var(--ink); padding: 6px 10px; border-radius: 6px;
  }
  .filter-chip {
    display: inline-flex; align-items: center; gap: 6px;
    margin-left: auto;
    padding: 4px 10px 4px 12px;
    background: color-mix(in oklab, var(--accent) 14%, transparent);
    border: 1px solid var(--accent);
    border-radius: 999px;
    font-size: 11.5px; color: var(--accent);
    font-family: "JetBrains Mono", monospace; letter-spacing: .06em;
  }
  .filter-chip button {
    background: transparent; border: 0; color: var(--accent); cursor: pointer;
    width: 16px; height: 16px; border-radius: 50%; padding: 0;
    display: grid; place-items: center; font-size: 12px;
  }
  .filter-chip button:hover { background: color-mix(in oklab, var(--accent) 22%, transparent); }

  /* ---- KPI strip ---- */
  .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 12px; margin-bottom: 22px; }
  .kpi {
    background: var(--paper); border: 1px solid var(--line);
    border-radius: 12px; padding: 16px 18px;
    display: flex; flex-direction: column; gap: 6px;
    box-shadow: var(--shadow-sm);
  }
  .kpi .lbl { font-family: "JetBrains Mono", monospace; font-size: 9.5px;
              letter-spacing: .14em; text-transform: uppercase; color: var(--ink-mute); }
  .kpi .val { font-family: "Newsreader", serif; font-size: 28px;
              font-weight: 500; color: var(--ink); font-variant-numeric: tabular-nums; line-height: 1.1; }
  .kpi .val small { font-family: "JetBrains Mono", monospace; font-size: 10px;
                    color: var(--ink-mute); margin-left: 4px; letter-spacing: .1em;
                    text-transform: uppercase; font-weight: 400; }
  .kpi .delta { display: flex; align-items: baseline; gap: 6px; font-size: 11.5px; }
  .kpi .delta.up   { color: var(--ok); }
  .kpi .delta.down { color: var(--crit); }
  .kpi .delta.flat { color: var(--ink-mute); }
  .kpi .delta .vs { font-family: "JetBrains Mono", monospace; font-size: 9px;
                    color: var(--ink-mute); letter-spacing: .1em; text-transform: uppercase; }
  .kpi .spark { height: 28px; margin-top: 4px; }
  .kpi .spark svg { width: 100%; height: 100%; overflow: visible; }
  .kpi .spark path { fill: none; stroke: var(--accent); stroke-width: 1.4; }
  .kpi .spark .area { fill: color-mix(in oklab, var(--accent) 14%, transparent); stroke: none; }

  /* ---- Chart grid ---- */
  .grid { display: grid; gap: 18px; }
  html[data-layout="single"] .grid { grid-template-columns: repeat(2, 1fr); }
  html[data-layout="single"] .chart-card.span2 { grid-column: span 2; }
  html[data-layout="multi"] .grid { grid-template-columns: 1fr; }

  .chart-card {
    background: var(--paper); border: 1px solid var(--line);
    border-radius: 14px; padding: 18px 20px;
    box-shadow: var(--shadow-sm);
    display: flex; flex-direction: column; gap: 12px;
  }
  .chart-card .chd { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
  .chart-card .chd h3 { font-family: "Newsreader", serif; font-weight: 500; font-size: 17px; }
  .chart-card .chd .vt {
    font-family: "JetBrains Mono", monospace; font-size: 9.5px;
    letter-spacing: .14em; text-transform: uppercase; color: var(--ink-mute);
  }
  .chart-card .body { position: relative; height: 220px; }
  html[data-layout="multi"] .chart-card .body { height: 320px; }
  .chart-card .descr { font-size: 12px; color: var(--ink-mute); line-height: 1.5; }

  /* ---- Stub / fallback panel ---- */
  .stub {
    background: linear-gradient(135deg, var(--paper-2), var(--paper));
    border: 1px dashed var(--line-strong);
    border-radius: 10px;
    padding: 16px 18px; margin-bottom: 12px;
    display: flex; align-items: center; gap: 12px;
    font-size: 12.5px; color: var(--ink-soft);
  }
  .stub .badge {
    font-family: "JetBrains Mono", monospace; font-size: 9px;
    letter-spacing: .14em; text-transform: uppercase;
    background: var(--accent-soft); color: var(--accent-deep);
    padding: 3px 7px; border-radius: 3px; flex-shrink: 0;
  }
  html[data-theme="midnight"] .stub .badge { background: color-mix(in oklab, var(--accent) 24%, transparent); color: var(--accent); }
  .stub .msg em { font-style: italic; color: var(--accent); }

  /* ---- Multi-tab layout ---- */
  .tabs { display: flex; gap: 2px; flex-wrap: wrap; margin-bottom: 18px;
          border-bottom: 1px solid var(--line); }
  .tabs button {
    appearance: none; background: transparent; border: 0;
    padding: 10px 16px; font: inherit; font-size: 13px;
    color: var(--ink-soft); border-bottom: 2px solid transparent;
    cursor: pointer; margin-bottom: -1px;
    font-family: "Newsreader", serif; font-weight: 500;
  }
  .tabs button:hover { color: var(--ink); }
  .tabs button[aria-pressed="true"] { color: var(--accent); border-bottom-color: var(--accent); }
  .tab-panel { display: none; }
  .tab-panel.active { display: block; }
  .tab-panel .breakdown {
    margin-top: 16px;
    background: var(--paper-2);
    border: 1px solid var(--line); border-radius: 10px;
    padding: 14px 18px;
  }
  .tab-panel .breakdown table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  .tab-panel .breakdown th, .tab-panel .breakdown td {
    text-align: left; padding: 8px 0; border-bottom: 1px dashed var(--line);
  }
  .tab-panel .breakdown th { font-family: "JetBrains Mono", monospace; font-size: 10px;
                             letter-spacing: .12em; text-transform: uppercase;
                             color: var(--ink-mute); font-weight: 500; }
  .tab-panel .breakdown td.num { text-align: right;
                                 font-family: "JetBrains Mono", monospace;
                                 font-variant-numeric: tabular-nums;
                                 letter-spacing: .04em; }

  /* ---- Footer / dev pane ---- */
  .footer {
    margin-top: 40px; padding-top: 22px; border-top: 1px solid var(--line);
    display: flex; justify-content: space-between; align-items: baseline; gap: 24px;
    font-size: 12px; color: var(--ink-mute);
  }
  .footer .credit { font-family: "Newsreader", serif; font-style: italic; }
  .footer .credit em { color: var(--accent); }
  details.dev {
    margin-top: 18px;
    background: var(--paper-2); border: 1px solid var(--line);
    border-radius: 10px; padding: 14px 18px;
  }
  details.dev summary {
    cursor: pointer;
    font-family: "JetBrains Mono", monospace; font-size: 10px;
    letter-spacing: .14em; text-transform: uppercase; color: var(--ink-mute);
    list-style: none; outline: none;
  }
  details.dev summary::-webkit-details-marker { display: none; }
  details.dev summary::before { content: "▸ "; color: var(--accent); }
  details.dev[open] summary::before { content: "▾ "; }
  details.dev pre {
    margin: 12px 0 0;
    background: color-mix(in oklab, var(--ink) 95%, transparent);
    color: var(--paper);
    padding: 14px 16px; border-radius: 8px;
    font-family: "JetBrains Mono", monospace; font-size: 10.5px;
    overflow-x: auto; line-height: 1.55;
  }
  html[data-theme="midnight"] details.dev pre { background: var(--bg); }
  html[data-theme="print"] details.dev pre { background: #f0f0eb; color: #111; }

  @media print {
    .window-row, .filter-chip button, details.dev { display: none !important; }
    .chart-card, .kpi { box-shadow: none !important; break-inside: avoid; }
  }
  @media (max-width: 760px) {
    html[data-layout="single"] .grid { grid-template-columns: 1fr; }
    html[data-layout="single"] .chart-card.span2 { grid-column: auto; }
  }
</style>
</head>
<body>
<div class="app">
  <header class="hdr">
    <div class="brand-mark">C</div>
    <div class="brand-stack">
      <div class="brand-name">Data <em>Cafe</em></div>
      <div class="brand-sub">Insight Concierge · Report</div>
    </div>
    <div class="hdr-spacer"></div>
    <div class="hdr-pill" id="refresh-pill"></div>
  </header>

  <main>
    <div class="title-row">
      <div class="left">
        <h1 id="report-title"></h1>
        <div class="meta">
          <span>Prepared for <strong id="report-user"></strong></span>
          <span id="report-role"></span>
          <span>Generated <strong id="report-date"></strong></span>
        </div>
      </div>
      <div class="right" id="filter-area"></div>
    </div>

    <div class="window-row">
      <span class="label">Window</span>
      <button class="chip" data-win="7">7 days</button>
      <button class="chip" data-win="30">30 days</button>
      <button class="chip" data-win="60">60 days</button>
      <button class="chip" data-win="90">90 days</button>
      <button class="chip" data-win="custom">Custom</button>
      <div class="custom-range" id="custom-range">
        <input type="date" id="custom-start" />
        <span class="mono">to</span>
        <input type="date" id="custom-end" />
      </div>
    </div>

    <div id="kpis" class="kpis"></div>

    <div id="layout-area"></div>

    <div class="footer">
      <div class="credit">Generated by <em>Data Café</em> · Technology Experience Center</div>
      <div class="mono" id="footer-stamp"></div>
    </div>

    <details class="dev">
      <summary>How this report was assembled · manifest.json</summary>
      <pre id="manifest-out"></pre>
    </details>
  </main>
</div>

<script>window.__MANIFEST__ = ${manifestJson};</script>
<script>window.__DATA__ = ${datasetJson};</script>

<script>
(function () {
  "use strict";
  const M = window.__MANIFEST__;
  const D = window.__DATA__;

  // ---- Metric catalog (label, units, formatter, "higher is better") ----
  const METRIC_INFO = {
    opened:      { name: "Opened Incidents",     unit: "tickets", fmt: fmtInt,  category: "volume",     dir: 0 },
    resolved:    { name: "Resolved",             unit: "tickets", fmt: fmtInt,  category: "resolution", dir: 1 },
    p1:          { name: "P1 Critical (Open)",   unit: "open",    fmt: fmtInt,  category: "priority",   dir: -1 },
    same_day:    { name: "Same Day Resolution",  unit: "rate",    fmt: fmtPct,  category: "efficiency", dir: 1 },
    reassign:    { name: "Reassignment Rate",    unit: "rate",    fmt: fmtPct,  category: "routing",    dir: -1 },
    reopen:      { name: "Reopen Rate",          unit: "rate",    fmt: fmtPct,  category: "quality",    dir: -1 },
    mttr:        { name: "Avg. MTTR",            unit: "hours",   fmt: fmtHrs,  category: "velocity",   dir: -1 },
    aging:       { name: "Aging > 7 Days",       unit: "tickets", fmt: fmtInt,  category: "backlog",    dir: -1 },
    sla:         { name: "SLA Compliance",       unit: "rate",    fmt: () => "—", category: "compliance", dir: 1 }
  };

  function fmtInt(n) { if (n == null || isNaN(n)) return "—"; return Math.round(n).toLocaleString(); }
  function fmtPct(n) { if (n == null || isNaN(n)) return "—"; return n.toFixed(1) + "%"; }
  function fmtHrs(n) { if (n == null || isNaN(n)) return "—"; return n.toFixed(1) + " hrs"; }

  // ---- Window state ---------------------------------------------------
  // Window is expressed in days; "custom" carries a start/end date.
  const initialDays = (function () {
    const v = (M.time_window && M.time_window.value) || "90d";
    if (v === "7d") return 7;
    if (v === "30d") return 30;
    if (v === "60d") return 60;
    if (v === "custom") return null;
    return 90;
  })();

  const state = {
    days: initialDays || 90,
    custom: null,                              // {startISO, endISO}
    filters: Object.assign({ priority: "all", service_group: "all", region: "all" },
                           M.filters || {})
  };

  // ---- Aggregation ----------------------------------------------------
  function windowedRows() {
    if (state.custom) {
      const s = state.custom.startISO, e = state.custom.endISO;
      return D.daily.filter(r => r.date >= s && r.date <= e);
    }
    const days = Math.max(1, Math.min(D.daily.length, state.days));
    return D.daily.slice(D.daily.length - days);
  }

  function filterScalar() {
    // Combined scaling factor based on active filters (applied to volume metrics).
    let s = 1;
    if (state.filters.region && state.filters.region !== "all") {
      const m = (D.shapes.by_region.find(x => x.name === state.filters.region) || {}).share;
      if (m) s *= m;
    }
    if (state.filters.service_group && state.filters.service_group !== "all") {
      const m = (D.shapes.by_service.find(x => x.name === state.filters.service_group) || {}).share;
      if (m) s *= m;
    }
    if (state.filters.priority === "P1 + P2 only") {
      const p1 = (D.shapes.by_priority.find(x => x.name === "P1") || {}).share || 0;
      const p2 = (D.shapes.by_priority.find(x => x.name === "P2") || {}).share || 0;
      s *= (p1 + p2);
    } else if (state.filters.priority === "P3 + P4 only") {
      const p3 = (D.shapes.by_priority.find(x => x.name === "P3") || {}).share || 0;
      const p4 = (D.shapes.by_priority.find(x => x.name === "P4") || {}).share || 0;
      s *= (p3 + p4);
    }
    return s;
  }

  function kpisOver(rows) {
    const sum = (k) => rows.reduce((a, r) => a + r[k], 0);
    if (rows.length === 0) {
      return { opened:0, resolved:0, p1:0, same_day:0, reassign:0, reopen:0, mttr:NaN, aging:0, sla:null };
    }
    const last = rows[rows.length - 1];
    const f = filterScalar();
    return {
      opened:   sum("opened") * f,
      resolved: sum("resolved") * f,
      p1:       last.p1_open_snapshot * f,
      same_day: (sum("same_day_resolved") / sum("opened")) * 100,
      reassign: (sum("reassignments")     / sum("opened")) * 100,
      reopen:   (sum("reopens")           / sum("resolved")) * 100,
      mttr:     sum("mttr_hours_sum")     / sum("mttr_hours_count"),
      aging:    last.aging_7d_snapshot * f,
      sla:      null
    };
  }

  function priorWindow() {
    // Same-length window immediately preceding the active one — for delta calc.
    if (state.custom) {
      const s = D.daily.findIndex(r => r.date === state.custom.startISO);
      const e = D.daily.findIndex(r => r.date === state.custom.endISO);
      if (s < 0 || e < 0) return [];
      const len = e - s + 1;
      const ps = Math.max(0, s - len);
      return D.daily.slice(ps, s);
    }
    const days = state.days;
    const end = D.daily.length - days;
    const start = Math.max(0, end - days);
    return D.daily.slice(start, end);
  }

  // ---- Sparkline (inline SVG, no chart lib needed) -------------------
  function sparkline(values) {
    if (!values || values.length === 0) return "";
    const w = 120, h = 28, pad = 2;
    const min = Math.min.apply(null, values);
    const max = Math.max.apply(null, values);
    const range = (max - min) || 1;
    const step = (w - pad * 2) / Math.max(1, values.length - 1);
    let d = "";
    let area = "M" + pad + "," + (h - pad);
    values.forEach((v, i) => {
      const x = pad + i * step;
      const y = h - pad - ((v - min) / range) * (h - pad * 2);
      d += (i === 0 ? "M" : "L") + x.toFixed(1) + "," + y.toFixed(1) + " ";
      area += " L" + x.toFixed(1) + "," + y.toFixed(1);
    });
    area += " L" + (w - pad) + "," + (h - pad) + " Z";
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none">' +
           '<path class="area" d="' + area + '"/>' +
           '<path d="' + d + '"/>' +
           '</svg>';
  }

  function metricSeries(metricId, rows) {
    // Per-day series for a given metric over the windowed rows.
    if (rows.length === 0) return [];
    if (metricId === "opened")   return rows.map(r => r.opened);
    if (metricId === "resolved") return rows.map(r => r.resolved);
    if (metricId === "p1")       return rows.map(r => r.p1_open_snapshot);
    if (metricId === "same_day") return rows.map(r => r.opened > 0 ? (r.same_day_resolved / r.opened) * 100 : 0);
    if (metricId === "reassign") return rows.map(r => r.opened > 0 ? (r.reassignments     / r.opened) * 100 : 0);
    if (metricId === "reopen")   return rows.map(r => r.resolved > 0 ? (r.reopens / r.resolved) * 100 : 0);
    if (metricId === "mttr")     return rows.map(r => r.mttr_hours_count > 0 ? r.mttr_hours_sum / r.mttr_hours_count : 0);
    if (metricId === "aging")    return rows.map(r => r.aging_7d_snapshot);
    return [];
  }

  // ---- Header rendering ----------------------------------------------
  document.getElementById("report-title").textContent = ${JSON.stringify(title)};
  document.getElementById("report-user").textContent = M.user || "—";
  document.getElementById("report-role").textContent = M.role || "";
  document.getElementById("report-date").textContent = new Date().toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric"
  });
  const refreshLabel = (function () {
    const r = (M.filters && M.filters.refresh) || (M.refresh) || "weekly";
    return "Refreshes " + r;
  })();
  document.getElementById("refresh-pill").textContent = refreshLabel;
  document.getElementById("footer-stamp").textContent =
    "Manifest v" + (M.manifest_version || "1.0") + " · " + (D.meta.records_label || (D.daily.length + " days"));
  document.getElementById("manifest-out").textContent = JSON.stringify(M, null, 2);

  // ---- Filter chip ---------------------------------------------------
  function renderFilters() {
    const area = document.getElementById("filter-area");
    area.innerHTML = "";
    const f = state.filters;
    const active = [];
    if (f.priority && f.priority !== "all") active.push(["Priority", f.priority, "priority"]);
    if (f.service_group && f.service_group !== "all") active.push(["Service", f.service_group, "service_group"]);
    if (f.region && f.region !== "all") active.push(["Region", f.region, "region"]);
    active.forEach(([k, v, key]) => {
      const el = document.createElement("div");
      el.className = "filter-chip";
      el.innerHTML = '<span>' + k + ': ' + v + '</span><button aria-label="Clear ' + k + '">×</button>';
      el.querySelector("button").onclick = () => { state.filters[key] = "all"; renderFilters(); paint(); };
      area.appendChild(el);
    });
  }

  // ---- Window selector ------------------------------------------------
  function setWin(d) {
    state.custom = null;
    state.days = d;
    document.querySelectorAll(".chip").forEach(c => {
      c.setAttribute("aria-pressed", String(Number(c.dataset.win) === d));
    });
    document.getElementById("custom-range").classList.remove("show");
    paint();
  }
  function setCustom() {
    document.querySelectorAll(".chip").forEach(c => c.setAttribute("aria-pressed", "false"));
    document.querySelector('.chip[data-win="custom"]').setAttribute("aria-pressed", "true");
    document.getElementById("custom-range").classList.add("show");
    const end = D.daily[D.daily.length - 1].date;
    const start = D.daily[Math.max(0, D.daily.length - 30)].date;
    const sEl = document.getElementById("custom-start");
    const eEl = document.getElementById("custom-end");
    if (!sEl.value) sEl.value = start;
    if (!eEl.value) eEl.value = end;
    sEl.min = D.daily[0].date; sEl.max = end;
    eEl.min = D.daily[0].date; eEl.max = end;
    state.custom = { startISO: sEl.value, endISO: eEl.value };
    paint();
  }
  document.querySelectorAll(".chip").forEach(c => {
    c.addEventListener("click", () => {
      const w = c.dataset.win;
      if (w === "custom") setCustom();
      else setWin(Number(w));
    });
  });
  document.getElementById("custom-start").addEventListener("change", e => {
    state.custom = { startISO: e.target.value, endISO: document.getElementById("custom-end").value };
    paint();
  });
  document.getElementById("custom-end").addEventListener("change", e => {
    state.custom = { startISO: document.getElementById("custom-start").value, endISO: e.target.value };
    paint();
  });

  // ---- Theme-aware Chart.js defaults --------------------------------
  function readTheme() {
    const styles = getComputedStyle(document.documentElement);
    return {
      ink:        styles.getPropertyValue("--ink").trim(),
      ink_mute:   styles.getPropertyValue("--ink-mute").trim(),
      line:       styles.getPropertyValue("--line").trim(),
      accent:     styles.getPropertyValue("--accent").trim(),
      gold:       styles.getPropertyValue("--gold").trim(),
      ok:         styles.getPropertyValue("--ok").trim(),
      warn:       styles.getPropertyValue("--warn").trim(),
      crit:       styles.getPropertyValue("--crit").trim(),
      paper:      styles.getPropertyValue("--paper").trim()
    };
  }
  function applyChartDefaults() {
    if (typeof Chart === "undefined") return;
    const c = readTheme();
    Chart.defaults.color = c.ink_mute;
    Chart.defaults.borderColor = c.line;
    Chart.defaults.font.family = '"Geist", ui-sans-serif, system-ui, sans-serif';
    Chart.defaults.font.size = 11;
    Chart.defaults.plugins.legend.labels.usePointStyle = true;
    Chart.defaults.plugins.legend.labels.boxHeight = 6;
    Chart.defaults.plugins.legend.labels.padding = 12;
  }

  // ---- Chart constructors ---------------------------------------------
  // Each builder receives (canvas, metricId, rows) and returns a Chart.js instance.
  const CHARTS = {};

  function destroyChart(id) {
    if (CHARTS[id]) { CHARTS[id].destroy(); delete CHARTS[id]; }
  }

  function buildTrendLine(canvas, metricId, rows) {
    const c = readTheme();
    const series = metricSeries(metricId, rows);
    const labels = rows.map(r => r.date);
    const info = METRIC_INFO[metricId];
    return new Chart(canvas, {
      type: "line",
      data: {
        labels: labels,
        datasets: [{
          label: info.name,
          data: series,
          borderColor: c.accent,
          backgroundColor: c.accent + "22",
          tension: 0.35,
          fill: true,
          pointRadius: 0,
          pointHoverRadius: 4,
          borderWidth: 1.6
        }]
      },
      options: chartOpts({ unit: info.unit, isPct: info.fmt === fmtPct })
    });
  }

  function buildBarBy(canvas, metricId, rows, shapeKey, label) {
    const c = readTheme();
    const info = METRIC_INFO[metricId];
    const k = kpisOver(rows);
    let total = k[metricId];
    // For rate/time metrics, plot the rate value across the buckets (slight wobble for realism)
    const isRate = info.fmt !== fmtInt;
    const shape = D.shapes[shapeKey] || [];
    const labels = shape.map(s => s.name);
    let values;
    if (isRate) {
      values = shape.map((s, i) => {
        const wobble = 0.85 + ((i * 7) % 30) / 100;       // deterministic by index
        return Math.max(0, Number((total * wobble).toFixed(1)));
      });
    } else {
      values = shape.map(s => Math.round(total * s.share));
    }
    return new Chart(canvas, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [{
          label: info.name + " · " + label,
          data: values,
          backgroundColor: c.accent + "cc",
          borderColor: c.accent,
          borderWidth: 1,
          borderRadius: 4,
          maxBarThickness: 22
        }]
      },
      options: Object.assign({}, chartOpts({ unit: info.unit, isPct: isRate, horizontal: true }), {
        indexAxis: "y"
      })
    });
  }

  function buildDonut(canvas, metricId, rows, shapeKey, label) {
    const c = readTheme();
    const k = kpisOver(rows);
    const total = (typeof k[metricId] === "number" && !isNaN(k[metricId])) ? k[metricId] : (k.opened || 1);
    const shape = D.shapes[shapeKey] || [];
    const labels = shape.map(s => s.name);
    const values = shape.map(s => Math.round(total * s.share));
    const palette = [c.accent, c.gold, c.warn, c.ok, c.crit, c.ink_mute, c.line];
    return new Chart(canvas, {
      type: "doughnut",
      data: {
        labels: labels,
        datasets: [{
          data: values,
          backgroundColor: labels.map((_, i) => palette[i % palette.length]),
          borderColor: c.paper,
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "62%",
        plugins: {
          legend: { position: "right", labels: { color: c.ink_mute, padding: 10, boxHeight: 6, usePointStyle: true } },
          tooltip: { backgroundColor: c.ink, titleColor: c.paper, bodyColor: c.paper }
        }
      }
    });
  }

  function chartOpts(opts) {
    const c = readTheme();
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
              ticks: {
                color: c.ink_mute, maxRotation: 0, autoSkip: true, maxTicksLimit: 8,
                callback: function (v) { return this.getLabelForValue(v); }
              }
            },
            y: valueAxis
          }
    };
  }

  // ---- Build a chart card per selected metric ------------------------
  // Manifest viz is normalized like "trend_line", "bar_by_team", etc.
  function builderFor(metricId, viz) {
    const v = (viz || "").toLowerCase();
    const info = METRIC_INFO[metricId];
    if (!info) return null;
    if (v.includes("trend"))                    return { kind: "polished", build: (cv, rows) => buildTrendLine(cv, metricId, rows), label: "Trend line" };
    if (v.includes("bar_by_team"))              return { kind: "polished", build: (cv, rows) => buildBarBy(cv, metricId, rows, "by_team", "by team"), label: "Bar · by team" };
    if (v.includes("bar_by_service"))           return { kind: "polished", build: (cv, rows) => buildBarBy(cv, metricId, rows, "by_service", "by service"), label: "Bar · by service" };
    if (v.includes("priority_donut"))           return { kind: "polished", build: (cv, rows) => buildDonut(cv, metricId, rows, "by_priority", "by priority"), label: "Priority distribution" };
    if (v.includes("status_donut"))             return { kind: "polished", build: (cv, rows) => buildDonut(cv, metricId, rows, "by_status", "by status"), label: "Status distribution" };
    if (v.includes("heatmap"))                  return { kind: "stub", fallback: (cv, rows) => buildTrendLine(cv, metricId, rows), label: "Heatmap", note: "Hour-of-day heatmap is refreshing this week — showing the trend line in the meantime." };
    if (v.includes("globe"))                    return { kind: "stub", fallback: (cv, rows) => buildBarBy(cv, metricId, rows, "by_region", "by region"), label: "Globe view", note: "Geographic globe is on the road map — showing the regional breakdown for now." };
    if (v.includes("waterfall"))                return { kind: "stub", fallback: (cv, rows) => buildBarBy(cv, metricId, rows, "by_service", "by service"), label: "Aging waterfall", note: "Aging waterfall is in validation — falling back to a service breakdown." };
    return { kind: "polished", build: (cv, rows) => buildTrendLine(cv, metricId, rows), label: info.vizFallback || "Trend line" };
  }

  // ---- Layout: Single-page or Multi-tab ------------------------------
  const layoutMode = document.documentElement.dataset.layout || "single";
  const selectedMetrics = (M.metrics || []).filter(m => METRIC_INFO[m.id]);

  function renderLayout() {
    const area = document.getElementById("layout-area");
    area.innerHTML = "";
    if (selectedMetrics.length === 0) {
      area.innerHTML = '<div class="stub"><span class="badge">Empty</span><span class="msg">No metrics were selected. Open the builder and pick a few.</span></div>';
      return;
    }
    if (layoutMode === "multi") renderMultiTab(area);
    else                         renderSinglePage(area);
  }

  function renderSinglePage(area) {
    const grid = document.createElement("div");
    grid.className = "grid";
    selectedMetrics.forEach((m, i) => {
      const info = METRIC_INFO[m.id];
      const b = builderFor(m.id, m.viz);
      const card = document.createElement("article");
      card.className = "chart-card";
      if (selectedMetrics.length % 2 === 1 && i === selectedMetrics.length - 1) card.classList.add("span2");
      const cid = "ch_" + m.id;
      let html = ''
        + '<div class="chd">'
        +   '<h3>' + info.name + '</h3>'
        +   '<span class="vt">' + (b ? b.label : "—") + '</span>'
        + '</div>';
      if (b && b.kind === "stub") {
        html += '<div class="stub"><span class="badge">' + b.label + '</span><span class="msg">' + b.note + '</span></div>';
      }
      html += '<div class="body"><canvas id="' + cid + '"></canvas></div>';
      card.innerHTML = html;
      grid.appendChild(card);
    });
    area.appendChild(grid);
  }

  function renderMultiTab(area) {
    const tabs = document.createElement("div");
    tabs.className = "tabs";
    const panels = document.createElement("div");
    selectedMetrics.forEach((m, idx) => {
      const info = METRIC_INFO[m.id];
      const tabBtn = document.createElement("button");
      tabBtn.textContent = info.name;
      tabBtn.dataset.tab = m.id;
      tabBtn.setAttribute("aria-pressed", String(idx === 0));
      tabs.appendChild(tabBtn);

      const b = builderFor(m.id, m.viz);
      const panel = document.createElement("div");
      panel.className = "tab-panel" + (idx === 0 ? " active" : "");
      panel.dataset.panel = m.id;
      const cid = "ch_" + m.id;
      let html = ''
        + '<div class="chart-card">'
        +   '<div class="chd"><h3>' + info.name + '</h3><span class="vt">' + (b ? b.label : "—") + '</span></div>';
      if (b && b.kind === "stub") {
        html += '<div class="stub"><span class="badge">' + b.label + '</span><span class="msg">' + b.note + '</span></div>';
      }
      html += '<div class="body"><canvas id="' + cid + '"></canvas></div></div>';
      html += '<div class="breakdown"><table><thead><tr><th>Bucket</th><th class="num">Value</th><th class="num">Share</th></tr></thead><tbody id="bd_' + m.id + '"></tbody></table></div>';
      panel.innerHTML = html;
      panels.appendChild(panel);
    });
    area.appendChild(tabs);
    area.appendChild(panels);

    tabs.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-tab]");
      if (!btn) return;
      const id = btn.dataset.tab;
      tabs.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.tab === id)));
      panels.querySelectorAll(".tab-panel").forEach(p => p.classList.toggle("active", p.dataset.panel === id));
    });
  }

  function renderBreakdownTables(rows) {
    const k = kpisOver(rows);
    selectedMetrics.forEach(m => {
      const tbody = document.getElementById("bd_" + m.id);
      if (!tbody) return;
      const info = METRIC_INFO[m.id];
      const total = k[m.id];
      const shape = D.shapes.by_service;
      const isRate = info.fmt !== fmtInt;
      tbody.innerHTML = shape.map((s, i) => {
        let v;
        if (isRate) {
          const wobble = 0.85 + ((i * 7) % 30) / 100;
          v = info.fmt(total * wobble);
        } else {
          v = info.fmt(total * s.share);
        }
        return '<tr><td>' + s.name + '</td><td class="num">' + v + '</td><td class="num">' + (s.share * 100).toFixed(1) + '%</td></tr>';
      }).join("");
    });
  }

  // ---- KPI tile rendering --------------------------------------------
  function renderKpis(rows, prevRows) {
    const k = kpisOver(rows);
    const kp = kpisOver(prevRows);
    const host = document.getElementById("kpis");
    host.innerHTML = "";
    selectedMetrics.forEach(m => {
      const info = METRIC_INFO[m.id];
      const v  = k[m.id];
      const pv = kp[m.id];
      let deltaCls = "flat", deltaTxt = "—", deltaSign = "·";
      if (pv != null && !isNaN(pv) && pv !== 0 && v != null && !isNaN(v)) {
        const pct = ((v - pv) / Math.abs(pv)) * 100;
        const direction = pct > 0.5 ? 1 : pct < -0.5 ? -1 : 0;
        const goodIfUp = info.dir;          // +1 higher better, -1 lower better, 0 neutral
        if (direction === 0) { deltaCls = "flat"; }
        else if (goodIfUp === 0) { deltaCls = "flat"; }
        else if ((direction > 0 && goodIfUp > 0) || (direction < 0 && goodIfUp < 0)) deltaCls = "up";
        else deltaCls = "down";
        deltaSign = pct > 0 ? "▲" : pct < 0 ? "▼" : "·";
        deltaTxt  = (pct > 0 ? "+" : "") + pct.toFixed(1) + "%";
      }
      const series = metricSeries(m.id, rows);
      const tile = document.createElement("div");
      tile.className = "kpi";
      tile.innerHTML = ''
        + '<span class="lbl">' + info.name + '</span>'
        + '<span class="val">' + info.fmt(v) + ' <small>' + info.unit + '</small></span>'
        + '<span class="delta ' + deltaCls + '"><span>' + deltaSign + ' ' + deltaTxt + '</span><span class="vs">vs prior</span></span>'
        + '<div class="spark">' + sparkline(series) + '</div>';
      host.appendChild(tile);
    });
  }

  // ---- Master paint --------------------------------------------------
  function paint() {
    applyChartDefaults();
    const rows = windowedRows();
    const prev = priorWindow();
    renderKpis(rows, prev);

    // Destroy any existing charts
    Object.keys(CHARTS).forEach(destroyChart);

    selectedMetrics.forEach(m => {
      const cid = "ch_" + m.id;
      const cv = document.getElementById(cid);
      if (!cv) return;
      const b = builderFor(m.id, m.viz);
      if (!b) return;
      const fn = b.kind === "stub" ? b.fallback : b.build;
      try {
        CHARTS[cid] = fn(cv, rows);
      } catch (err) {
        console.error("Chart build failed for " + m.id, err);
      }
    });

    if (layoutMode === "multi") renderBreakdownTables(rows);
  }

  // ---- Initial mount --------------------------------------------------
  renderFilters();
  renderLayout();

  // Default chip pressed state
  if (state.custom) setCustom();
  else setWin(state.days);

  // First paint also runs after setWin/setCustom; if neither path triggered it (defensive),
  // make sure paint happens on DOMContentLoaded.
  if (!CHARTS || Object.keys(CHARTS).length === 0) paint();
})();
</script>
</body>
</html>`;
  }

  // -------------------- expose to the host page ------------------------
  window.buildReportHtml = buildReportHtml;
  window.reportFilename  = reportFilename;
})();
