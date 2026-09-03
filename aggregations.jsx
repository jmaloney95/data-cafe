// Shared aggregation logic for both the in-app Dashboard component
// and the standalone HTML export. Pure: no React, no DOM, no globals
// other than what we expose on window.AGG at the bottom.

(function () {
  // ---- Formatters ------------------------------------------------------
  function fmtInt(n) { if (n == null || isNaN(n)) return "—"; return Math.round(n).toLocaleString(); }
  function fmtPct(n) { if (n == null || isNaN(n)) return "—"; return n.toFixed(1) + "%"; }
  function fmtHrs(n) { if (n == null || isNaN(n)) return "—"; return n.toFixed(1) + " hrs"; }
  function fmtDays(n){ if (n == null || isNaN(n)) return "—"; return n.toFixed(1) + " d"; }
  function fmtCnt(n) { if (n == null || isNaN(n)) return "—"; return Math.round(n).toLocaleString(); }

  // ---- Metric catalog --------------------------------------------------
  // dir: +1 = higher is better, -1 = lower is better, 0 = neutral
  const METRIC_INFO = {
    // ---- Incident ----
    opened:   { name: "Opened Incidents",    unit: "tickets", fmt: fmtInt, category: "volume",     dir: 0,  aggregation: "sum"    },
    resolved: { name: "Resolved",            unit: "tickets", fmt: fmtInt, category: "resolution", dir: 1,  aggregation: "sum"    },
    p1:       { name: "P1 Critical (Open)",  unit: "open",    fmt: fmtInt, category: "priority",   dir: -1, aggregation: "snapshot" },
    same_day: { name: "Same Day Resolution", unit: "rate",    fmt: fmtPct, category: "efficiency", dir: 1,  aggregation: "ratio"  },
    reassign: { name: "Reassignment Rate",   unit: "rate",    fmt: fmtPct, category: "routing",    dir: -1, aggregation: "ratio"  },
    reopen:   { name: "Reopen Rate",         unit: "rate",    fmt: fmtPct, category: "quality",    dir: -1, aggregation: "ratio"  },
    mttr:     { name: "Avg. MTTR",           unit: "hours",   fmt: fmtHrs, category: "velocity",   dir: -1, aggregation: "ratio"  },
    aging:    { name: "Aging > 7 Days",      unit: "tickets", fmt: fmtInt, category: "backlog",    dir: -1, aggregation: "snapshot" },
    sla:      { name: "SLA Compliance",      unit: "rate",    fmt: () => "—", category: "compliance", dir: 1, aggregation: "none" },
    fcr_rate: { name: "First Contact Resolution", unit: "rate", fmt: fmtPct, category: "efficiency", dir: 1, aggregation: "average" },

    // ---- Problem ----
    mttc:                  { name: "MTTC",               unit: "days",  fmt: fmtDays, category: "velocity",   dir: -1, aggregation: "average" },
    rca_lead_time:         { name: "RCA Lead Time",      unit: "days",  fmt: fmtDays, category: "discipline", dir: -1, aggregation: "average" },
    aging_30d_problems:    { name: "Aging > 30d Rate",   unit: "rate",  fmt: fmtPct,  category: "backlog",    dir: -1, aggregation: "average" },

    // ---- Change ----
    change_success_rate:   { name: "Change Success Rate",   unit: "rate", fmt: fmtPct, category: "quality", dir:  1, aggregation: "average" },
    change_major_inc_rate: { name: "Major Incident Rate",   unit: "rate", fmt: fmtPct, category: "quality", dir: -1, aggregation: "average" },
    change_expedited:      { name: "Expedited / Emergency %", unit: "rate", fmt: fmtPct, category: "routing", dir: -1, aggregation: "average" },
    change_standard:       { name: "Standard / Headless %",   unit: "rate", fmt: fmtPct, category: "routing", dir:  1, aggregation: "average" },

    // ---- Outage ----
    downtime:     { name: "Downtime",       unit: "days",     fmt: fmtDays, category: "availability", dir: -1, aggregation: "sum"     },
    mttd:         { name: "MTTD",           unit: "hours",    fmt: fmtHrs,  category: "velocity",     dir: -1, aggregation: "average" },
    mtbf:         { name: "MTBF",           unit: "days",     fmt: fmtDays, category: "availability", dir:  1, aggregation: "average" },
    p1p2_outages: { name: "P1/P2 Outages",  unit: "outages",  fmt: fmtCnt,  category: "priority",     dir: -1, aggregation: "sum"     },

    // ---- Knowledge ----
    kn_resolved:    { name: "Resolved w/ Knowledge", unit: "rate", fmt: fmtPct, category: "efficiency",   dir:  1, aggregation: "average" },
    kn_flagged:     { name: "Flagged Articles",      unit: "rate", fmt: fmtPct, category: "quality",      dir: -1, aggregation: "average" },
    kn_opportunity: { name: "Knowledge Opportunity", unit: "rate", fmt: fmtPct, category: "discipline",   dir: -1, aggregation: "average" },
    kn_deflection:  { name: "Knowledge Deflection",  unit: "rate", fmt: fmtPct, category: "self-service", dir:  1, aggregation: "average" }
  };

  // ---- Window helpers --------------------------------------------------
  function parsePresetToDays(value) {
    if (value === "7d") return 7;
    if (value === "30d") return 30;
    if (value === "60d") return 60;
    if (value === "90d") return 90;
    if (value === "custom") return null;
    return 90;
  }

  function windowedRows(daily, days, custom) {
    if (custom && custom.startISO && custom.endISO) {
      return daily.filter(r => r.date >= custom.startISO && r.date <= custom.endISO);
    }
    const d = Math.max(1, Math.min(daily.length, days || 90));
    return daily.slice(daily.length - d);
  }

  function priorWindow(daily, days, custom) {
    if (custom && custom.startISO && custom.endISO) {
      const s = daily.findIndex(r => r.date === custom.startISO);
      const e = daily.findIndex(r => r.date === custom.endISO);
      if (s < 0 || e < 0) return [];
      const len = e - s + 1;
      const ps = Math.max(0, s - len);
      return daily.slice(ps, s);
    }
    const d = days || 90;
    const end = daily.length - d;
    const start = Math.max(0, end - d);
    return daily.slice(start, end);
  }

  // ---- Filters ---------------------------------------------------------
  function filterScalar(filters, shapes) {
    let s = 1;
    if (!filters) return s;
    if (filters.region && filters.region !== "all") {
      const m = (shapes.by_region.find(x => x.name === filters.region) || {}).share;
      if (m) s *= m;
    }
    if (filters.service_group && filters.service_group !== "all") {
      const m = (shapes.by_service.find(x => x.name === filters.service_group) || {}).share;
      if (m) s *= m;
    }
    if (filters.team && filters.team !== "all") {
      const m = (shapes.by_team.find(x => x.name === filters.team) || {}).share;
      if (m) s *= m;
    }
    // Priority: accept either combined ("P1 + P2 only") or single ("P1").
    if (filters.priority === "P1 + P2 only") {
      const p1 = (shapes.by_priority.find(x => x.name === "P1") || {}).share || 0;
      const p2 = (shapes.by_priority.find(x => x.name === "P2") || {}).share || 0;
      s *= (p1 + p2);
    } else if (filters.priority === "P3 + P4 only") {
      const p3 = (shapes.by_priority.find(x => x.name === "P3") || {}).share || 0;
      const p4 = (shapes.by_priority.find(x => x.name === "P4") || {}).share || 0;
      s *= (p3 + p4);
    } else if (filters.priority && /^P[1-4]$/.test(filters.priority)) {
      const m = (shapes.by_priority.find(x => x.name === filters.priority) || {}).share;
      if (m) s *= m;
    }
    return s;
  }

  // ---- KPI block over a windowed slice --------------------------------
  function kpisOver(rows, filters, shapes) {
    if (!rows || rows.length === 0) {
      // Default zero/null record for every known metric.
      const z = {};
      for (const id of Object.keys(METRIC_INFO)) z[id] = id === "sla" ? null : 0;
      z.mttr = NaN; z.mttc = NaN; z.rca_lead_time = NaN; z.mttd = NaN; z.mtbf = NaN;
      return z;
    }
    const last = rows[rows.length - 1];
    const sum = (k) => rows.reduce((a, r) => a + (r[k] || 0), 0);
    const avg = (k) => rows.length > 0 ? sum(k) / rows.length : 0;
    const f = filterScalar(filters, shapes);
    const opened = sum("opened");
    const resolved = sum("resolved");

    const out = {
      // ---- Custom incident metrics (ratios / sums with filterScalar) ----
      opened:   opened * f,
      resolved: resolved * f,
      p1:       last.p1_open_snapshot * f,
      same_day: opened > 0 ? (sum("same_day_resolved") / opened) * 100 : 0,
      reassign: opened > 0 ? (sum("reassignments")     / opened) * 100 : 0,
      reopen:   resolved > 0 ? (sum("reopens")         / resolved) * 100 : 0,
      mttr:     sum("mttr_hours_count") > 0 ? sum("mttr_hours_sum") / sum("mttr_hours_count") : NaN,
      aging:    last.aging_7d_snapshot * f,
      sla:      null
    };

    // ---- Cross-domain metrics: data-driven via METRIC_INFO[id].aggregation ----
    // Any metric whose daily row carries a field with the same id is aggregated
    // here according to its declared aggregation type. Rates ("average") use
    // the simple per-day mean; counts/duration ("sum") accumulate; snapshots
    // pull the last day's value. Filter scalar applies to volume-style sums.
    for (const id of Object.keys(METRIC_INFO)) {
      if (out[id] !== undefined) continue;                  // already computed above
      const info = METRIC_INFO[id];
      if (!rows[0] || rows[0][id] === undefined) continue;  // no daily field for this metric
      switch (info.aggregation) {
        case "sum":      out[id] = sum(id) * (info.dir === 0 ? f : (info.unit === "outages" ? 1 : 1)); break;
        case "average":  out[id] = avg(id); break;
        case "snapshot": out[id] = last[id]; break;
        default:         out[id] = avg(id);
      }
    }
    return out;
  }

  // ---- Per-day series for a single metric -----------------------------
  function metricSeries(metricId, rows) {
    if (!rows || rows.length === 0) return [];
    // Hand-rolled cases for compound incident metrics (computed from multiple fields):
    if (metricId === "opened")   return rows.map(r => r.opened);
    if (metricId === "resolved") return rows.map(r => r.resolved);
    if (metricId === "p1")       return rows.map(r => r.p1_open_snapshot);
    if (metricId === "same_day") return rows.map(r => r.opened   > 0 ? (r.same_day_resolved / r.opened)   * 100 : 0);
    if (metricId === "reassign") return rows.map(r => r.opened   > 0 ? (r.reassignments     / r.opened)   * 100 : 0);
    if (metricId === "reopen")   return rows.map(r => r.resolved > 0 ? (r.reopens           / r.resolved) * 100 : 0);
    if (metricId === "mttr")     return rows.map(r => r.mttr_hours_count > 0 ? r.mttr_hours_sum / r.mttr_hours_count : 0);
    if (metricId === "aging")    return rows.map(r => r.aging_7d_snapshot);
    // Cross-domain metrics: per-day field with the same id.
    if (rows[0] && rows[0][metricId] !== undefined) return rows.map(r => r[metricId]);
    return [];
  }

  // ---- Naming helpers --------------------------------------------------
  const TEMPLATE_NAMES = {
    exec_health: "Executive Health Overview",
    routing:     "Routing Efficiency Audit",
    daily:       "Daily Operational Snapshot",
    quarterly:   "Quarterly Board Briefing",
    deep_dive:   "Full Incident Deep Dive",
    regional:    "Regional Property Performance",
    scorecard:   "Product Health Scorecard"
  };
  function reportTitle(manifest) {
    const tid = manifest && manifest.template_id;
    if (tid && TEMPLATE_NAMES[tid]) return TEMPLATE_NAMES[tid];
    if (manifest && manifest.metrics && manifest.metrics.length) {
      const first = manifest.metrics[0].id;
      if (first === "reassign" || first === "reopen") return "Service Quality Brief";
      if (first === "p1")    return "Critical Incident Watch";
      if (first === "mttr")  return "Velocity & Resolution Brief";
      return "Custom Incident Report";
    }
    return "Custom Report";
  }

  function reportFilename(manifest) {
    const t = (manifest.template_id || "report")
      .replace(/[^a-z0-9_-]/gi, "-").toLowerCase();
    const d = new Date().toISOString().slice(0, 10);
    return `${t}_${d}`;
  }

  // ---- Visualization label normalizer ---------------------------------
  // Maps "Trend line" → "trend_line" etc. (manifest schema)
  function normViz(v) { return (v || "").toString().toLowerCase().replace(/\s+/g, "_"); }

  // ====================================================================
  // SCORING — two-target model (floor + stretch → 0–100)
  // ====================================================================
  // dir: +1 higher-is-better, -1 lower-is-better, 0 neutral (excluded from scoring).
  // floor = the worst value still acceptable (maps to 40 points).
  // stretch = the excellent value (maps to 100 points).
  // Below floor → linear decay to 0. Above stretch → capped at 100.
  // Targets calibrated against the synthetic dataset's central tendency so the
  // demo lands in the mid-band (~60–75) for the default exec view.
  const METRIC_TARGETS = {
    // ---- Incident ----
    opened:   { dir: 0  },                                      // volume context, unscored
    resolved: { dir: 0  },                                      // volume context, unscored
    p1:       { floor: 1500,  stretch: 900,    dir: -1, label: "P1 Critical (open)" },
    same_day: { floor: 30,    stretch: 50,     dir: 1,  label: "Same Day Resolution" },
    reassign: { floor: 50,    stretch: 30,     dir: -1, label: "Reassignment Rate" },
    reopen:   { floor: 8,     stretch: 3,      dir: -1, label: "Reopen Rate" },
    mttr:     { floor: 120,   stretch: 60,     dir: -1, label: "Avg. MTTR" },
    aging:    { floor: 40000, stretch: 20000,  dir: -1, label: "Aging > 7 Days" },
    sla:      { dir: 0  },                                      // not tracked yet
    fcr_rate: { floor: 50,    stretch: 70,     dir:  1, label: "First Contact Resolution" },

    // ---- Problem ----
    mttc:                  { floor: 90,    stretch: 45,    dir: -1, label: "MTTC" },
    rca_lead_time:         { floor: 35,    stretch: 14,    dir: -1, label: "RCA Lead Time" },
    aging_30d_problems:    { floor: 40,    stretch: 15,    dir: -1, label: "Aging > 30d Problems" },

    // ---- Change ----
    change_success_rate:   { floor: 85,    stretch: 97,    dir:  1, label: "Change Success Rate" },
    change_major_inc_rate: { floor:  6,    stretch:  1,    dir: -1, label: "Major Incident Rate" },
    change_expedited:      { floor: 15,    stretch:  5,    dir: -1, label: "Expedited / Emergency" },
    change_standard:       { floor: 55,    stretch: 80,    dir:  1, label: "Standard / Headless" },

    // ---- Outage ----
    downtime:     { floor:  4,   stretch:  1,    dir: -1, label: "Downtime (days)" },
    mttd:         { floor:  3,   stretch:  0.5,  dir: -1, label: "MTTD (hours)" },
    mtbf:         { floor:  6,   stretch: 14,    dir:  1, label: "MTBF (days)" },
    p1p2_outages: { floor: 18,   stretch:  5,    dir: -1, label: "P1/P2 Outages" },

    // ---- Knowledge ----
    kn_resolved:    { floor: 18,  stretch: 35,   dir:  1, label: "Resolved w/ Knowledge" },
    kn_flagged:     { floor: 10,  stretch:  3,   dir: -1, label: "Flagged Articles" },
    kn_opportunity: { floor: 45,  stretch: 25,   dir: -1, label: "Knowledge Opportunity" },
    kn_deflection:  { floor: 15,  stretch: 30,   dir:  1, label: "Knowledge Deflection Rate" }
  };

  // Five-domain Scorecard spec — matches the Product Health Scorecard reference.
  // Domain weights sum to 1.0; KPI weights within each domain are uniform unless
  // specified. Each KPI has either:
  //   - valueFromMetric: pulls a real value out of the kpis aggregator
  //   - syntheticBase + unit: a deterministic mock value (perturbed by a salt)
  // Each KPI carries its own floor/stretch + dir so the scoring math is local.
  const SCORECARD_DOMAINS = {
    Incident: { weight: 0.35, label: "Incident",
      summary: "Resolution speed & rework",
      kpis: [
        { name: "MTTR",              valueFromMetric: "mttr",     unit: "h", floor: 120, stretch: 60,  dir: -1, weight: 0.30 },
        { name: "Reopen Rate",       valueFromMetric: "reopen",   unit: "%", floor: 8,   stretch: 3,   dir: -1, weight: 0.25 },
        { name: "Reassignment Rate", valueFromMetric: "reassign", unit: "%", floor: 50,  stretch: 30,  dir: -1, weight: 0.20 },
        { name: "FCR Rate",          valueFromMetric: "fcr_rate", unit: "%", floor: 50,  stretch: 70,  dir:  1, weight: 0.25 }
      ] },
    Problem: { weight: 0.18, label: "Problem",
      summary: "Root-cause discipline",
      kpis: [
        { name: "MTTC",             valueFromMetric: "mttc",                unit: "d", floor: 90, stretch: 45, dir: -1, weight: 0.40 },
        { name: "RCA Lead Time",    valueFromMetric: "rca_lead_time",       unit: "d", floor: 35, stretch: 14, dir: -1, weight: 0.30 },
        { name: "Aging > 30d Rate", valueFromMetric: "aging_30d_problems",  unit: "%", floor: 40, stretch: 15, dir: -1, weight: 0.30 }
      ] },
    Change: { weight: 0.22, label: "Change",
      summary: "Change success & risk",
      kpis: [
        { name: "Success Rate",        valueFromMetric: "change_success_rate",   unit: "%", floor: 85, stretch: 97, dir:  1, weight: 0.35 },
        { name: "Major Incident Rate", valueFromMetric: "change_major_inc_rate", unit: "%", floor:  6, stretch:  1, dir: -1, weight: 0.25 },
        { name: "Expedited / Emrg",    valueFromMetric: "change_expedited",      unit: "%", floor: 15, stretch:  5, dir: -1, weight: 0.20 },
        { name: "Standard / Headless", valueFromMetric: "change_standard",       unit: "%", floor: 55, stretch: 80, dir:  1, weight: 0.20 }
      ] },
    Outage: { weight: 0.15, label: "Outage",
      summary: "Availability & recovery",
      kpis: [
        { name: "Downtime",      valueFromMetric: "downtime",     unit: "d",  floor:  4, stretch:  1, dir: -1, weight: 0.30 },
        { name: "MTTD",          valueFromMetric: "mttd",         unit: "h",  floor:  3, stretch: 0.5, dir: -1, weight: 0.25 },
        { name: "MTBF",          valueFromMetric: "mtbf",         unit: "d",  floor:  6, stretch: 14, dir:  1, weight: 0.25 },
        { name: "P1/P2 Outages", valueFromMetric: "p1p2_outages", unit: "",   floor: 18, stretch:  5, dir: -1, weight: 0.20 }
      ] },
    Knowledge: { weight: 0.10, label: "Knowledge",
      summary: "Self-service leverage",
      kpis: [
        { name: "Resolved w/ Knowledge", valueFromMetric: "kn_resolved",    unit: "%", floor: 18, stretch: 35, dir:  1, weight: 0.35 },
        { name: "Flagged Articles",      valueFromMetric: "kn_flagged",     unit: "%", floor: 10, stretch:  3, dir: -1, weight: 0.20 },
        { name: "Knowledge Opportunity", valueFromMetric: "kn_opportunity", unit: "%", floor: 45, stretch: 25, dir: -1, weight: 0.20 },
        { name: "Deflection Rate",       valueFromMetric: "kn_deflection",  unit: "%", floor: 15, stretch: 30, dir:  1, weight: 0.25 }
      ] }
  };

  // Format a numeric KPI value with its unit. Percentages are clamped to
  // [0, 100] so synthetic perturbation never produces an impossible value.
  function formatScorecardValue(v, unit) {
    if (v == null || isNaN(v)) return "—";
    if (unit === "%") return Math.max(0, Math.min(100, v)).toFixed(1) + "%";
    if (unit === "h") return Math.max(0, v).toFixed(1) + "h";
    if (unit === "d") return Math.max(0, v).toFixed(1) + "d";
    return Math.round(Math.max(0, v)).toLocaleString();
  }

  // Deterministic perturbation: stable for the same (salt, idx) pair, in [-1, +1].
  function _hash01(salt, idx) {
    const x = Math.sin((salt * 9301 + idx * 49297) % 233280) * 0.5 + 0.5;
    return x;
  }

  // Build the data the ScorecardView renders. salt: any number (e.g., dataRefreshedAt
  // converted to a numeric seed) — different salt → different perturbations →
  // visible movement on a manual refresh. windowDays + filterScalar steer the data
  // to feel window-aware and filter-aware.
  //
  // selectedIds (optional): array/Set of metric IDs the user picked. When provided,
  // only KPIs whose valueFromMetric matches a selected id contribute to that
  // domain. Domains with zero matching KPIs are omitted entirely. This makes the
  // scorecard reflect the user's curation — deselect some KPIs, and the cards
  // (and the overall score) update to use only what remains.
  function buildScorecardData(realKpis, windowDays, filterScalar, salt, selectedIds) {
    salt = (salt | 0) || 0;
    const wf = Math.max(0.6, Math.min(1.0, windowDays / 90));
    const fScalar = filterScalar || 1;
    const selSet = selectedIds
      ? (selectedIds instanceof Set ? selectedIds : new Set(selectedIds))
      : null;
    const out = { domains: {}, overall: { score: 0, weight: 0, prevScore: null } };
    let kIdx = 0;
    for (const [domName, spec] of Object.entries(SCORECARD_DOMAINS)) {
      // Filter this domain's KPIs by the user's selection, if any.
      const domKpis = selSet
        ? spec.kpis.filter(kp => kp.valueFromMetric && selSet.has(kp.valueFromMetric))
        : spec.kpis;
      // Drop the whole domain if the user didn't pick any of its KPIs.
      if (domKpis.length === 0) continue;

      const dom = { name: domName, weight: spec.weight, summary: spec.summary,
                    kpis: [], score: null, scoreWeight: 0, scoreSum: 0 };
      for (const kp of domKpis) {
        kIdx += 1;
        const wob = ( _hash01(salt + 7, kIdx) * 2 - 1 ) * 0.10 * (1 + (1 - wf));
        let value;
        if (kp.valueFromMetric && realKpis[kp.valueFromMetric] != null && !isNaN(realKpis[kp.valueFromMetric])) {
          value = realKpis[kp.valueFromMetric] * (1 + wob * 0.4);
          if (kp.unit === "" || kp.unit === "tickets") value *= fScalar;
        } else if (kp.syntheticBase != null) {
          value = kp.syntheticBase * (1 + wob);
        } else {
          value = null;
        }
        const score = scoreKpi(value, { floor: kp.floor, stretch: kp.stretch, dir: kp.dir });
        const formatted = formatScorecardValue(value, kp.unit);
        dom.kpis.push({
          name: kp.name, value: formatted, score,
          metricId: kp.valueFromMetric || null,
          rawValue: value,
          target: { floor: kp.floor, stretch: kp.stretch, dir: kp.dir }
        });
        if (score != null) {
          dom.scoreSum   += score * (kp.weight || 1);
          dom.scoreWeight += (kp.weight || 1);
        }
      }
      dom.score = dom.scoreWeight > 0 ? Math.round(dom.scoreSum / dom.scoreWeight) : null;
      dom.band  = scoreBand(dom.score);
      out.domains[domName] = dom;
      if (dom.score != null) {
        out.overall.score  += dom.score * spec.weight;
        out.overall.weight += spec.weight;
      }
    }
    out.overall.score = out.overall.weight > 0 ? Math.round(out.overall.score / out.overall.weight) : null;
    out.overall.band  = scoreBand(out.overall.score);
    out.isEmpty = Object.keys(out.domains).length === 0;
    return out;
  }

  function scoreKpi(value, target) {
    if (value == null || isNaN(value)) return null;
    if (!target || !target.dir || target.floor == null || target.stretch == null) return null;
    const { floor, stretch, dir } = target;
    // Normalize so "above stretch" is always good and "below floor" always bad.
    const v = dir > 0 ? value : -value;
    const f = dir > 0 ? floor : -floor;
    const s = dir > 0 ? stretch : -stretch;
    if (v >= s) return 100;
    if (v >= f) {
      // floor → 40, stretch → 100, linear in between
      const t = (v - f) / (s - f);
      return Math.round(40 + t * 60);
    }
    // Below floor: decay linearly from 40 → 0 over a "deficit" of one (s-f) span.
    const deficit = (f - v) / Math.max(1e-6, (s - f));
    return Math.max(0, Math.round(40 - deficit * 40));
  }

  function domainScore(kpiValuesById, domainSpec) {
    let sumScore = 0, sumWeight = 0;
    const breakdown = [];
    for (const k of domainSpec.kpis) {
      const target = METRIC_TARGETS[k.id];
      const value = kpiValuesById[k.id];
      const s = scoreKpi(value, target);
      breakdown.push({ id: k.id, weight: k.weight, value, score: s, target });
      if (s != null) { sumScore += s * k.weight; sumWeight += k.weight; }
    }
    const score = sumWeight > 0 ? Math.round(sumScore / sumWeight) : null;
    return { score, breakdown };
  }

  function overallScore(domainScoresByName, spec) {
    let sumScore = 0, sumWeight = 0;
    for (const name of Object.keys(spec)) {
      const ds = domainScoresByName[name];
      if (ds && ds.score != null) {
        sumScore += ds.score * spec[name].weight;
        sumWeight += spec[name].weight;
      }
    }
    return sumWeight > 0 ? Math.round(sumScore / sumWeight) : null;
  }

  // Health band: maps a 0–100 score to a category + color hint.
  function scoreBand(score) {
    if (score == null)  return { band: "unknown", label: "—",            cls: "band-unknown" };
    if (score >= 70)    return { band: "ok",      label: "On target",    cls: "band-ok"      };
    if (score >= 40)    return { band: "warn",    label: "At risk",      cls: "band-warn"    };
                        return { band: "crit",    label: "Below target", cls: "band-crit"    };
  }

  // ====================================================================
  // INSIGHTS — deterministic, rules-based
  // ====================================================================
  // Returns up to maxCount insights, ordered by importance (critical first).
  // Shape: { kind: "critical"|"strength"|"outlier"|"opportunity",
  //          label: "CRITICAL RISK", html: "...", metricId?: "..." }
  function generateInsights(kpis, prevKpis, manifest, options = {}) {
    const maxCount = options.maxCount || 4;
    // Score language ("Score: 36", "lift the score toward 90+") is specific to
    // the Product Health Scorecard. Every other report gets movement / filter /
    // window-aware takeaways instead, with zero floor/stretch/score vocabulary.
    const useScoreLanguage = options.useScoreLanguage != null
      ? !!options.useScoreLanguage
      : (manifest && manifest.layout === "scorecard");
    return useScoreLanguage
      ? _scoreInsights(kpis, prevKpis, manifest, maxCount)
      : _movementInsights(kpis, prevKpis, manifest, maxCount, options);
  }

  // Percent change helper shared by both insight engines.
  function _deltaPct(cur, prev) {
    if (prev == null || cur == null || prev === 0 || isNaN(prev) || isNaN(cur)) return null;
    return ((cur - prev) / Math.abs(prev)) * 100;
  }

  // ---- Non-scorecard insights: movement, filters, window --------------
  // Deliberately avoids "score", "floor", "stretch", "target", "green". Speaks
  // in terms of what actually moved over the selected window, scoped to the
  // active filters, and points the reader at the drilldown.
  function _movementInsights(kpis, prevKpis, manifest, maxCount, options) {
    const out = [];
    const metricIds = (manifest.metrics || []).map(m => m.id).filter(id => METRIC_INFO[id]);
    const filters = options.filters || {};
    const windowLabel = _windowPhrase(options.windowDays, options.custom);

    // Scope phrase from the active filters (region / service / team / priority).
    const scopeParts = [];
    if (filters.priority      && filters.priority      !== "all") scopeParts.push(filters.priority);
    if (filters.service_group && filters.service_group !== "all") scopeParts.push(filters.service_group);
    if (filters.team          && filters.team          !== "all") scopeParts.push(filters.team);
    if (filters.region        && filters.region        !== "all") scopeParts.push(filters.region);
    const scopePhrase = scopeParts.length ? scopeParts.join(" · ") : null;
    const scopeTail = scopePhrase ? ` <em>(${scopePhrase})</em>` : "";

    // Rank metrics by absolute movement vs the prior window.
    const movers = metricIds.map(id => {
      const info = METRIC_INFO[id];
      const cur = kpis[id], prev = prevKpis[id];
      const pct = _deltaPct(cur, prev);
      if (pct == null) return null;
      const dir = info.dir || 0;
      const isBad  = (dir > 0 && pct < 0) || (dir < 0 && pct > 0);
      const isGood = (dir > 0 && pct > 0) || (dir < 0 && pct < 0);
      return { id, info, cur, prev, pct, abs: Math.abs(pct), isBad, isGood, dir };
    }).filter(m => m && m.abs >= 8).sort((a, b) => b.abs - a.abs);

    for (const m of movers.slice(0, 3)) {
      const arrow = m.pct > 0 ? "▲" : "▼";
      const mag = `${arrow} ${m.pct > 0 ? "+" : ""}${m.pct.toFixed(1)}%`;
      if (m.dir === 0) {
        out.push({ kind: "outlier", label: "VOLUME SHIFT", metricId: m.id,
          html: `<strong>${m.info.name}</strong> moved <em>${mag}</em> ${windowLabel}${scopeTail} — now ${m.info.fmt(m.cur)} versus ${m.info.fmt(m.prev)} the window before.` });
      } else if (m.isBad) {
        out.push({ kind: "critical", label: "NEEDS ATTENTION", metricId: m.id,
          html: `<strong>${m.info.name}</strong> is heading the wrong way — <em>${mag}</em> ${windowLabel}${scopeTail}, now ${m.info.fmt(m.cur)} (was ${m.info.fmt(m.prev)}). Worth a focused look.` });
      } else {
        out.push({ kind: "strength", label: "IMPROVING", metricId: m.id,
          html: `<strong>${m.info.name}</strong> improved <em>${mag}</em> ${windowLabel}${scopeTail}, now ${m.info.fmt(m.cur)} (was ${m.info.fmt(m.prev)}). Keep the momentum.` });
      }
    }

    // If little moved, surface the largest-magnitude metric as context so the
    // panel is never empty or generic.
    if (out.length === 0) {
      const ranked = metricIds
        .map(id => ({ id, info: METRIC_INFO[id], v: kpis[id] }))
        .filter(x => x.v != null && !isNaN(x.v) && x.info.fmt === fmtInt)
        .sort((a, b) => b.v - a.v);
      if (ranked[0]) {
        out.push({ kind: "outlier", label: "STEADY", metricId: ranked[0].id,
          html: `Nothing swung sharply ${windowLabel}${scopeTail}. <strong>${ranked[0].info.name}</strong> leads the volume at ${ranked[0].info.fmt(ranked[0].v)} and is tracking close to the prior window.` });
      } else {
        out.push({ kind: "outlier", label: "STEADY", metricId: metricIds[0],
          html: `Metrics are holding close to the prior window ${windowLabel}${scopeTail}. No swing crossed the 8% notability line.` });
      }
    }

    // Filter-awareness nudge.
    if (scopePhrase) {
      out.push({ kind: "opportunity", label: "SCOPE", metricId: null,
        html: `These figures are scoped to <em>${scopePhrase}</em>. Clear the filters to compare against the all-up baseline, or change one to isolate a different slice.` });
    } else {
      out.push({ kind: "opportunity", label: "EXPLORE", metricId: null,
        html: `This is the all-up view ${windowLabel}. Apply a region, service, or team filter to localize a trend — or <strong>click any KPI</strong> to drill into its contributing products and underlying records.` });
    }

    return out.slice(0, maxCount);
  }

  // Human window phrase: "over the last 30 days" or "from May 2 to Jun 1".
  function _windowPhrase(days, custom) {
    if (custom && custom.startISO && custom.endISO) {
      return `from ${_shortDate(custom.startISO)} to ${_shortDate(custom.endISO)}`;
    }
    return `over the last ${days || 90} days`;
  }
  function _shortDate(iso) {
    try {
      const d = new Date(iso + "T00:00:00");
      if (isNaN(d.getTime())) return iso;
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    } catch (e) { return iso; }
  }

  // ---- Scorecard insights: the original floor/stretch/score engine -----
  function _scoreInsights(kpis, prevKpis, manifest, maxCount) {
    const useScoreLanguage = true;
    const out = [];
    const metricIds = (manifest.metrics || []).map(m => m.id);

    // Helper: render a percent with sign for delta phrasing
    const fmtDeltaPct = _deltaPct;
    const unitSuffix = (info) => info.fmt === fmtPct ? "%" : info.fmt === fmtHrs ? " hrs" : "";

    // --- Critical & Strength: floor / stretch breaches on selected metrics ---
    for (const id of metricIds) {
      const target = METRIC_TARGETS[id];
      if (!target || !target.dir) continue;
      const value = kpis[id];
      if (value == null || isNaN(value)) continue;
      const score = scoreKpi(value, target);
      if (score == null) continue;
      const info = METRIC_INFO[id];
      const u = unitSuffix(info);

      if (score < 40) {
        const tail = useScoreLanguage ? ` Score: <strong>${score}</strong>.` : "";
        out.push({
          kind: "critical", label: "CRITICAL RISK", metricId: id, score,
          html: `<strong>${info.name}</strong> sits at <em>${info.fmt(value)}</em> — past the ${target.dir > 0 ? "minimum" : "maximum"} acceptable target of <strong>${target.floor}${u}</strong>.${tail}`
        });
      } else if (score >= 90) {
        const tail = useScoreLanguage ? ` Score: <strong>${score}</strong>.` : "";
        out.push({
          kind: "strength", label: "STRENGTH", metricId: id, score,
          html: `<strong>${info.name}</strong> is performing strongly at <em>${info.fmt(value)}</em> — at or beyond the stretch target of <strong>${target.stretch}${u}</strong>.${tail}`
        });
      }
    }

    // --- Outliers: large window-over-window swings ---
    for (const id of metricIds) {
      const info = METRIC_INFO[id];
      const target = METRIC_TARGETS[id];
      if (!info) continue;
      const cur = kpis[id], prev = prevKpis[id];
      const pct = fmtDeltaPct(cur, prev);
      if (pct == null) continue;
      if (Math.abs(pct) < 15) continue;
      const dir = target ? target.dir : 0;
      const isBad = (dir > 0 && pct < 0) || (dir < 0 && pct > 0);
      const arrow = pct > 0 ? "▲" : "▼";
      const phrase = `${arrow} ${pct > 0 ? "+" : ""}${pct.toFixed(1)}% vs prior window`;
      out.push({
        kind: "outlier", label: "OUTLIER", metricId: id,
        html: `<strong>${info.name}</strong> swung <em>${phrase}</em>, now at ${info.fmt(cur)} (was ${info.fmt(prev)}). ${isBad ? "Worth a focused look." : "A welcome shift."}`
      });
    }

    // --- Opportunity: within striking distance of stretch ---
    for (const id of metricIds) {
      const target = METRIC_TARGETS[id];
      if (!target || !target.dir) continue;
      const value = kpis[id];
      if (value == null || isNaN(value)) continue;
      const score = scoreKpi(value, target);
      if (score == null) continue;
      const info = METRIC_INFO[id];
      const u = unitSuffix(info);
      if (score >= 60 && score < 85) {
        const gap = target.dir > 0 ? (target.stretch - value) : (value - target.stretch);
        const stretchPhrase = `<strong>${target.stretch}${u}</strong>`;
        const html = useScoreLanguage
          ? `<strong>${info.name}</strong> sits at <em>${info.fmt(value)}</em> — a focused push could close the <em>${gap.toFixed(1)}${u || "-point"}</em> gap to the stretch target and lift the score from <strong>${score}</strong> toward <strong>90+</strong>.`
          : `<strong>${info.name}</strong> sits at <em>${info.fmt(value)}</em> — closing the <em>${gap.toFixed(1)}${u || "-point"}</em> gap to the stretch target of ${stretchPhrase} would put it firmly in the green.`;
        out.push({
          kind: "opportunity", label: "OPPORTUNITY", metricId: id, score, html
        });
      }
    }

    const order = { critical: 0, outlier: 1, strength: 2, opportunity: 3 };
    out.sort((a, b) => (order[a.kind] - order[b.kind]));
    return out.slice(0, maxCount);
  }

  // ====================================================================
  // DRILLDOWN SUPPORT — per-metric history, contributing products,
  // recommended actions, and synthetic row-level records.
  // ====================================================================

  // Which ITSM domain each metric belongs to (self-contained; the standalone
  // HTML export doesn't load data.jsx, so we don't lean on window.METRICS).
  const DOMAIN_OF = {
    opened: "incident", resolved: "incident", p1: "incident", same_day: "incident",
    reassign: "incident", reopen: "incident", mttr: "incident", aging: "incident",
    sla: "incident", fcr_rate: "incident",
    mttc: "problem", rca_lead_time: "problem", aging_30d_problems: "problem",
    change_success_rate: "change", change_major_inc_rate: "change",
    change_expedited: "change", change_standard: "change",
    downtime: "outage", mttd: "outage", mtbf: "outage", p1p2_outages: "outage",
    kn_resolved: "knowledge", kn_flagged: "knowledge",
    kn_opportunity: "knowledge", kn_deflection: "knowledge"
  };

  // Stable service → owner mapping so contributing-product tables name a person.
  const SERVICE_OWNERS = {
    "Reservations Platform":  "Sarah Chen",
    "Property Operations":    "Marcus Webb",
    "Loyalty Platform":       "Daniel Okafor",
    "Corporate Systems":      "Priya Anand",
    "Mobile & Digital":       "Daniel Okafor",
    "Network & Connectivity": "Priya Anand",
    "Identity & Access":      "Marcus Webb"
  };

  // ---- Local deterministic PRNG (independent of dataset.jsx) -----------
  function _mulberry32(seed) {
    return function () {
      let t = (seed += 0x6D2B79F5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function _seedFrom(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function _sampleShare(shape, r) {
    let acc = 0;
    for (const s of shape) { acc += s.share; if (r <= acc) return s.name; }
    return shape[shape.length - 1].name;
  }
  function _addDaysISO(iso, n) {
    const d = new Date(iso + "T00:00:00");
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  }
  function _isPctMetric(info) { return info && info.fmt === fmtPct; }
  function _isCountMetric(info) {
    return info && (info.aggregation === "sum" || info.aggregation === "snapshot") && info.fmt !== fmtPct;
  }

  // ---- 6-window score (or value) history ------------------------------
  // A long-run trend: splits the whole dataset into `points` equal segments
  // (≈ one month each over 180 days) so the chart is always populated and
  // independent of the currently selected window. Filters still apply.
  // Returns [{ endISO, value, score }] oldest→newest.
  function scoreHistorySeries(metricId, daily, days, custom, filters, shapes, points) {
    points = points || 6;
    const target = METRIC_TARGETS[metricId];
    const n = daily.length;
    if (n === 0) return [];
    const L = Math.max(7, Math.floor(n / points));
    const out = [];
    for (let p = points - 1; p >= 0; p--) {
      const winEnd = n - 1 - p * L;
      const winStart = winEnd - L + 1;
      if (winStart < 0 || winEnd < 0) continue;
      const slice = daily.slice(winStart, winEnd + 1);
      if (!slice.length) continue;
      const k = kpisOver(slice, filters, shapes);
      const v = k[metricId];
      out.push({ endISO: daily[winEnd].date, value: v, score: target ? scoreKpi(v, target) : null });
    }
    return out;
  }

  // ---- Contributing products (worst-first) ----------------------------
  // Deterministic per-service breakdown of a single metric. Rate/duration
  // metrics are spread around the overall value; count metrics split by share.
  function contributingProducts(metricId, kpis, shapes, filters) {
    const info = METRIC_INFO[metricId];
    const target = METRIC_TARGETS[metricId];
    const overall = kpis[metricId];
    const services = (shapes && shapes.by_service) || [];
    const countish = _isCountMetric(info);
    const rng = _mulberry32(_seedFrom("cp_" + metricId));
    const rows = services.map(svc => {
      let value;
      if (overall == null || isNaN(overall)) value = NaN;
      else if (countish)                     value = overall * svc.share;
      else                                   value = overall * (0.8 + rng() * 0.45); // ±~25%, stable
      const score = target ? scoreKpi(value, target) : null;
      return {
        product: svc.name,
        owner: SERVICE_OWNERS[svc.name] || "—",
        value,
        score,
        actual: info ? info.fmt(value) : String(value)
      };
    });
    rows.sort((a, b) => {
      if (a.score != null && b.score != null) return a.score - b.score; // worst score first
      return (b.value || 0) - (a.value || 0);                            // else biggest contributor first
    });
    return rows;
  }

  // ---- Recommended actions per metric ---------------------------------
  function recommendedActionsFor(metricId, value, score, target, worstProduct) {
    const info = METRIC_INFO[metricId];
    const dom = DOMAIN_OF[metricId] || "incident";
    const name = info ? info.name : metricId;
    const stretch = target && target.stretch != null ? target.stretch : null;
    const wp = worstProduct || "the lowest-ranked service";
    const u = info && info.fmt === fmtPct ? "%" : "";
    const acts = [];
    const byDomain = {
      incident: [
        { title: "Target the laggards", detail: `Open a focused review with ${wp} — it sits furthest from the ${stretch != null ? stretch + u + " " : ""}stretch on ${name}.` },
        { title: "Routing & ownership audit", detail: `Sample 30 days of ${name} outliers and confirm tickets are landing on the right team on first assignment.` },
        { title: "Knowledge & automation", detail: `Convert the top 3 recurring patterns behind ${name} into runbooks or auto-resolution rules.` }
      ],
      problem: [
        { title: "Tighten RCA cadence", detail: `Set a weekly checkpoint on aged problem records and pull ${wp} into the first session.` },
        { title: "Root-cause sampling", detail: `Pull a 30-day sample of ${name} outliers and look for shared upstream causes across services.` },
        { title: "Close the loop", detail: `Link confirmed root causes to changes and known-error articles so recurrence is prevented, not just resolved.` }
      ],
      change: [
        { title: "Strengthen change gates", detail: `Review ${wp}'s change pipeline — its ${name} is dragging the composite.` },
        { title: "Pre-deploy verification", detail: `Add automated smoke checks to high-risk change types to lift ${name} toward ${stretch != null ? stretch + u : "target"}.` },
        { title: "Expand standard templates", detail: `Move repeatable changes onto pre-approved templates to cut emergency/expedited volume.` }
      ],
      outage: [
        { title: "Detection coverage", detail: `Extend synthetic monitoring on ${wp} — faster detection is the biggest lever on ${name}.` },
        { title: "Postmortem actions", detail: `Track that recovery actions from the last 5 outages actually shipped, not just got logged.` },
        { title: "Resilience review", detail: `Identify single points of failure on the worst-performing services and schedule mitigations.` }
      ],
      knowledge: [
        { title: "Curate the gaps", detail: `Prioritize article creation for ${wp} where ${name} is weakest.` },
        { title: "Link-in-the-moment", detail: `Coach agents to attach knowledge during resolution so ${name} reflects real KB-led work.` },
        { title: "Deflection funnel", detail: `Surface top self-service search misses and fill them to lift deflection.` }
      ]
    };
    (byDomain[dom] || byDomain.incident).forEach(a => acts.push(a));
    return acts;
  }

  // ---- Synthetic row-level records ------------------------------------
  // The dataset is daily aggregates; this fabricates plausible, deterministic
  // ticket/record rows that reconcile with the displayed metric. Returns a
  // descriptor the drilldown table renders directly.
  function synthesizeTickets(metricId, daily, days, custom, filters, shapes, limit) {
    limit = limit || 60;
    const info = METRIC_INFO[metricId];
    const dom = DOMAIN_OF[metricId] || "incident";
    const rows = windowedRows(daily, days, custom);
    if (!rows.length) return { idPrefix: "REC", total: 0, shown: 0, columns: [], records: [] };
    const kpis = kpisOver(rows, filters, shapes);
    const fScalar = filterScalar(filters, shapes);
    const sum = (k) => rows.reduce((a, r) => a + (r[k] || 0), 0);

    // Total contributing population.
    let total;
    switch (metricId) {
      case "opened":   total = Math.round(sum("opened") * fScalar); break;
      case "resolved": total = Math.round(sum("resolved") * fScalar); break;
      case "mttr":     total = Math.round(sum("mttr_hours_count") * fScalar); break;
      case "same_day":
      case "reassign": total = Math.round(sum("opened") * fScalar); break;
      case "reopen":
      case "fcr_rate": total = Math.round(sum("resolved") * fScalar); break;
      case "p1":       total = Math.round((rows[rows.length - 1].p1_open_snapshot || 0) * fScalar); break;
      case "aging":    total = Math.round((rows[rows.length - 1].aging_7d_snapshot || 0) * fScalar); break;
      case "p1p2_outages": total = Math.max(1, Math.round(sum("p1p2_outages"))); break;
      case "downtime":     total = Math.max(1, Math.round(sum("p1p2_outages") + rows.length * 0.4)); break;
      default:
        // problem / change / knowledge rate metrics: a plausible record population
        total = Math.max(rows.length, Math.round(sum("opened") * 0.02 * fScalar));
    }
    if (!total || isNaN(total) || total < 0) total = rows.length;
    const shown = Math.min(limit, total);

    const idPrefix = dom === "problem" ? "PRB" : dom === "change" ? "CHG"
                   : dom === "outage" ? "OUT" : dom === "knowledge" ? "KB" : "INC";
    const rng = _mulberry32(_seedFrom("tk_" + metricId + "_" + rows[0].date + "_" + rows.length));

    // Forced dimension values from active single-value filters.
    const forced = {
      region:   (filters.region && filters.region !== "all") ? filters.region : null,
      service:  (filters.service_group && filters.service_group !== "all") ? filters.service_group : null,
      team:     (filters.team && filters.team !== "all") ? filters.team : null,
      priority: (filters.priority && /^P[1-4]$/.test(filters.priority)) ? filters.priority : null
    };
    const startISO = rows[0].date, spanDays = rows.length;
    const pad = (n, w) => String(n).padStart(w, "0");
    const csr = kpis.change_success_rate != null && !isNaN(kpis.change_success_rate) ? kpis.change_success_rate : 93;

    const records = [];
    for (let i = 0; i < shown; i++) {
      const dayOff = Math.floor(rng() * spanDays);
      const openedISO = _addDaysISO(startISO, dayOff);
      const region   = forced.region   || _sampleShare(shapes.by_region, rng());
      const service  = forced.service  || _sampleShare(shapes.by_service, rng());
      const team     = forced.team     || _sampleShare(shapes.by_team, rng());
      const priority = forced.priority || _sampleShare(shapes.by_priority, rng());
      const id = idPrefix + "-" + pad(100000 + Math.floor(rng() * 899999), 6);
      const base = { id, openedISO, region, service, team, priority };

      if (dom === "incident") {
        const mttrCenter = (kpis.mttr != null && !isNaN(kpis.mttr)) ? kpis.mttr : 96;
        const hrs = Math.max(0.5, mttrCenter * (0.35 + rng() * 1.5));
        const resolvedISO = _addDaysISO(openedISO, Math.max(0, Math.round(hrs / 24)));
        base.resolvedISO = (metricId === "opened" || metricId === "p1" || metricId === "aging") ? "—" : resolvedISO;
        base.hrs = hrs;
        base.ageDays = Math.max(1, Math.round((spanDays - dayOff) + rng() * 6));
        base.reopened = rng() < ((kpis.reopen || 6) / 100) ? "Yes" : "No";
        base.sameDay = rng() < ((kpis.same_day || 38) / 100) ? "Yes" : "No";
        base.firstContact = rng() < ((kpis.fcr_rate || 58) / 100) ? "Yes" : "No";
        base.reassigns = rng() < ((kpis.reassign || 42) / 100) ? (1 + Math.floor(rng() * 3)) : 0;
      } else if (dom === "problem") {
        const causeDays = Math.max(2, (kpis.mttc || 65) * (0.5 + rng()));
        const rcaDays = Math.max(1, (kpis.rca_lead_time || 27) * (0.5 + rng()));
        base.causeISO = _addDaysISO(openedISO, Math.round(causeDays));
        base.rcaISO = _addDaysISO(base.causeISO, Math.round(rcaDays));
        base.ageDays = Math.round(causeDays + rcaDays);
        base.causeDays = Math.round(causeDays);
        base.rcaDays = Math.round(rcaDays);
      } else if (dom === "change") {
        const types = ["Standard", "Normal", "Normal", "Expedited", "Emergency"];
        base.ctype = types[Math.floor(rng() * types.length)];
        base.outcome = rng() < (csr / 100) ? "Successful" : (rng() < 0.6 ? "Rolled back" : "Failed");
        base.risk = base.ctype === "Emergency" ? "High" : (rng() < 0.3 ? "Medium" : "Low");
      } else if (dom === "outage") {
        const sev = ["P1", "P2", "P2", "P3"];
        base.severity = sev[Math.floor(rng() * sev.length)];
        const dh = Math.max(0.1, (kpis.mttd || 1.2) + rng() * 4);
        base.detectedISO = openedISO;
        base.downHrs = dh;
      } else { // knowledge
        base.linked = rng() < ((kpis.kn_resolved || 24) / 100) ? "Yes" : "No";
        base.deflected = rng() < ((kpis.kn_deflection || 22) / 100) ? "Yes" : "No";
        base.flagged = rng() < ((kpis.kn_flagged || 6) / 100) ? "Yes" : "No";
        base.article = "KB" + pad(1000 + Math.floor(rng() * 8999), 4);
      }
      records.push(base);
    }

    // Column spec by domain + the metric-specific value column.
    const cols = [];
    const C = (key, label, align) => cols.push({ key, label, align: align || "left" });
    if (dom === "incident") {
      C("id", idPrefix + " ID"); C("openedISO", "Opened");
      if (metricId !== "opened" && metricId !== "p1" && metricId !== "aging") C("resolvedISO", "Resolved");
      C("priority", "Priority"); C("service", "Service"); C("region", "Region");
      if (metricId === "mttr")           C("hrs", "Resolve hrs", "right");
      else if (metricId === "aging" || metricId === "p1") C("ageDays", "Age (d)", "right");
      else if (metricId === "reopen")    C("reopened", "Reopened", "right");
      else if (metricId === "same_day")  C("sameDay", "Same-day", "right");
      else if (metricId === "fcr_rate")  C("firstContact", "1st contact", "right");
      else if (metricId === "reassign")  C("reassigns", "Reassigns", "right");
    } else if (dom === "problem") {
      C("id", "PRB ID"); C("openedISO", "Opened"); C("causeISO", "Cause ID'd"); C("rcaISO", "RCA");
      C("service", "Service");
      if (metricId === "mttc") C("causeDays", "Cause (d)", "right");
      else if (metricId === "rca_lead_time") C("rcaDays", "RCA (d)", "right");
      else C("ageDays", "Age (d)", "right");
    } else if (dom === "change") {
      C("id", "CHG ID"); C("openedISO", "Submitted"); C("ctype", "Type");
      C("outcome", "Outcome"); C("service", "Service"); C("risk", "Risk", "right");
    } else if (dom === "outage") {
      C("id", "OUT ID"); C("openedISO", "Started"); C("severity", "Severity");
      C("service", "Service"); C("region", "Region"); C("downHrs", "Downtime hrs", "right");
    } else {
      C("id", "INC ID"); C("openedISO", "Date"); C("service", "Service"); C("article", "Article");
      if (metricId === "kn_deflection")      C("deflected", "Deflected", "right");
      else if (metricId === "kn_flagged")    C("flagged", "Flagged", "right");
      else                                   C("linked", "KB linked", "right");
    }

    return { idPrefix, domain: dom, total, shown, columns: cols, records };
  }

  // ---- CSV export of the full contributing-record set -----------------
  function _csvCell(v) {
    if (v == null) return "";
    const s = String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  // Generates EVERY contributing record (not just the on-screen sample) and
  // serializes to CSV. The sample shown in the drilldown is a prefix of this
  // set (same seed), so the download is a faithful superset. A high runaway
  // cap guards against pathological sizes; for this dataset it never bites.
  function ticketsToCSV(metricId, daily, days, custom, filters, shapes, maxRows) {
    const cap = maxRows || 500000;
    const full = synthesizeTickets(metricId, daily, days, custom, filters, shapes, cap);
    const cols = full.columns;
    const header = cols.map(c => _csvCell(c.label)).join(",");
    const lines = new Array(full.records.length);
    for (let i = 0; i < full.records.length; i++) {
      const rec = full.records[i];
      lines[i] = cols.map(c => {
        const val = rec[c.key];
        if (val == null) return "";
        if (c.key === "hrs" || c.key === "downHrs") return _csvCell(Number(val).toFixed(1));
        return _csvCell(val);     // ISO dates stay full YYYY-MM-DD for spreadsheets
      }).join(",");
    }
    const csv = header + "\n" + lines.join("\n") + "\n";
    const info = METRIC_INFO[metricId];
    const slug = (info ? info.name : metricId).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    return {
      csv,
      rows: full.records.length,
      total: full.total,
      capped: full.total > full.records.length,
      filename: slug + "_contributing_records.csv"
    };
  }

  // ---- Expose ---------------------------------------------------------
  window.AGG = {
    METRIC_INFO,
    fmtInt, fmtPct, fmtHrs,
    parsePresetToDays,
    windowedRows, priorWindow,
    filterScalar, kpisOver, metricSeries,
    reportTitle, reportFilename, normViz,
    TEMPLATE_NAMES,
    // Scoring
    METRIC_TARGETS,
    scoreKpi, domainScore, overallScore, scoreBand,
    // Five-domain Product Health Scorecard
    SCORECARD_DOMAINS, buildScorecardData, formatScorecardValue,
    // Insights
    generateInsights,
    // Drilldown support
    DOMAIN_OF, SERVICE_OWNERS,
    scoreHistorySeries, contributingProducts, recommendedActionsFor, synthesizeTickets, ticketsToCSV
  };
})();
