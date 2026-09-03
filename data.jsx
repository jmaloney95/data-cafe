// Data: metrics, templates, personas

const METRICS = [
  { id: "opened",      domain: "incident", category: "volume",     name: "Opened Incidents",       value: "492,734",  unit: "tickets", desc: "Every new incident logged in the period — your top-of-funnel volume.",
    vizOptions: ["Trend line", "Status donut", "Heatmap"], defaultViz: "Trend line",
    nutrition: { source: "fact_incident", column: "incident_id", calc: "COUNT(DISTINCT incident_id) WHERE created_at BETWEEN $start AND $end", filters: "Excludes test tickets (created_by LIKE 'test_%') and synthetic monitoring noise.", refresh: "Hourly", caveat: "Includes minor self-resolved tickets — combine with Resolved % for true workload pressure." } },
  { id: "resolved",    domain: "incident", category: "resolution", name: "Resolved",               value: "457,589",  unit: "tickets", desc: "Incidents that reached a terminal resolved state in-window.",
    vizOptions: ["Trend line", "Status donut", "Heatmap"], defaultViz: "Trend line",
    nutrition: { source: "fact_incident", column: "resolved_at, state", calc: "COUNT(*) WHERE state = 'Resolved' AND resolved_at BETWEEN $start AND $end", filters: "Counts the most recent resolution event only; reopens are tracked separately.", refresh: "Hourly", caveat: "Resolution timestamp is set when state changes, not when the customer confirms." } },
  { id: "p1",          domain: "incident", category: "priority",   name: "P1 Critical (Open)",     value: "1,344",    unit: "open", desc: "Highest-severity tickets currently active. Watch this number daily.",
    vizOptions: ["Trend line", "Priority donut", "Globe view"], defaultViz: "Trend line",
    nutrition: { source: "fact_incident", column: "priority, state", calc: "COUNT(*) WHERE priority = 1 AND state IN ('New','Active','Pending')", filters: "Live snapshot — not bound to the time window.", refresh: "Every 5 minutes", caveat: "Major-incident bridges may briefly spike P1 counts during incident triage." } },
  { id: "same_day",    domain: "incident", category: "efficiency", name: "Same Day Resolution",    value: "38.0%",    unit: "rate", desc: "Share of incidents resolved within 24 hours of being opened.",
    vizOptions: ["Bar by team", "Bar by service", "Trend line"], defaultViz: "Bar by service",
    nutrition: { source: "fact_incident", column: "created_at, resolved_at", calc: "COUNT(WHERE resolved_at - created_at ≤ 24h) / COUNT(*)", filters: "Calendar hours, not business hours. Excludes incidents still open at period close.", refresh: "Hourly", caveat: "Cross-timezone tickets may inflate this slightly during DST transitions." } },
  { id: "reassign",    domain: "incident", category: "routing",    name: "Reassignment Rate",      value: "42.7%",    unit: "rate", desc: "Tickets that bounced between teams before resolution. A routing health canary.",
    vizOptions: ["Bar by team", "Bar by service", "Trend line"], defaultViz: "Bar by team",
    nutrition: { source: "fact_assignment", column: "incident_id, assignment_count", calc: "COUNT(DISTINCT incident_id WHERE assignment_count > 1) / COUNT(DISTINCT incident_id)", filters: "Counts a reassignment only when the receiving group differs from the sending group.", refresh: "Hourly", caveat: "Within-team analyst reassignments are not counted." } },
  { id: "reopen",      domain: "incident", category: "quality",    name: "Reopen Rate",            value: "5.8%",     unit: "rate", desc: "Resolved tickets that came back to life. The closest thing to a quality signal.",
    vizOptions: ["Bar by team", "Bar by service", "Trend line"], defaultViz: "Trend line",
    nutrition: { source: "fact_incident_state", column: "incident_id, state_change", calc: "COUNT(DISTINCT incident_id with reopen_event) / COUNT(DISTINCT resolved incident_id)", filters: "Reopens within 30 days of original resolution count toward the rate.", refresh: "Hourly", caveat: "Customer-initiated reopens and analyst self-reopens are combined; split available on request." } },
  { id: "mttr",        domain: "incident", category: "velocity",   name: "Avg. MTTR",              value: "96.2 hrs", unit: "hours", desc: "Mean time from open to resolved across the population.",
    vizOptions: ["Bar by team", "Bar by service", "Trend line"], defaultViz: "Trend line",
    nutrition: { source: "fact_incident", column: "created_at, resolved_at", calc: "AVG(resolved_at - created_at) WHERE state = 'Resolved'", filters: "Long-tail outliers (>30d) are winsorized at the 99th percentile.", refresh: "Hourly", caveat: "Mean is sensitive to outliers — pair with median MTTR (available in the deep dive template)." } },
  { id: "aging",       domain: "incident", category: "backlog",    name: "Aging > 7 Days",         value: "35,145",   unit: "tickets", desc: "Open tickets older than a week. The carry-over telling you what's stuck.",
    vizOptions: ["Aging waterfall", "Bar by service", "Globe view"], defaultViz: "Aging waterfall",
    nutrition: { source: "fact_incident", column: "created_at, state", calc: "COUNT(*) WHERE state IN ('New','Active','Pending') AND created_at < NOW() - INTERVAL 7 DAY", filters: "Snapshot at query time, not period-bound.", refresh: "Every 15 minutes", caveat: "Includes tickets in customer-pending state — split available via Service Group filter." } },
  { id: "sla",         domain: "incident", category: "compliance", name: "SLA Compliance",         value: "—",        unit: "rate", desc: "Share of incidents that met their target response and resolution windows.",
    vizOptions: [], defaultViz: null, comingSoon: true,
    nutrition: { source: "fact_sla (in validation)", column: "—", calc: "Pending SLA contract reconciliation", filters: "Requires service-tier mapping from CMDB sync still in progress.", refresh: "—", caveat: "Coming Q3. Expected to land alongside the new service catalog." } },

  // ── Incident (FCR) ──────────────────────────────────────────────────────
  { id: "fcr_rate",   domain: "incident",  category: "efficiency", name: "First Contact Resolution Rate", value: "58.8%", unit: "rate", desc: "Share of incidents resolved on the first interaction — without a hand-off or callback.",
    vizOptions: ["Trend line", "Bar by team", "Bar by service"], defaultViz: "Trend line",
    nutrition: { source: "fact_incident, fact_assignment", column: "incident_id, assignment_count, first_resolved_flag", calc: "COUNT(WHERE assignment_count = 1 AND state = 'Resolved') / COUNT(WHERE state = 'Resolved')", filters: "Excludes incidents where the first-contact agent is the same as the resolving agent only by retry (counts as one contact).", refresh: "Hourly", caveat: "Self-resolved tickets (customer cancels) inflate this slightly; split available on request." } },

  // ── Problem ─────────────────────────────────────────────────────────────
  { id: "mttc",            domain: "problem",  category: "velocity",   name: "MTTC",              value: "65.9 d", unit: "days", desc: "Mean Time to Cause — how long from a problem record opening to root cause identified.",
    vizOptions: ["Trend line", "Bar by team", "Bar by service"], defaultViz: "Trend line",
    nutrition: { source: "fact_problem", column: "opened_at, cause_identified_at", calc: "AVG(cause_identified_at - opened_at) WHERE cause_identified_at IS NOT NULL", filters: "Problems still in investigation are excluded.", refresh: "Daily", caveat: "Long-tail problems (> 180 days) are winsorized at the 95th percentile." } },
  { id: "rca_lead_time",   domain: "problem",  category: "discipline", name: "RCA Lead Time",     value: "26.7 d", unit: "days", desc: "Average time from cause identified to a published Root Cause Analysis.",
    vizOptions: ["Trend line", "Bar by team", "Bar by service"], defaultViz: "Trend line",
    nutrition: { source: "fact_problem, fact_rca", column: "cause_identified_at, rca_published_at", calc: "AVG(rca_published_at - cause_identified_at) WHERE rca_published_at IS NOT NULL", filters: "Counts only RCAs in the 'published' state. Drafts excluded.", refresh: "Daily", caveat: "RCAs that are revised post-publish keep their original lead time." } },
  { id: "aging_30d_problems", domain: "problem", category: "backlog",  name: "Aging > 30d Rate",  value: "29.5%",  unit: "rate", desc: "Share of open problems older than 30 days — the long-tail of unresolved root causes.",
    vizOptions: ["Trend line", "Bar by service"], defaultViz: "Trend line",
    nutrition: { source: "fact_problem", column: "opened_at, state", calc: "COUNT(WHERE state IN ('Open','Investigating') AND opened_at < NOW() - INTERVAL 30 DAY) / COUNT(WHERE state IN ('Open','Investigating'))", filters: "Snapshot at query time.", refresh: "Every 15 minutes", caveat: "Includes problems in 'awaiting vendor' state — split available via Service Group filter." } },

  // ── Change ──────────────────────────────────────────────────────────────
  { id: "change_success_rate",  domain: "change", category: "quality",  name: "Change Success Rate", value: "93.8%", unit: "rate", desc: "Share of change requests that completed without rollback or follow-on incident.",
    vizOptions: ["Trend line", "Bar by team", "Bar by service"], defaultViz: "Trend line",
    nutrition: { source: "fact_change", column: "change_id, outcome", calc: "COUNT(WHERE outcome = 'Successful') / COUNT(WHERE outcome IS NOT NULL)", filters: "Excludes changes still in implementation.", refresh: "Hourly", caveat: "A change is considered successful only if no related incident is logged in the 72 hours after deployment." } },
  { id: "change_major_inc_rate", domain: "change", category: "quality", name: "Major Incident Rate", value: "3.4%",  unit: "rate", desc: "Share of changes that caused a P1/P2 incident within 72 hours of deployment.",
    vizOptions: ["Trend line", "Bar by service"], defaultViz: "Trend line",
    nutrition: { source: "fact_change, fact_incident", column: "change_id, related_incident_priority", calc: "COUNT(DISTINCT change_id WHERE related_incident.priority IN (1,2)) / COUNT(DISTINCT change_id)", filters: "Only counts incidents whose 'caused_by_change' field is populated.", refresh: "Hourly", caveat: "Incident attribution is manual today; auto-attribution arrives in Q4." } },
  { id: "change_expedited", domain: "change", category: "routing", name: "Expedited / Emergency %", value: "10.2%", unit: "rate", desc: "Share of changes that bypassed the standard CAB review — emergency or expedited.",
    vizOptions: ["Trend line", "Bar by service"], defaultViz: "Trend line",
    nutrition: { source: "fact_change", column: "change_type", calc: "COUNT(WHERE change_type IN ('Emergency','Expedited')) / COUNT(*)", filters: "All change types are counted in the denominator.", refresh: "Hourly", caveat: "Spikes after major incidents are expected — typically clears within a week." } },
  { id: "change_standard",  domain: "change", category: "routing", name: "Standard / Headless %", value: "70.5%", unit: "rate", desc: "Share of changes that ran through pre-approved standard templates without manual review.",
    vizOptions: ["Trend line", "Bar by service"], defaultViz: "Trend line",
    nutrition: { source: "fact_change", column: "change_type, template_id", calc: "COUNT(WHERE change_type = 'Standard' AND template_id IS NOT NULL) / COUNT(*)", filters: "Custom-template changes that match a pre-approved pattern count toward this rate.", refresh: "Hourly", caveat: "Higher is better — indicates change-as-code maturity." } },

  // ── Outage ──────────────────────────────────────────────────────────────
  { id: "downtime",     domain: "outage", category: "availability", name: "Downtime",      value: "2.0 d",  unit: "days", desc: "Total customer-facing service downtime in the period.",
    vizOptions: ["Trend line", "Bar by service"], defaultViz: "Trend line",
    nutrition: { source: "fact_outage", column: "outage_id, started_at, ended_at, scope", calc: "SUM(ended_at - started_at) WHERE scope = 'customer-impacting' AND state = 'Resolved'", filters: "Internal-only outages excluded.", refresh: "Every 5 minutes", caveat: "A single multi-region outage counts once at the longest leg." } },
  { id: "mttd",         domain: "outage", category: "velocity",     name: "MTTD",          value: "1.2 h",  unit: "hours", desc: "Mean Time to Detect — how fast we know an outage is happening.",
    vizOptions: ["Trend line", "Bar by service"], defaultViz: "Trend line",
    nutrition: { source: "fact_outage, fact_monitoring", column: "outage_started_at, first_alert_at", calc: "AVG(first_alert_at - outage_started_at) WHERE first_alert_at IS NOT NULL", filters: "Outages discovered by guest report (not monitoring) count as the maximum window (4 hours).", refresh: "Every 5 minutes", caveat: "Improvements correlate strongly with synthetic-monitoring coverage rollout." } },
  { id: "mtbf",         domain: "outage", category: "availability", name: "MTBF",          value: "12.1 d", unit: "days", desc: "Mean Time Between Failures — average gap between consecutive outages.",
    vizOptions: ["Trend line", "Bar by service"], defaultViz: "Trend line",
    nutrition: { source: "fact_outage", column: "outage_id, started_at", calc: "AVG(diff between consecutive outage.started_at) WITHIN scope", filters: "Maintenance-window outages excluded.", refresh: "Daily", caveat: "Sparse data for low-traffic services; consider service-group rollup for those." } },
  { id: "p1p2_outages", domain: "outage", category: "priority",     name: "P1/P2 Outages", value: "11",     unit: "outages", desc: "Count of P1 or P2 customer-impacting outages in the period.",
    vizOptions: ["Trend line", "Bar by service"], defaultViz: "Trend line",
    nutrition: { source: "fact_outage", column: "outage_id, severity", calc: "COUNT(WHERE severity IN ('P1','P2') AND state = 'Resolved')", filters: "Resolved outages only — in-flight outages tracked separately.", refresh: "Every 5 minutes", caveat: "Severity may downgrade post-postmortem; this number reflects the final classification." } },

  // ── Knowledge ───────────────────────────────────────────────────────────
  { id: "kn_resolved",     domain: "knowledge", category: "efficiency",   name: "Resolved w/ Knowledge", value: "24.3%", unit: "rate", desc: "Share of incidents resolved with a linked knowledge article — proxy for KB-led resolution.",
    vizOptions: ["Trend line", "Bar by team", "Bar by service"], defaultViz: "Trend line",
    nutrition: { source: "fact_incident, fact_knowledge_link", column: "incident_id, kb_article_id", calc: "COUNT(DISTINCT incident_id WHERE kb_article_id IS NOT NULL AND state = 'Resolved') / COUNT(DISTINCT WHERE state = 'Resolved')", filters: "Links must be created during the incident, not back-filled.", refresh: "Hourly", caveat: "Articles linked after resolution don't count — agents must link in-the-moment." } },
  { id: "kn_flagged",      domain: "knowledge", category: "quality",      name: "Flagged Articles",      value: "6.7%",  unit: "rate", desc: "Share of knowledge articles flagged as inaccurate, outdated, or unhelpful.",
    vizOptions: ["Trend line", "Bar by service"], defaultViz: "Trend line",
    nutrition: { source: "fact_kb_article, fact_kb_feedback", column: "article_id, flag_count", calc: "COUNT(DISTINCT article_id WHERE flag_count > 0) / COUNT(DISTINCT article_id)", filters: "Articles in 'archived' state excluded.", refresh: "Daily", caveat: "A single flag puts an article in this bucket — review cadence handles thresholds." } },
  { id: "kn_opportunity",  domain: "knowledge", category: "discipline",   name: "Knowledge Opportunity", value: "34.9%", unit: "rate", desc: "Share of resolved incidents that could have been resolved via existing knowledge but weren't.",
    vizOptions: ["Trend line", "Bar by team", "Bar by service"], defaultViz: "Trend line",
    nutrition: { source: "fact_incident, fact_knowledge_match", column: "incident_id, matched_kb_article_id", calc: "COUNT(DISTINCT incident_id WHERE matched_kb_article_id IS NOT NULL AND kb_article_id IS NULL) / COUNT(DISTINCT resolved)", filters: "Match scoring uses incident description + resolution notes against the KB index.", refresh: "Daily", caveat: "Match is a similarity score ≥ 0.75 — tunable. Lower threshold widens the opportunity, higher tightens." } },
  { id: "kn_deflection",   domain: "knowledge", category: "self-service", name: "Knowledge Deflection Rate", value: "22.4%", unit: "rate", desc: "Share of would-be tickets resolved via self-service before a human agent ever touched them.",
    vizOptions: ["Trend line", "Bar by service"], defaultViz: "Trend line",
    nutrition: { source: "fact_kb_search, fact_incident", column: "search_session_id, ticket_created_flag", calc: "COUNT(DISTINCT search_session_id WHERE ticket_created_flag = 0) / COUNT(DISTINCT search_session_id)", filters: "Only counts sessions where the user clicked at least one article — passive searchers excluded.", refresh: "Hourly", caveat: "Some 'deflected' searchers may eventually call in — true deflection is closer to 85% of this number." } }
];

