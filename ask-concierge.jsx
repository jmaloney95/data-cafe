// Ask the Concierge — LLM integration layer.
//
// Two modes per call:
//   1) "build"  → user wants a report. Returns a manifest fragment that
//                 hydrates the builder (metrics, time window, template).
//   2) "answer" → user wants a direct answer about the data. Returns prose
//                 that quotes real KPI values.
//
// Each entry point has an Anthropic-API path (when a key is configured)
// and a rules-based fallback (when no key, or network failure). The fallback
// is good enough that the demo never goes blank.
//
// Future: replace direct Anthropic calls with a Marriott GenAI gateway.

(function () {
  const KEY_STORE   = "ic.concierge.api_key";
  const STATE_STORE = "ic.concierge.last_status";   // "ok" | "fail" | null
  const FORCE_STORE = "ic.concierge.force_rules";   // "1" | absent
  const API_URL     = "https://api.anthropic.com/v1/messages";
  const MODEL_FAST  = "claude-haiku-4-5";
  const MODEL_SMART = "claude-sonnet-4-6";
  const API_VERSION = "2023-06-01";

  let _key = null;
  let _lastOk = null;       // boolean | null
  let _forceRules = false;  // when true, every call routes to the rules fallback
                            // even if a key is configured. Lets the demo flip
                            // between AI and rules without wiping the key.

  try { _key        = localStorage.getItem(KEY_STORE) || null;             } catch (e) {}
  try { _lastOk     = localStorage.getItem(STATE_STORE) === "ok";          } catch (e) {}
  try { _forceRules = localStorage.getItem(FORCE_STORE) === "1";           } catch (e) {}

  function getApiKey() { return _key; }
  function setApiKey(k) {
    _key = (k && String(k).trim()) || null;
    try {
      if (_key) localStorage.setItem(KEY_STORE, _key);
      else      localStorage.removeItem(KEY_STORE);
    } catch (e) {}
  }
  function clearApiKey() { setApiKey(null); _lastOk = null; }
  function markStatus(ok) {
    _lastOk = !!ok;
    try { localStorage.setItem(STATE_STORE, ok ? "ok" : "fail"); } catch (e) {}
  }
  function getForceRules() { return _forceRules; }
  function setForceRules(b) {
    _forceRules = !!b;
    try {
      if (_forceRules) localStorage.setItem(FORCE_STORE, "1");
      else             localStorage.removeItem(FORCE_STORE);
    } catch (e) {}
  }
  // Effective connection state: a key is set AND the user hasn't forced rules.
  function _useAi()       { return !!_key && !_forceRules; }
  function isConnected()  { return _useAi() && _lastOk !== false; }

  // ---- Low-level Anthropic call ---------------------------------------
  async function callAnthropic(model, systemPrompt, userPrompt, maxTokens) {
    if (!_key) throw new Error("No API key configured");
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": _key,
        "anthropic-version": API_VERSION,
        "anthropic-dangerous-direct-browser-access": "true"
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }]
      })
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      markStatus(false);
      throw new Error("Anthropic " + res.status + ": " + text.slice(0, 200));
    }
    const data = await res.json();
    markStatus(true);
    return (data.content && data.content[0] && data.content[0].text) || "";
  }

  // ---- Catalog snapshots (for system prompts) -------------------------
  // Built lazily — the catalog isn't on window until data.jsx + aggregations.jsx
  // have run. We re-query on each call so newly-added metrics are visible.
  function metricCatalogSnapshot() {
    const M = window.METRICS || [];
    return M.filter(m => !m.comingSoon).map(m =>
      `  ${m.id} (${m.domain} / ${m.category}) — ${m.name}: ${m.desc}`
    ).join("\n");
  }
  function templateCatalogSnapshot() {
    const T = window.TEMPLATES || [];
    return T.map(t => `  ${t.id}: ${t.name} — ${t.desc} [metrics: ${(t.metrics||[]).join(", ")}, window: ${t.window}]`).join("\n");
  }

  // ---- Intent classifier ----------------------------------------------
  // Cheap call via Haiku, or a keyword heuristic for the offline path.
  async function classifyIntent(query) {
    const q = String(query || "").trim();
    if (!q) return "build";
    // Fallback heuristic — used when no key OR when the API errors.
    const heuristic = () => {
      const lc = q.toLowerCase();
      const isQuestion = /\?$/.test(q) ||
        /\b(why|how come|how is|how did|how are|what caused|what's|whats|tell me about|explain|compare|did we|are we|is the|is our|describe)\b/i.test(lc);
      return isQuestion ? "answer" : "build";
    };
    if (!_useAi()) return heuristic();
    try {
      const text = await callAnthropic(
        MODEL_FAST,
        "You are an intent classifier for a Marriott TEC analytics tool. " +
        "Classify each message as either 'build' (user wants a report or dashboard) " +
        "or 'answer' (user wants a direct answer about the data). " +
        "Reply with ONLY the single word: build or answer.",
        q,
        12
      );
      const norm = (text || "").trim().toLowerCase();
      if (norm.startsWith("answer")) return "answer";
      if (norm.startsWith("build"))  return "build";
      return heuristic();
    } catch (e) {
      console.warn("[AskConcierge] classifyIntent fell back:", e.message);
      return heuristic();
    }
  }

  // ---- Build mode: NL → manifest fragment -----------------------------
  async function buildManifestFromQuery(query, ctx) {
    const q = String(query || "").trim();
    if (!_useAi()) return rulesBasedBuild(q, ctx);
    try {
      const sysPrompt =
        "You are the Insight Concierge — you turn business questions into report manifests for a Marriott TEC analytics tool.\n\n" +
        "Available metrics (id — name / domain):\n" + metricCatalogSnapshot() + "\n\n" +
        "Available templates:\n" + templateCatalogSnapshot() + "\n\n" +
        "Available time windows: 7d, 30d, 60d, 90d.\n" +
        "Available viz types: trend_line, bar_by_team, bar_by_service, priority_donut, status_donut.\n\n" +
        "Rules:\n" +
        "- Pick between 2 and 5 metrics that best answer the user's question.\n" +
        "- Use ONLY metric IDs from the catalog above.\n" +
        "- If a template fits closely, set template_id to that template's id; otherwise null.\n" +
        "- intent_summary is one sentence in the user's own framing.\n" +
        "- explanation is one sentence justifying the metric picks.\n\n" +
        "Reply with ONLY valid JSON of this shape, no preamble, no markdown:\n" +
        '{ "metrics": [{"id":"...","viz":"..."}], "time_window": {"type":"preset","value":"30d"}, "template_id": "..."|null, "intent_summary": "...", "explanation": "..." }';
      const userPrompt = (ctx && ctx.persona && ctx.persona.role)
        ? `[Asking as ${ctx.persona.role}] ${q}`
        : q;
      const text = await callAnthropic(MODEL_SMART, sysPrompt, userPrompt, 800);
      const parsed = safeParseJson(text);
      if (parsed && parsed.metrics && parsed.metrics.length) {
        return parsed;
      }
      // Model returned garbage — fall back.
      console.warn("[AskConcierge] build model output unusable; falling back.");
      return rulesBasedBuild(q, ctx);
    } catch (e) {
      console.warn("[AskConcierge] build fell back:", e.message);
      return rulesBasedBuild(q, ctx);
    }
  }

  // ---- Answer mode: NL → direct prose ---------------------------------
  async function answerQuestion(query, ctx) {
    const q = String(query || "").trim();
    if (!_useAi()) return { text: rulesBasedAnswer(q, ctx), source: "rules" };
    try {
      const kpisJson = JSON.stringify(ctx && ctx.kpis ? ctx.kpis : {});
      const windowLabel = (ctx && ctx.windowLabel) || "the recent window";
      const sysPrompt =
        "You are the Insight Concierge — a Marriott TEC analyst answering questions about ITSM metrics from a canned dataset.\n\n" +
        "Available metrics:\n" + metricCatalogSnapshot() + "\n\n" +
        `Current scope: ${windowLabel}\n` +
        `Current KPI snapshot (use these numbers; don't invent others):\n${kpisJson}\n\n` +
        "Rules:\n" +
        "- Answer in 2–3 sentences. No markdown. No preamble.\n" +
        "- Quote specific numbers from the KPI snapshot when relevant.\n" +
        "- If the snapshot doesn't address the question, say so honestly.\n" +
        "- Tone: confident, diagnostic, plain-English (not formal).";
      const text = await callAnthropic(MODEL_SMART, sysPrompt, q, 600);
      return { text: (text || "").trim() || rulesBasedAnswer(q, ctx), source: "ai" };
    } catch (e) {
      console.warn("[AskConcierge] answer fell back:", e.message);
      return { text: rulesBasedAnswer(q, ctx), source: "rules" };
    }
  }

  // ---- Test connection (used by the Tweaks panel "Test" button) -------
  async function testConnection() {
    if (!_key) return { ok: false, error: "No API key set" };
    try {
      const text = await callAnthropic(MODEL_FAST,
        "Respond with the single word: ready.", "ping", 12);
      return { ok: true, text: (text || "").trim() };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  // ====================================================================
  // RULES-BASED FALLBACKS
  // ====================================================================

  function safeParseJson(text) {
    if (!text) return null;
    // Strip code fences if the model wrapped its JSON
    let t = text.trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/, "")
      .trim();
    // Find the first {...} block
    const start = t.indexOf("{");
    const end   = t.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    try { return JSON.parse(t.slice(start, end + 1)); } catch (e) { return null; }
  }

  // Keyword → template/metric matcher for the offline build path.
  function rulesBasedBuild(query, ctx) {
    const lc = (query || "").toLowerCase();
    const T = window.TEMPLATES || [];
    const M = window.METRICS  || [];
    const findTmpl = (id) => T.find(t => t.id === id);

    let pickedTmpl = null;
    let intent = "";
    if (/\b(scorecard|five[- ]domain|composite|all domains|overall score)\b/.test(lc)) {
      pickedTmpl = findTmpl("scorecard"); intent = "a Product Health Scorecard across all 5 ITSM domains.";
    } else if (/\b(routing|reassign|bounce|hand[- ]off|misrouted)\b/.test(lc)) {
      pickedTmpl = findTmpl("routing"); intent = "a routing-efficiency audit on the last 30 days.";
    } else if (/\b(executive|vp|board|quarterly|leadership|c[- ]suite)\b/.test(lc)) {
      pickedTmpl = findTmpl(/quarter|board/.test(lc) ? "quarterly" : "exec_health");
      intent = "an executive-level overview across the past quarter.";
    } else if (/\b(deflection|knowledge|self[- ]service|kb|article)\b/.test(lc)) {
      pickedTmpl = findTmpl("multi_exec"); intent = "a snapshot of self-service and knowledge health.";
    } else if (/\b(outage|downtime|availability|sla|mtbf|mttd)\b/.test(lc)) {
      pickedTmpl = findTmpl("ops_risk"); intent = "an operations-risk briefing across change discipline and outages.";
    } else if (/\b(deep[- ]dive|all incident|every metric|full)\b/.test(lc)) {
      pickedTmpl = findTmpl("deep_dive"); intent = "a full incident-management deep dive.";
    } else if (/\b(today|this morning|daily|snapshot|right now)\b/.test(lc)) {
      pickedTmpl = findTmpl("daily"); intent = "a daily operational snapshot for the past week.";
    } else if (/\b(region|geograph|americas|emea|apac|property)\b/.test(lc)) {
      pickedTmpl = findTmpl("regional"); intent = "regional property performance across the past 30 days.";
    } else {
      pickedTmpl = findTmpl("routing"); intent = "a routing-efficiency audit (closest match — try keywords like 'executive', 'scorecard', or 'outage' for other angles).";
    }

    const tmpl = pickedTmpl || T[0];
    const metricObjs = (tmpl.metrics || []).map(id => {
      const m = M.find(x => x.id === id);
      const viz = (m && m.defaultViz) || "Trend line";
      return { id, viz: viz.toLowerCase().replace(/\s+/g, "_") };
    });
    return {
      metrics: metricObjs,
      time_window: { type: "preset", value: tmpl.window || "30d" },
      template_id: tmpl.id,
      intent_summary: "Reads as " + intent,
      explanation: "Loaded the " + tmpl.name + " template's metrics — adjust below before generating."
    };
  }

  // Templated answers using real KPI values. Less impressive than an LLM
  // call but reads as competent and never blanks out.
  function rulesBasedAnswer(query, ctx) {
    const kpis = (ctx && ctx.kpis) || {};
    const win  = (ctx && ctx.windowLabel) || "the recent window";
    const lc   = (query || "").toLowerCase();

    const fmt = (v, suffix) => (v == null || isNaN(v))
      ? "—"
      : (typeof v === "number" ? v.toFixed(1) : v) + (suffix || "");

    if (/\b(reopen|rework)\b/.test(lc) && kpis.reopen != null) {
      return `Across ${win}, Reopen Rate is sitting at ${fmt(kpis.reopen, "%")}, against a 3% stretch target. ` +
             `That's a meaningful drag on quality — the typical cause is closure-criteria slip; the routing audit template surfaces the worst-offending teams.`;
    }
    if (/\b(mttr|resolution|how fast|how long)\b/.test(lc) && kpis.mttr != null) {
      return `Average MTTR over ${win} is ${fmt(kpis.mttr, " hrs")}, against a 60-hour stretch target. ` +
             `Long-tail incidents tend to dominate this — winsorize at the 99th percentile or pair with Same Day Resolution (currently ${fmt(kpis.same_day, "%")}) to read it cleanly.`;
    }
    if (/\b(routing|reassign|bounce|hand[- ]off)\b/.test(lc) && kpis.reassign != null) {
      return `Reassignment Rate is ${fmt(kpis.reassign, "%")} across ${win} — past the 50% floor we hold as acceptable. ` +
             `That's the routing-health canary; the Routing Efficiency Audit template breaks this down by team and service.`;
    }
    if (/\b(p1|critical|outage|down)\b/.test(lc)) {
      const p1 = kpis.p1 != null ? fmt(kpis.p1, " open") : "—";
      const out = kpis.p1p2_outages != null ? `${kpis.p1p2_outages} P1/P2 outages logged` : "outages data unavailable in this scope";
      return `Current P1 backlog is ${p1}, ${out} over ${win}. ` +
             `P1/P2 trend is the strongest predictor of guest impact — the Operations Risk Briefing template pulls these together.`;
    }
    if (/\b(deflection|self[- ]service|knowledge|kb)\b/.test(lc)) {
      const d  = kpis.kn_deflection != null ? fmt(kpis.kn_deflection, "%") : "—";
      const o  = kpis.kn_opportunity != null ? fmt(kpis.kn_opportunity, "%") : "—";
      return `Knowledge Deflection Rate is ${d} across ${win} — drifting up toward the 30% stretch target. ` +
             `The Knowledge Opportunity sits at ${o}, suggesting there's still room to convert tickets to articles. Tracking both together tells the self-service story.`;
    }
    if (/\b(change|deploy|release|emergency|expedited)\b/.test(lc)) {
      const csr = kpis.change_success_rate != null ? fmt(kpis.change_success_rate, "%") : "—";
      const mir = kpis.change_major_inc_rate != null ? fmt(kpis.change_major_inc_rate, "%") : "—";
      return `Change Success Rate is ${csr} over ${win} (97% stretch target) and Major Incident Rate from changes is ${mir} (1% target). ` +
             `If the gap between these two widens, it's usually a sign that expedited or emergency changes are concentrating risk — worth filtering by change type.`;
    }
    if (/\b(compare|vs|versus|prior|last)\b/.test(lc)) {
      return `Window-over-window comparisons across ${win} are visible on every KPI tile as a delta (▲/▼ vs prior). ` +
             `If you want a side-by-side framing, the Multi-Tab Deep Dive layout in Customize gives each metric its own panel for closer reading.`;
    }
    // Generic — quote a few headline numbers and offer a follow-up.
    const headline = [];
    if (kpis.mttr     != null) headline.push(`MTTR ${fmt(kpis.mttr, "h")}`);
    if (kpis.reopen   != null) headline.push(`Reopen ${fmt(kpis.reopen, "%")}`);
    if (kpis.reassign != null) headline.push(`Reassign ${fmt(kpis.reassign, "%")}`);
    return `Across ${win}, the headline numbers are ${headline.join(", ")}. ` +
           `Ask a more specific question — e.g., "why is reopen rate up", "how is change success trending", or "what's the deflection picture" — and I'll dig in.`;
  }

  // ---- Expose ---------------------------------------------------------
  window.AskConcierge = {
    classifyIntent,
    buildManifestFromQuery,
    answerQuestion,
    testConnection,
    getApiKey, setApiKey, clearApiKey, isConnected,
    getForceRules, setForceRules,
    // Status getters for the brain pill and the Tweaks status row.
    // "rules"           — no key set (rules-based is the only option)
    // "rules_override"  — key set but user clicked the pill to force rules
    // "fail"            — key set, last call failed
    // "ai"              — key set, last call OK (or untested)
    get statusLabel() {
      if (!_key)           return "Rules mode";
      if (_forceRules)     return "Rules (override)";
      if (_lastOk === false) return "Connection failed";
      return "AI connected";
    },
    get statusKind() {
      if (!_key)           return "rules";
      if (_forceRules)     return "rules_override";
      if (_lastOk === false) return "fail";
      return "ai";
    }
  };
})();
