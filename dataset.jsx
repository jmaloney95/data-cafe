// Synthetic ITSM dataset — 180 days of seeded daily aggregates.
// Deterministic (no Math.random) so the demo behaves identically each run.
// All values are plausibly Marriott-scale but entirely fictional.

(function () {
  const HORIZON_DAYS = 180;

  // ---- Tiny seeded PRNG (mulberry32) -----------------------------------
  // Stable across reloads. Same seed -> same dataset every time.
  function mulberry32(seed) {
    return function () {
      let t = (seed += 0x6D2B79F5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rand = mulberry32(20260507); // seed = generated date, so it feels intentional

  // ---- Date helpers ----------------------------------------------------
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  function isoDay(d) { return d.toISOString().slice(0, 10); }
  function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }

  // ---- Trend shape -----------------------------------------------------
  // Compose: slow upward drift, weekly seasonality (lower on weekends),
  // a plateau in the middle, plus a tight noise band.
  function trendFactor(i) {
    const days = HORIZON_DAYS;
    const drift = 0.85 + (i / days) * 0.30;            // .85 → 1.15
    const week = (() => {
      const dow = new Date(addDays(today, -(days - 1) + i)).getDay();
      return (dow === 0 || dow === 6) ? 0.62 : 1.0;     // weekends quieter
    })();
    const wobble = 1 + (rand() - 0.5) * 0.12;           // ±6% noise
    const blip = (i === 132 || i === 133) ? 1.45 : 1;   // a small "incident week"
    return drift * week * wobble * blip;
  }

  // ---- Build daily rows -----------------------------------------------
  const daily = [];
  let p1OpenSnap = 1180;       // running snapshot
  let aging7Snap = 31000;      // running snapshot

  for (let i = 0; i < HORIZON_DAYS; i++) {
    const date = addDays(today, -(HORIZON_DAYS - 1 - i));
    const f = trendFactor(i);

    const opened     = Math.round(5400 * f);
    const resolved   = Math.round(opened * (0.92 + (rand() - 0.5) * 0.06));
    const p1_opened  = Math.round(opened * 0.0028 * (1 + (rand() - 0.5) * 0.4));
    const p1_resolved= Math.max(0, Math.round(p1_opened * (0.95 + (rand() - 0.5) * 0.10)));

    p1OpenSnap = Math.max(900, Math.min(1600, p1OpenSnap + p1_opened - p1_resolved));
    aging7Snap = Math.max(28000, Math.min(42000, aging7Snap + Math.round((opened - resolved) * 0.18)));

    const same_day_resolved = Math.round(opened * (0.36 + (rand() - 0.5) * 0.06));
    const reassignments     = Math.round(opened * (0.42 + (rand() - 0.5) * 0.05));
    const reopens           = Math.round(resolved * (0.058 + (rand() - 0.5) * 0.012));

    // MTTR: long-tail-ish; mean ~96h with daily wobble
    const mttr_mean = 96 + (rand() - 0.5) * 14 + Math.sin(i / 14) * 6;
    const mttr_hours_count = resolved;
    const mttr_hours_sum = Math.round(mttr_mean * mttr_hours_count);

    // ---- Cross-domain metrics (Incident FCR + Problem / Change / Outage / Knowledge) ----
    const day = i;
    const horizon = HORIZON_DAYS;
    const dow = new Date(addDays(today, -(horizon - 1) + day)).getDay();
    const weekend = (dow === 0 || dow === 6);

    // Incident — FCR Rate: drifting up from ~55% toward ~63% over the horizon
    const fcr_base = 55 + (day / horizon) * 8;
    const fcr_rate = Math.max(35, Math.min(85,
      fcr_base + Math.sin(day / 12) * 1.8 + (rand() - 0.5) * 3
    ));

    // Problem — MTTC (Mean Time to Cause) ~62-72 days, drifting better
    const mttc_base = 70 - (day / horizon) * 6;
    const mttc = Math.max(40, mttc_base + (rand() - 0.5) * 4);
    // Problem — RCA Lead Time ~24-30 days
    const rca_lead_time = Math.max(10, 27 + Math.sin(day / 18) * 2.5 + (rand() - 0.5) * 3);
    // Problem — Aging > 30 days rate ~26-34%
    const aging_30d_problems = Math.max(15, Math.min(50,
      30 + Math.sin(day / 22) * 3 + (rand() - 0.5) * 4
    ));

    // Change — Success Rate ~91-96%, slight weekend dip from emergency changes
    const csr_base = 93.5 + Math.sin(day / 14) * 1.5 - (weekend ? 1.0 : 0);
    const change_success_rate = Math.max(82, Math.min(99, csr_base + (rand() - 0.5) * 1.5));
    // Change — Major Incident Rate ~2-5%
    const change_major_inc_rate = Math.max(0.5, Math.min(8,
      3.4 + Math.sin(day / 20) * 0.7 + (weekend ? 0.4 : 0) + (rand() - 0.5) * 1.0
    ));
    // Change — Expedited / Emergency % ~7-14%
    const change_expedited = Math.max(2, Math.min(20,
      10 + Math.sin(day / 28) * 2 + (rand() - 0.5) * 2
    ));
    // Change — Standard / Headless % ~65-78%
    const change_standard = Math.max(50, Math.min(88,
      70 + (day / horizon) * 4 + (rand() - 0.5) * 3   // drifting up with maturity
    ));

    // Outage — Downtime per day in days (small numbers most days; occasional spikes)
    const downtime_spike = (day === 70 || day === 132) ? 0.30 : 0;
    const downtime = Math.max(0, 0.06 + downtime_spike + (rand() < 0.85 ? rand() * 0.04 : rand() * 0.20));
    // Outage — MTTD ~0.8-1.6h
    const mttd = Math.max(0.3, 1.2 + Math.sin(day / 16) * 0.25 + (rand() - 0.5) * 0.4);
    // Outage — MTBF ~10-15d
    const mtbf = Math.max(5, 12 + Math.sin(day / 25) * 1.5 + (rand() - 0.5) * 1.5);
    // Outage — P1/P2 outages per day (0 or 1 mostly; occasional 2-3)
    const r0 = rand();
    const p1p2_outages = r0 < 0.60 ? 0 : r0 < 0.90 ? 1 : r0 < 0.98 ? 2 : 3;

    // Knowledge — Resolved w/ Knowledge % ~21-28%
    const kn_resolved = Math.max(12, Math.min(40,
      24 + (day / horizon) * 1.5 + Math.sin(day / 18) * 1.2 + (rand() - 0.5) * 2
    ));
    // Knowledge — Flagged Articles % ~5-9%
    const kn_flagged = Math.max(2, Math.min(15,
      7 - (day / horizon) * 1.0 + (rand() - 0.5) * 1.5     // drifting down with curation
    ));
    // Knowledge — Knowledge Opportunity % ~32-38%
    const kn_opportunity = Math.max(20, Math.min(50,
      35 + Math.sin(day / 20) * 1.5 + (rand() - 0.5) * 2.5
    ));
    // Knowledge — Deflection Rate ~18-26%, drifting upward
    const kn_deflect_base = 18 + (day / horizon) * 8;
    const kn_deflection = Math.max(10, Math.min(40,
      kn_deflect_base + Math.sin(day / 14) * 1.2 + (rand() - 0.5) * 1.8
    ));

    daily.push({
      date: isoDay(date),
      opened,
      resolved,
      p1_opened,
      p1_resolved,
      p1_open_snapshot: p1OpenSnap,
      same_day_resolved,
      reassignments,
      reopens,
      mttr_hours_sum,
      mttr_hours_count,
      aging_7d_snapshot: aging7Snap,
      // ---- Cross-domain (per-day values; kpisOver decides how to aggregate)
      fcr_rate:                  Number(fcr_rate.toFixed(2)),
      mttc:                      Number(mttc.toFixed(2)),
      rca_lead_time:             Number(rca_lead_time.toFixed(2)),
      aging_30d_problems:        Number(aging_30d_problems.toFixed(2)),
      change_success_rate:       Number(change_success_rate.toFixed(2)),
      change_major_inc_rate:     Number(change_major_inc_rate.toFixed(2)),
      change_expedited:          Number(change_expedited.toFixed(2)),
      change_standard:           Number(change_standard.toFixed(2)),
      downtime:                  Number(downtime.toFixed(3)),
      mttd:                      Number(mttd.toFixed(2)),
      mtbf:                      Number(mtbf.toFixed(2)),
      p1p2_outages,
      kn_resolved:               Number(kn_resolved.toFixed(2)),
      kn_flagged:                Number(kn_flagged.toFixed(2)),
      kn_opportunity:            Number(kn_opportunity.toFixed(2)),
      kn_deflection:             Number(kn_deflection.toFixed(2))
    });
  }

  // ---- Breakdown shapes ------------------------------------------------
  // Percentages sum to 1.0 within each shape. The report scales these
  // against windowed totals to produce by-team / by-service charts that
  // feel real without needing per-row tagged data.
  const shapes = {
    by_service: [
      { name: "Reservations Platform",     share: 0.28 },
      { name: "Property Operations",       share: 0.22 },
      { name: "Loyalty Platform",          share: 0.16 },
      { name: "Corporate Systems",         share: 0.12 },
      { name: "Mobile & Digital",          share: 0.10 },
      { name: "Network & Connectivity",    share: 0.07 },
      { name: "Identity & Access",         share: 0.05 }
    ],
    by_team: [
      { name: "Tier-2 Triage",             share: 0.24 },
      { name: "Platform SRE",              share: 0.19 },
      { name: "Network Ops",               share: 0.14 },
      { name: "Property Field Support",    share: 0.13 },
      { name: "Loyalty Engineering",       share: 0.11 },
      { name: "Identity Engineering",      share: 0.09 },
      { name: "Service Desk",              share: 0.10 }
    ],
    by_region: [
      { name: "Americas", share: 0.42 },
      { name: "EMEA",     share: 0.31 },
      { name: "APAC",     share: 0.22 },
      { name: "Other",    share: 0.05 }
    ],
    by_priority: [
      { name: "P1", share: 0.04 },
      { name: "P2", share: 0.18 },
      { name: "P3", share: 0.54 },
      { name: "P4", share: 0.24 }
    ],
    by_status: [
      { name: "Resolved", share: 0.71 },
      { name: "Active",   share: 0.18 },
      { name: "Pending",  share: 0.08 },
      { name: "New",      share: 0.03 }
    ]
  };

  // ---- Aging buckets (snapshot, total open backlog) -------------------
  const aging_buckets = [
    { bucket: "1–3 days",   count: 14820 },
    { bucket: "4–7 days",   count:  9710 },
    { bucket: "8–14 days",  count:  6204 },
    { bucket: "15–30 days", count:  3318 },
    { bucket: "30+ days",   count:  1093 }
  ];

  // ---- Heatmap shape (hour-of-day × day-of-week, normalized 0..1) -----
  // Mon–Fri 9–17 UTC are hottest; weekends quieter; small bump 02–04 UTC
  // reflects APAC primary windows.
  const heatmap = [];
  for (let dow = 0; dow < 7; dow++) {
    for (let h = 0; h < 24; h++) {
      const weekend = (dow === 0 || dow === 6) ? 0.55 : 1.0;
      const business = (h >= 13 && h <= 21) ? 1.0 : 0.45;   // UTC ~9–17 local NA
      const apac = (h >= 2 && h <= 5) ? 0.85 : 0.55;
      const v = Math.min(1, weekend * Math.max(business, apac) * (0.85 + rand() * 0.30));
      heatmap.push({ dow, hour: h, intensity: Number(v.toFixed(3)) });
    }
  }

  // ---- Globe / region detail (lat/lon centroids for SVG-style display) -
  const globe = [
    { region: "Americas", lat:   39.8, lon:  -98.6, share: 0.42 },
    { region: "EMEA",     lat:   50.1, lon:   10.2, share: 0.31 },
    { region: "APAC",     lat:   13.7, lon:  100.5, share: 0.22 },
    { region: "Other",    lat:  -33.9, lon:   18.4, share: 0.05 }
  ];

  window.DUMMY_DATASET = {
    meta: {
      generated: new Date().toISOString(),
      grain: "daily",
      horizon_days: HORIZON_DAYS,
      generator_version: "0.1.0",
      notes: "Synthetic CodeFest dataset. Plausible but not real."
    },
    daily,
    shapes,
    aging_buckets,
    heatmap,
    globe
  };
})();