const TEMPLATES = [
  { id: "exec_health", name: "Executive Health Overview", desc: "The boardroom view. P1s, throughput, and quality at a glance.",
    glyph: "crown", metrics: ["p1", "opened", "resolved", "reassign", "mttr"], window: "90d", recommended: true },
  { id: "routing", name: "Routing Efficiency Audit", desc: "Where tickets are bouncing and how long they sit before they land.",
    glyph: "compass", metrics: ["reassign", "reopen", "mttr"], window: "30d" },
  { id: "daily", name: "Daily Operational Snapshot", desc: "A morning briefing for the floor — what came in, what got handled.",
    glyph: "sunrise", metrics: ["opened", "p1", "same_day"], window: "7d" },
  { id: "quarterly", name: "Quarterly Board Briefing", desc: "Quarter-over-quarter narrative for stakeholders who don't live in the data.",
    glyph: "book", metrics: ["opened", "resolved", "same_day", "reopen"], window: "90d" },
  { id: "deep_dive", name: "Full Incident Deep Dive", desc: "Every incident KPI on one canvas — for analysts who want to read the whole novel.",
    glyph: "magnifier", metrics: ["opened", "resolved", "p1", "same_day", "reassign", "reopen"], window: "60d" },
  { id: "regional", name: "Regional Property Performance", desc: "Where in the world things are quiet, and where they aren't.",
    glyph: "globe", metrics: ["opened", "p1", "reassign"], window: "30d" },
  { id: "scorecard", name: "Product Health Scorecard", desc: "A synthesized 0–100 score across Incident, Problem, Change, Outage, and Knowledge. The boardroom view, scored.",
    glyph: "star",
    // Every KPI that contributes to the scorecard's per-domain scores. The
    // domain cards always render the same 5 sub-domains regardless; this list
    // drives what's in the order bar and what Key Takeaways can comment on.
    metrics: [
      // Incident (4)
      "mttr", "reopen", "reassign", "fcr_rate",
      // Problem (3)
      "mttc", "rca_lead_time", "aging_30d_problems",
      // Change (4)
      "change_success_rate", "change_major_inc_rate", "change_expedited", "change_standard",
      // Outage (4)
      "downtime", "mttd", "mtbf", "p1p2_outages",
      // Knowledge (4)
      "kn_resolved", "kn_flagged", "kn_opportunity", "kn_deflection"
    ],
    window: "30d", layout: "scorecard" },
  { id: "multi_exec", name: "Five-domain Executive Snapshot", desc: "One bellwether KPI per ITSM domain — Incident, Problem, Change, Outage, Knowledge — on a single page.",
    glyph: "globe", metrics: ["p1", "rca_lead_time", "change_success_rate", "downtime", "kn_deflection"], window: "30d" },
  { id: "ops_risk", name: "Operations Risk Briefing", desc: "The metrics most predictive of guest impact, woven across change and outage discipline.",
    glyph: "compass", metrics: ["mttr", "change_major_inc_rate", "p1p2_outages", "kn_flagged"], window: "60d" }
];

