// Icons — minimal stroke set, hospitality-feeling

const Icon = ({ name, size = 16, stroke = 1.5, className }) => {
  const s = { width: size, height: size, stroke: "currentColor", fill: "none", strokeWidth: stroke, strokeLinecap: "round", strokeLinejoin: "round" };
  const paths = {
    sparkle: <g><path d="M12 3v6M12 15v6M3 12h6M15 12h6" /><path d="M5 5l3 3M16 16l3 3M5 19l3-3M16 8l3-3" opacity=".55" /></g>,
    arrow:   <path d="M5 12h14M13 6l6 6-6 6" />,
    check:   <path d="M5 12l4 4 10-10" />,
    info:    <g><circle cx="12" cy="12" r="9" /><path d="M12 8v.01M12 12v5" /></g>,
    x:       <path d="M6 6l12 12M18 6l-12 12" />,
    chev:    <path d="M6 9l6 6 6-6" />,
    plus:    <path d="M12 5v14M5 12h14" />,
    minus:   <path d="M5 12h14" />,
    search:  <g><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></g>,
    bell:    <g><path d="M6 8a6 6 0 0112 0c0 7 3 8 3 8H3s3-1 3-8" /><path d="M10 21a2 2 0 004 0" /></g>,
    help:    <g><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 015 .5c0 1.7-2.5 2-2.5 4M12 17.5v.01" /></g>,
    crown:   <g><path d="M3 18h18M4 8l4 4 4-7 4 7 4-4-2 10H6L4 8z" /></g>,
    compass: <g><circle cx="12" cy="12" r="9" /><path d="M15 9l-2 6-4 1 2-6 4-1z" /></g>,
    sunrise: <g><path d="M3 18h18M5 15a7 7 0 0114 0M12 3v3M5 6l2 2M19 6l-2 2" /></g>,
    book:    <g><path d="M5 4h10a3 3 0 013 3v13M5 4v16h12a3 3 0 010-6H8" /></g>,
    magnifier:<g><circle cx="11" cy="11" r="6" /><path d="M20 20l-4.5-4.5M11 9v4M9 11h4" /></g>,
    globe:   <g><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18" /></g>,
    star:    <path d="M12 3l2.5 6 6.5.5-5 4.5 1.5 6.5L12 17l-5.5 3.5L8 14 3 9.5 9.5 9z" />,
    trend:   <g><path d="M3 17l5-5 4 4 8-8" /><path d="M14 8h6v6" /></g>,
    bar:     <g><path d="M5 19V11M10 19V7M15 19V13M20 19V5" /></g>,
    donut:   <g><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /></g>,
    heatmap: <g><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></g>,
    waterfall:<g><path d="M4 6h4v4M10 10h4v4M16 14h4v4" /><path d="M4 19h16" /></g>,
    spark:   <g><path d="M3 14l4-4 3 3 5-7 6 8" /></g>,
    dots:    <g><circle cx="6" cy="12" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="18" cy="12" r="1.2" /></g>,
    send:    <path d="M5 12l15-7-7 15-2-6-6-2z" />,
    bookmark:<path d="M6 4h12v17l-6-4-6 4z" />,
    download:<g><path d="M12 4v12M7 11l5 5 5-5" /><path d="M5 20h14" /></g>,
    refresh: <g><path d="M21 12a9 9 0 11-3-6.7L21 8" /><path d="M21 3v5h-5" /></g>,
    edit:    <g><path d="M14 4l6 6-10 10H4v-6z" /><path d="M13 5l6 6" /></g>,
    copy:    <g><rect x="8" y="8" width="12" height="12" rx="1" /><path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3" /></g>,
    trash:   <g><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /><path d="M10 11v6M14 11v6" /></g>,
    library: <g><path d="M4 5v14M9 5v14M14 5l5 14" /></g>,
  };
  return <svg viewBox="0 0 24 24" {...s} className={className}>{paths[name] || paths.dots}</svg>;
};

// viz-type → icon name
const VIZ_ICON = {
  "Trend line": "trend",
  "Bar by team": "bar",
  "Bar by service": "bar",
  "Status donut": "donut",
  "Priority donut": "donut",
  "Heatmap": "heatmap",
  "Aging waterfall": "waterfall",
  "Globe view": "globe"
};

window.Icon = Icon;
window.VIZ_ICON = VIZ_ICON;

// ─── Data Cafe brand mark ──────────────────────────────────────────────
// A serif "D" wordmark cradling a coffee cup. Steam rises as a tiny
// data trend line. Used in header + carried into the loading animation.
const DataCafeMark = ({ animated = false, size }) => (
  <svg viewBox="0 0 64 64" style={size ? { width: size, height: size } : undefined}>
    {/* Saucer (accent) */}
    <ellipse cx="32" cy="46" rx="15" ry="3" fill="currentColor" opacity=".18" />
    <path d="M18 44 Q32 49 46 44" fill="none" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" />
    {/* Cup body — a stylized D */}
    <path d="M22 26 L22 42 Q22 44 24 44 L38 44 Q42 44 44 40 L44 30 Q44 26 40 26 Z"
          fill="currentColor" />
    {/* Cup handle */}
    <path d="M44 30 Q50 30 50 35 Q50 40 44 40"
          fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    {/* Inner crescent — gives the D-as-cup its ceramic rim */}
    <path d="M25 28 L41 28" stroke="var(--accent)" strokeWidth="1.4" strokeLinecap="round" opacity=".75" />
    {/* Steam — three rising data points connected as a trend line */}
    <g stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" fill="none"
       style={animated ? { animation: "dc-steam 2.4s ease-in-out infinite" } : undefined}>
      <path d="M27 22 Q29 18 27 14 Q25 10 28 6" />
      <path d="M33 22 Q35 18 33 14 Q31 10 34 6" opacity=".75" />
      <path d="M39 22 Q41 18 39 14 Q37 10 40 6" opacity=".55" />
    </g>
  </svg>
);

window.DataCafeMark = DataCafeMark;