const PERSONAS = {
  exec: {
    id: "exec",
    name: "Margaret Chen",
    initials: "MC",
    role: "VP, Global Technology Operations",
    salutation: "Margaret",
    headline: "Welcome back, <em>Margaret</em>.",
    rationale: "You usually open this on Monday mornings before the operations review. Three weeks running, you've focused on routing health and P1 trend — so we've kept the executive lens and a quarter-long window.",
    intent: "Based on your role and your last three reports, we'd suggest the executive health view across the past quarter.",
    template: "exec_health",
    timeWindow: "90d"
  },
  manager: {
    id: "manager",
    name: "John Maloney",
    initials: "JM",
    role: "FLEX Manager · Incident Management",
    salutation: "John",
    headline: "Welcome back, <em>John</em>.",
    rationale: "Your team has been working a reassignment-rate spike for two weeks. The routing audit pulls in the metrics that line up with that investigation.",
    intent: "Based on your role in Incident Management and your recent activity, we'd start with a routing efficiency audit on the last 30 days.",
    template: "routing",
    timeWindow: "30d"
  },
  analyst: {
    id: "analyst",
    name: "Priya Anand",
    initials: "PA",
    role: "Senior Analyst · TEC Analytics",
    salutation: "Priya",
    headline: "Hello again, <em>Priya</em>.",
    rationale: "Your last six manifests have all touched MTTR and reopen rate at 60-day windows. Here's the deep dive pre-loaded — adjust freely.",
    intent: "Given your usual pattern, we've laid out the full incident deep dive across 60 days. Everything's expanded.",
    template: "deep_dive",
    timeWindow: "60d"
  }
};

const TIME_WINDOWS = [
  { id: "7d",  label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "60d", label: "60 days" },
  { id: "90d", label: "90 days" },
  { id: "custom", label: "Custom" }
];

const DOMAINS = [
  { id: "all", name: "All domains" },
  { id: "incident", name: "Incident" },
  { id: "change", name: "Change" },
  { id: "problem", name: "Problem" },
  { id: "outage", name: "Outage" },
  { id: "knowledge", name: "Knowledge" }
];

const GEN_STAGES = [
  "Reviewing your selections…",
  "Querying the lakehouse…",
  "Pouring the data through the filters…",
  "Composing the layout…",
  "Polishing the silver. Almost ready."
];

Object.assign(window, { METRICS, TEMPLATES, PERSONAS, TIME_WINDOWS, DOMAINS, GEN_STAGES });
