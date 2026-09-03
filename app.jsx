// Main app — Insight Concierge

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "cream",
  "density": "regular",
  "fonts": "serif-sans",
  "persona": "exec"
}/*EDITMODE-END*/;

// Default cap on metric selections for single-page / multi-tab reports.
// The scorecard layout lifts this cap implicitly (it scores every KPI in its
// 5-domain spec, ~19 KPIs total). The order-bar counter still shows "/6" so
// the user sees they're over the typical recommended size — informational
// rather than blocking.
const MAX_METRICS = 6;
const MAX_METRICS_HARD_CAP = 30;    // hard ceiling even in scorecard mode

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  // Apply density/fonts/theme to <html>. <html>'s theme always follows the
  // Tweaks panel — the manifest theme stays scoped to the dashboard view
  // (Dashboard sets data-theme on its own root) so the header ribbon keeps
  // its global theme when the user picks something different in Customize.
  useEffect(() => {
    document.documentElement.dataset.theme = t.theme;
    document.documentElement.dataset.density = t.density;
    document.documentElement.dataset.fonts = t.fonts;
  }, [t.theme, t.density, t.fonts]);

  // Keyboard shortcut to toggle the Tweaks panel: Ctrl+. (or Cmd+. on Mac).
  // The Tweaks panel listens for __activate_edit_mode / __deactivate_edit_mode
  // postMessages; we track our own toggle state so a single shortcut flips
  // between open and closed. Useful on a demo machine where there's no host
  // frame to send the activation message.
  const [tweaksOpen, setTweaksOpen] = useState(false);
  useEffect(() => {
    const onKey = (e) => {
      const isToggle = (e.ctrlKey || e.metaKey) && e.key === ".";
      if (!isToggle) return;
      e.preventDefault();
      setTweaksOpen(prev => {
        const next = !prev;
        window.postMessage({ type: next ? "__activate_edit_mode" : "__deactivate_edit_mode" }, "*");
        return next;
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const persona = PERSONAS[t.persona] || PERSONAS.exec;

  // Tab nav (My Reports / Marketplace are stubbed but visible)
  const [tab, setTab] = useState("build");

  // View mode: the builder, or the in-app live dashboard.
  const [viewMode, setViewMode] = useState("build");           // "build" | "dashboard"
  const [activeManifest, setActiveManifest] = useState(null);  // captured at Generate time

  // Map manifest theme tokens to data-theme values. Used by the Dashboard
  // component to scope its theme to itself.
  const MANIFEST_THEME_MAP = {
    brand_light:    "cream",
    modern_dark:    "midnight",
    minimal_print:  "print"
  };
  const dashboardTheme = (activeManifest && activeManifest.theme && MANIFEST_THEME_MAP[activeManifest.theme])
    || t.theme;
  const [activeReportId, setActiveReportId] = useState(null);  // set when active report is saved
  const [activeReportName, setActiveReportName] = useState(null);
  const [activeRefreshedAt, setActiveRefreshedAt] = useState(null);
  const [savedReports, setSavedReports] = useState(() => window.ReportStore.list());
  const refreshSavedList = () => setSavedReports(window.ReportStore.list());

  // Build state
  const [selectedTemplate, setSelectedTemplate] = useState(persona.template);
  const [timeWindow, setTimeWindow] = useState(persona.timeWindow);
  const [domainFilter, setDomainFilter] = useState("all");
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [layout, setLayout] = useState("single");
  const [theme, setTheme] = useState("light");
  const [advFilters, setAdvFilters] = useState({ priority: "all", service: "all", region: "all", refresh: "hourly", csv: true, pdf: true, email: false });

  // When persona changes (Tweaks) → reset builder defaults
  useEffect(() => {
    setSelectedTemplate(persona.template);
    setTimeWindow(persona.timeWindow);
    const tmpl = TEMPLATES.find(x => x.id === persona.template);
    if (tmpl) {
      const sel = {};
      const vizm = {};
      tmpl.metrics.forEach(mid => {
        sel[mid] = true;
        const m = METRICS.find(x => x.id === mid);
        vizm[mid] = m?.defaultViz;
      });
      setSelected(sel);
      setVizMap(vizm);
    }
    // eslint-disable-next-line
  }, [t.persona]);

  // Selected metrics + viz per metric
  const initialTmpl = TEMPLATES.find(x => x.id === persona.template);
  const initSelected = {};
  const initVizMap = {};
  initialTmpl.metrics.forEach(mid => {
    initSelected[mid] = true;
    const m = METRICS.find(x => x.id === mid);
    initVizMap[mid] = m?.defaultViz;
  });
  const [selected, setSelected] = useState(initSelected);
  const [vizMap, setVizMap] = useState(initVizMap);

  const selectedMetrics = useMemo(
    () => METRICS.filter(m => selected[m.id]),
    [selected]
  );

  const handleSelectTemplate = (tid) => {
    setSelectedTemplate(tid);
    const tmpl = TEMPLATES.find(x => x.id === tid);
    if (!tmpl) return;
    setTimeWindow(tmpl.window);
    // Templates can dictate the layout (e.g., the scorecard template forces
    // layout = "scorecard"); otherwise reset to a sensible default.
    if (tmpl.layout === "scorecard") setLayout("scorecard");
    else if (layout === "scorecard") setLayout("single");
    const sel = {}; const v = {};
    tmpl.metrics.forEach(mid => {
      sel[mid] = true;
      const m = METRICS.find(x => x.id === mid);
      v[mid] = m?.defaultViz;
    });
    setSelected(sel); setVizMap(v);
    // Smoothly slide the user toward the time/metrics zone
    setTimeout(() => { const el = document.getElementById("time-zone"); if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 80, behavior: "smooth" }); }, 60);
  };

  // Effective cap: scorecard lifts to the hard ceiling so users can curate
  // the full 5-domain set; everything else holds the 6-metric recommended limit.
  const effectiveMetricCap = layout === "scorecard" ? MAX_METRICS_HARD_CAP : MAX_METRICS;

  const handleToggleMetric = (id) => {
    const m = METRICS.find(x => x.id === id);
    if (m.comingSoon) return;
    setSelected(prev => {
      const next = { ...prev };
      if (next[id]) {
        delete next[id];
      } else {
        if (Object.keys(prev).length >= effectiveMetricCap) return prev;
        next[id] = true;
      }
      return next;
    });
    setVizMap(prev => prev[id] ? prev : { ...prev, [id]: m.defaultViz });
    setSelectedTemplate(null); // diverging from template
  };

  const handleSetViz = (id, v) => setVizMap(prev => ({ ...prev, [id]: v }));
  const handleRemove = (id) => {
    setSelected(prev => { const n = { ...prev }; delete n[id]; return n; });
    setSelectedTemplate(null);
  };

  // Nutrition facts modal
  const [infoMetricId, setInfoMetricId] = useState(null);
  const infoMetric = METRICS.find(m => m.id === infoMetricId);

  // Generation overlay
  const [generating, setGenerating] = useState(false);
  const handleGenerate = () => setGenerating(true);

  // Snapshot the live manifest into a frozen, "enriched" version that the
  // dashboard view (and the HTML export) consume. The dashboard reads from
  // the snapshot — not from live builder state — so re-tweaking selections
  // doesn't mutate the dashboard underfoot.
  const buildEnrichedManifest = () => ({
    ...manifest.json,
    template_id: selectedTemplate || null,
    manifest_version: "1.0",
    generated_at: new Date().toISOString()
  });

  // Primary: navigate to the in-app dashboard view (fresh — not a saved report).
  const handleView = () => {
    setActiveManifest(buildEnrichedManifest());
    setActiveReportId(null);
    setActiveReportName(null);
    setActiveRefreshedAt(null);
    setGenerating(false);
    setViewMode("dashboard");
  };

  // Secondary: download a self-contained .html copy. Same code path as before.
  // Available from the generation overlay AND from the dashboard's header.
  const handleDownload = () => {
    const enriched = activeManifest || buildEnrichedManifest();
    const html = window.buildReportHtml(enriched, window.DUMMY_DATASET);
    const blob = new Blob([html], { type: "text/html" });
    const url  = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${window.reportFilename(enriched)}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  const handleBackToBuilder = () => setViewMode("build");

  // ---- Saved-report handlers --------------------------------------------
  // Default name template for a fresh save: "<title> · <short date>".
  const defaultReportName = (m) => {
    const d = new Date();
    const stamp = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return `${window.AGG.reportTitle(m)} · ${stamp}`;
  };

  const handleSaveReport = () => {
    const m = activeManifest || buildEnrichedManifest();
    const id = window.ReportStore.save({
      id: activeReportId || undefined,                 // upsert if already saved
      name: activeReportName || defaultReportName(m),
      manifest: m,
      dataRef: { source: "embedded" }
    });
    const rec = window.ReportStore.get(id);            // canonical record (incl. timestamps)
    setActiveReportId(id);
    setActiveReportName(rec ? rec.name : null);
    setActiveRefreshedAt(rec ? rec.dataRefreshedAt : null);
    setActiveManifest(m);
    refreshSavedList();
    return id;
  };

  const handleRenameActiveReport = (next) => {
    if (!activeReportId) return;
    window.ReportStore.rename(activeReportId, next);
    setActiveReportName(next);
    refreshSavedList();
  };

  const handleRefreshActiveReport = async () => {
    if (!activeReportId) return;
    const rec = await window.ReportStore.refreshData(activeReportId);
    if (rec) setActiveRefreshedAt(rec.dataRefreshedAt);
    refreshSavedList();
  };

  const handleOpenSavedReport = (id) => {
    const rec = window.ReportStore.get(id);
    if (!rec) return;
    setActiveManifest(rec.manifest);
    setActiveReportId(rec.id);
    setActiveReportName(rec.name);
    setActiveRefreshedAt(rec.dataRefreshedAt);
    setTab("build");
    setViewMode("dashboard");
    // Background refresh — today a no-op, tomorrow a Fabric pull.
    window.ReportStore.refreshData(id).then(updated => {
      if (updated) setActiveRefreshedAt(updated.dataRefreshedAt);
      refreshSavedList();
    });
  };

  // Hydrate builder state from a saved manifest. Reverse of the manifest.json
  // builder in the useMemo below — keep these two in sync as the manifest
  // schema grows.
  const VIZ_DISPLAY_FROM_NORM = {
    trend_line: "Trend line",
    status_donut: "Status donut",
    priority_donut: "Priority donut",
    bar_by_team: "Bar by team",
    bar_by_service: "Bar by service",
    heatmap: "Heatmap",
    aging_waterfall: "Aging waterfall",
    globe_view: "Globe view"
  };

  const handleEditSavedReport = (id) => {
    const rec = window.ReportStore.get(id);
    if (!rec || !rec.manifest) return;
    const m = rec.manifest;
    setSelectedTemplate(m.template_id || null);
    setTimeWindow((m.time_window && m.time_window.value) || "90d");
    setLayout(m.layout === "scorecard" ? "scorecard"
            : m.layout === "multi_tab" ? "multi" : "single");
    setTheme(m.theme === "modern_dark" ? "dark"
            : m.theme === "minimal_print" ? "print"
            : "light");
    setAdvFilters({
      priority: (m.filters && m.filters.priority) || "all",
      service:  (m.filters && m.filters.service_group) || "all",
      region:   (m.filters && m.filters.region) || "all",
      refresh:  (m.filters && m.filters.refresh) || "hourly",
      csv: true, pdf: true, email: false
    });
    const sel = {}, viz = {};
    (m.metrics || []).forEach(x => {
      sel[x.id] = true;
      viz[x.id] = VIZ_DISPLAY_FROM_NORM[x.viz] || x.viz;
    });
    setSelected(sel);
    setVizMap(viz);
    setActiveManifest(m);
    setActiveReportId(rec.id);
    setActiveReportName(rec.name);
    setActiveRefreshedAt(rec.dataRefreshedAt);
    setTab("build");
    setViewMode("build");
  };

  const handleDuplicateReport = (id) => {
    const rec = window.ReportStore.get(id);
    if (!rec) return;
    window.ReportStore.save({
      // no id → new uuid
      name: `${rec.name} (copy)`,
      manifest: rec.manifest,
      dataRef: rec.dataRef
    });
    refreshSavedList();
  };

  const handleDeleteReport = (id) => {
    const rec = window.ReportStore.get(id);
    const name = rec ? rec.name : "this report";
    if (!window.confirm(`Delete "${name}"? This can't be undone.`)) return;
    window.ReportStore.delete(id);
    if (id === activeReportId) {
      setActiveReportId(null);
      setActiveReportName(null);
      setActiveRefreshedAt(null);
    }
    refreshSavedList();
  };

  const handleRenameSavedReport = (id, next) => {
    window.ReportStore.rename(id, next);
    if (id === activeReportId) setActiveReportName(next);
    refreshSavedList();
  };

  const handleExportSavedReport = (id) => {
    const rec = window.ReportStore.get(id);
    if (!rec) return;
    const html = window.buildReportHtml(rec.manifest, window.DUMMY_DATASET);
    const blob = new Blob([html], { type: "text/html" });
    const url  = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${window.reportFilename(rec.manifest)}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    refreshSavedList();
  };

  // Domain filter
  const visibleMetrics = METRICS.filter(m => domainFilter === "all" || m.domain === domainFilter);

  // Apply concierge recommendation
  const handleAcceptRec = () => {
    handleSelectTemplate(persona.template);
    setTimeout(() => handleGenerate(), 280);
  };
  const handleCustomize = () => {
    const el = document.getElementById("templates-zone");
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 80, behavior: "smooth" });
  };
  const handleStartFresh = () => {
    setSelected({}); setVizMap({}); setSelectedTemplate(null);
    const el = document.getElementById("time-zone");
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 80, behavior: "smooth" });
  };

  // Lightweight KPI snapshot fed into Ask Instead's answer-mode context.
  // Window-aware against the canned dataset; cheap to recompute on builder changes.
  const askKpis = useMemo(() => {
    const ds = window.DUMMY_DATASET;
    if (!ds || !window.AGG) return null;
    const days = window.AGG.parsePresetToDays(timeWindow) || 30;
    const rows = window.AGG.windowedRows(ds.daily, days, null);
    return window.AGG.kpisOver(rows,
      { priority: advFilters.priority, service_group: advFilters.service, region: advFilters.region },
      ds.shapes);
  }, [timeWindow, advFilters.priority, advFilters.service, advFilters.region]);

  // Apply an LLM-produced (or rules-based) manifest fragment from Ask Instead.
  // fragment = { metrics: [{id, viz}], time_window: {value}, template_id, ... }
  const applyManifestFragment = (fragment) => {
    if (!fragment) return;
    if (fragment.metrics && fragment.metrics.length) {
      const sel = {}, viz = {};
      fragment.metrics.forEach(m => {
        if (!m || !m.id) return;
        const metric = METRICS.find(x => x.id === m.id);
        if (!metric || metric.comingSoon) return;
        sel[m.id] = true;
        viz[m.id] = VIZ_DISPLAY_FROM_NORM[(m.viz || "").toLowerCase()] || metric.defaultViz || "Trend line";
      });
      setSelected(sel); setVizMap(viz);
    }
    if (fragment.time_window && fragment.time_window.value) {
      setTimeWindow(fragment.time_window.value);
    }
    if (fragment.template_id) {
      setSelectedTemplate(fragment.template_id);
      // Layout follows the template (scorecard sets its own).
      const tmpl = TEMPLATES.find(t => t.id === fragment.template_id);
      if (tmpl && tmpl.layout === "scorecard") setLayout("scorecard");
      else if (layout === "scorecard") setLayout("single");
    } else {
      setSelectedTemplate(null);
    }
    setTimeout(() => {
      const el = document.getElementById("time-zone");
      if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 80, behavior: "smooth" });
    }, 60);
  };

  // Manifest preview
  const manifest = useMemo(() => ({
    window: TIME_WINDOWS.find(w => w.id === timeWindow)?.label || timeWindow,
    // Display-only viz: in scorecard mode the per-metric viz pickers are
    // irrelevant (the scorecard renders gauge/radar/domain cards regardless),
    // so the order bar + receipt show "Scorecard" instead of "Trend line" /
    // "Bar by team" / etc. The JSON manifest below keeps the underlying viz
    // hint so a later switch to single-page layout doesn't lose it.
    metrics: selectedMetrics.map(m => ({
      id: m.id, name: m.name, category: m.category,
      viz: layout === "scorecard" ? "Scorecard" : (vizMap[m.id] || m.defaultViz)
    })),
    json: {
      user: persona.name,
      role: persona.role,
      intent: persona.id === "exec" ? "monitor_health" : persona.id === "manager" ? "audit_routing" : "deep_analysis",
      domains: ["incident"],
      metrics: selectedMetrics.map(m => ({ id: m.id, viz: (vizMap[m.id] || m.defaultViz)?.toLowerCase().replace(/\s+/g, "_") })),
      time_window: { type: "preset", value: timeWindow },
      theme: theme === "dark" ? "modern_dark" : theme === "print" ? "minimal_print" : "brand_light",
      layout: layout === "scorecard" ? "scorecard"
            : layout === "multi"     ? "multi_tab"
            : "single_page",
      filters: { priority: advFilters.priority, service_group: advFilters.service, region: advFilters.region, refresh: advFilters.refresh }
    }
  }), [persona, timeWindow, selectedMetrics, vizMap, theme, layout, advFilters]);

  return (
    <div className="app">
      <Header
        persona={persona}
        tab={tab}
        onTab={(id) => {
          setTab(id);
          setViewMode("build");
          if (id === "reports") refreshSavedList();
        }}
        onChangePersona={(id) => {
          setTweak("persona", id);
          // Drop out of any in-flight dashboard view so the new persona's
          // recommendation lands cleanly on the builder.
          setViewMode("build");
          setTab("build");
        }}
      />

      {viewMode === "dashboard" && activeManifest && (
        <Dashboard
          manifest={activeManifest}
          dataset={window.DUMMY_DATASET}
          theme={dashboardTheme}
          onBack={handleBackToBuilder}
          onExportHtml={handleDownload}
          savedReportId={activeReportId}
          savedName={activeReportName}
          dataRefreshedAt={activeRefreshedAt}
          onSave={handleSaveReport}
          onRename={handleRenameActiveReport}
          onRefresh={handleRefreshActiveReport}
        />
      )}

      {viewMode === "build" && tab === "build" && (
        <main>
          <Concierge persona={persona} template={TEMPLATES.find(x => x.id === persona.template)}
            onAccept={handleAcceptRec}
            onCustomize={handleCustomize}
            onStart={handleStartFresh} />

          <div style={{ marginTop: 28 }}>
            <AskInstead
              persona={persona}
              kpis={askKpis}
              windowLabel={TIME_WINDOWS.find(w => w.id === timeWindow)?.label || "the recent window"}
              onApply={applyManifestFragment}
            />
          </div>

          <section className="section" id="templates-zone">
            <div className="section-hdr">
              <div className="left">
                <span className="eyebrow">House Specials</span>
                <h2>Curated <em>templates</em></h2>
              </div>
              <div className="right">
                Pre-arranged report configurations the analytics team keeps polished. Pick one as a starting point — tailor anything below.
              </div>
            </div>
            <Templates
              selectedId={selectedTemplate}
              recommendedId={persona.template}
              onSelect={handleSelectTemplate} />
          </section>

          <section className="section" id="time-zone">
            <div className="section-hdr">
              <div className="left">
                <span className="eyebrow">Build Your Own</span>
                <h2>Hand-pick the <em>menu</em></h2>
              </div>
              <div className="right">
                {layout === "scorecard"
                  ? <>Curate the metrics that feed the scorecard's 5-domain score. The cap lifts in scorecard mode — pick as many as you'd like to include.</>
                  : <>Choose up to {MAX_METRICS} metrics and the chart that suits each best. Every metric carries its full ingredient label.</>}
              </div>
            </div>

            <TimeRow value={timeWindow} onChange={(v) => { setTimeWindow(v); setSelectedTemplate(null); }} />
            <DomainFilter value={domainFilter} onChange={setDomainFilter} />

            <MetricTable
              metrics={visibleMetrics}
              selected={selected}
              vizMap={vizMap}
              atMax={Object.keys(selected).length >= effectiveMetricCap}
              hideVizRow={layout === "scorecard"}
              domainKey={domainFilter}
              pageSize={8}
              onToggle={handleToggleMetric}
              onSetViz={handleSetViz}
              onInfo={setInfoMetricId} />
          </section>

          {/* Customize disclosure */}
          <section className="disclosure" data-open={customizeOpen}>
            <button className="disclosure-hd" onClick={() => setCustomizeOpen(o => !o)} aria-expanded={customizeOpen}>
              <div>
                <div className="ttl">Customize <em>layout & theme</em></div>
                <div className="sub">Pick how the final report is shaped, and the dress it wears.</div>
              </div>
              <span className="chev"><Icon name="chev" size={18} /></span>
            </button>
            <div className="disclosure-body">
              <div style={{ marginBottom: 18 }}>
                <div className="eyebrow" style={{ marginBottom: 8 }}>Layout</div>
                {layout === "scorecard" ? (
                  <div style={{
                    background: "var(--paper-2)",
                    border: "1px dashed var(--line-strong)",
                    borderRadius: 12,
                    padding: "14px 16px",
                    fontSize: 12.5,
                    color: "var(--ink-soft)",
                    fontStyle: "italic",
                    fontFamily: "var(--font-display)"
                  }}>
                    The <em style={{ color: "var(--accent)" }}>Product Health Scorecard</em> template
                    sets its own layout — gauge, radar, and domain cards — so the layout picker is hidden
                    here. Pick a different template to choose between Single Page or Multi-Tab.
                  </div>
                ) : (
                  <div className="layout-row">
                    <div className={`layout-card single`} aria-selected={layout === "single"} onClick={() => setLayout("single")}>
                      <div className="preview"><div /><div /><div /></div>
                      <div className="nm">Single Page Summary</div>
                      <div className="ds">One scannable view — great for standups and executive briefings.</div>
                    </div>
                    <div className={`layout-card multi`} aria-selected={layout === "multi"} onClick={() => setLayout("multi")}>
                      <div className="preview"><div className="tabs"><span /><span /><span /></div><div className="body" /></div>
                      <div className="nm">Multi-Tab Deep Dive</div>
                      <div className="ds">Tabbed pages with drill-through, for analysts who want to investigate.</div>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <div className="eyebrow" style={{ marginBottom: 8 }}>Theme</div>
                <div className="theme-row">
                  {[
                    { id: "light", nm: "Bonvoy Cream", sb: "Light · brand-forward", cls: "tp-light" },
                    { id: "dark",  nm: "Concierge Midnight", sb: "Dark · operations / SOC", cls: "tp-dark" },
                    { id: "print", nm: "Letterpress", sb: "Minimal · print / PDF", cls: "tp-print" }
                  ].map(th => (
                    <div key={th.id} className="theme-card" aria-selected={theme === th.id} onClick={() => setTheme(th.id)}>
                      <div className={`preview ${th.cls}`}>
                        <div className="bar" />
                        <div className="body"><div /><div /><div /><div /></div>
                      </div>
                      <div className="label">{th.nm}<small>{th.sb}</small></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="disclosure" data-open={advancedOpen}>
            <button className="disclosure-hd" onClick={() => setAdvancedOpen(o => !o)} aria-expanded={advancedOpen}>
              <div>
                <div className="ttl">Advanced <em>options</em></div>
                <div className="sub">Filters, refresh cadence, and export formats. For when you really mean it.</div>
              </div>
              <span className="chev"><Icon name="chev" size={18} /></span>
            </button>
            <div className="disclosure-body">
              <div className="adv-grid">
                <div className="adv-field">
                  <label>Service group</label>
                  <select value={advFilters.service} onChange={e => setAdvFilters(f => ({ ...f, service: e.target.value }))}>
                    <option value="all">All service groups</option>
                    <option>Property Operations</option>
                    <option>Reservations Platform</option>
                    <option>Loyalty Platform</option>
                    <option>Corporate Systems</option>
                  </select>
                </div>
                <div className="adv-field">
                  <label>Priority</label>
                  <select value={advFilters.priority} onChange={e => setAdvFilters(f => ({ ...f, priority: e.target.value }))}>
                    <option value="all">All priorities</option>
                    <option>P1 + P2 only</option>
                    <option>P3 + P4 only</option>
                  </select>
                </div>
                <div className="adv-field">
                  <label>Region</label>
                  <select value={advFilters.region} onChange={e => setAdvFilters(f => ({ ...f, region: e.target.value }))}>
                    <option value="all">All regions</option>
                    <option>Americas</option>
                    <option>EMEA</option>
                    <option>APAC</option>
                  </select>
                </div>
                <div className="adv-field">
                  <label>Refresh cadence</label>
                  <div className="seg">
                    {["realtime", "hourly", "daily", "weekly"].map(c => (
                      <button key={c} aria-pressed={advFilters.refresh === c}
                        onClick={() => setAdvFilters(f => ({ ...f, refresh: c }))}>
                        {c[0].toUpperCase() + c.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 24 }}>
                <div className="eyebrow" style={{ marginBottom: 6 }}>Export & delivery</div>
                {[
                  { k: "csv", nm: "CSV download", ds: "Raw data file alongside the rendered report." },
                  { k: "pdf", nm: "PDF generation", ds: "Print-ready PDF beside the interactive HTML." },
                  { k: "email", nm: "Scheduled email delivery", ds: "Send a fresh copy on the cadence above." }
                ].map(opt => (
                  <div key={opt.k} className="toggle-row">
                    <div>
                      <div className="nm">{opt.nm}</div>
                      <div className="ds">{opt.ds}</div>
                    </div>
                    <button className="toggle"
                      aria-pressed={!!advFilters[opt.k]}
                      onClick={() => setAdvFilters(f => ({ ...f, [opt.k]: !f[opt.k] }))} />
                  </div>
                ))}
              </div>
            </div>
          </section>

          <div className="footer-credit">
            An idea by <em>Adam Young</em> · served warm at CodeFest
          </div>

          <OrderBar
            window={timeWindow}
            selectedMetrics={selectedMetrics}
            vizMap={
              layout === "scorecard"
                // In scorecard mode every chip reads "Scorecard" — per-metric
                // viz pickers don't influence the scorecard's render.
                ? Object.fromEntries(selectedMetrics.map(m => [m.id, "Scorecard"]))
                : vizMap
            }
            onRemove={handleRemove}
            onGenerate={handleGenerate}
            persona={persona}
            max={MAX_METRICS}
          />
        </main>
      )}

      {tab === "reports" && viewMode === "build" && (
        <MyReports
          reports={savedReports}
          onOpen={handleOpenSavedReport}
          onEdit={handleEditSavedReport}
          onDuplicate={handleDuplicateReport}
          onRename={handleRenameSavedReport}
          onDelete={handleDeleteReport}
          onExport={handleExportSavedReport}
        />
      )}
      {tab === "market" && <MarketplaceTab />}

      {infoMetric && <NutritionFacts metric={infoMetric} onClose={() => setInfoMetricId(null)} />}
      {generating && (
        <GenerationOverlay
          manifest={manifest}
          onClose={() => setGenerating(false)}
          onView={handleView}
          onDownload={handleDownload}
        />
      )}

      <TweaksPanel>
        <TweakSection label="Atmosphere" />
        <TweakColor label="Theme" value={t.theme}
          options={[
            ["#faf6ec", "#1f1a12", "#8a5a2b"],
            ["#0e1722", "#d4a657", "#1d2c3f"],
            ["#f8efe5", "#9a3b25", "#2a1a14"],
          ]}
          onChange={(v) => {
            const map = { 0: "cream", 1: "midnight", 2: "terracotta" };
            const idx = [
              ["#faf6ec","#1f1a12","#8a5a2b"],
              ["#0e1722","#d4a657","#1d2c3f"],
              ["#f8efe5","#9a3b25","#2a1a14"]
            ].findIndex(p => p.join() === v.join());
            setTweak("theme", map[idx] || "cream");
          }} />

        <TweakRadio label="Density" value={t.density}
          options={["compact", "regular", "comfy"]}
          onChange={(v) => setTweak("density", v)} />

        <TweakSelect label="Type" value={t.fonts}
          options={[
            { value: "serif-sans", label: "Newsreader + Geist" },
            { value: "grotesk", label: "Geist sans only" },
            { value: "editorial", label: "Instrument + Geist" }
          ]}
          onChange={(v) => setTweak("fonts", v)} />

        <TweakSection label="Concierge persona" />
        <TweakSelect label="Persona" value={t.persona}
          options={[
            { value: "exec",    label: "VP / Executive" },
            { value: "manager", label: "FLEX Manager" },
            { value: "analyst", label: "Senior Analyst" }
          ]}
          onChange={(v) => setTweak("persona", v)} />

        <TweakSection label="Concierge brain" />
        <ConciergeBrainTweaks />
      </TweaksPanel>
    </div>
  );
}

// -- Stub tab (Marketplace — still Coming Soon) --------------------------
// -- Concierge brain tweaks panel section --------------------------------
// API-key input + status indicator + Test button. Persists to localStorage
// through window.AskConcierge.setApiKey().
function ConciergeBrainTweaks() {
  const initial = (window.AskConcierge && window.AskConcierge.getApiKey()) || "";
  const [val, setVal] = useState(initial);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [tick, setTick] = useState(0);   // bumps so the status pill re-reads

  const commit = (next) => {
    if (!window.AskConcierge) return;
    window.AskConcierge.setApiKey(next || null);
    setTick(k => k + 1);
  };
  const handleTest = async () => {
    if (!window.AskConcierge) return;
    setTesting(true); setTestResult(null);
    try {
      const r = await window.AskConcierge.testConnection();
      setTestResult(r);
    } finally {
      setTesting(false);
      setTick(k => k + 1);
    }
  };
  const handleClear = () => { setVal(""); commit(""); setTestResult(null); };

  const brain = window.AskConcierge
    ? { kind: window.AskConcierge.statusKind, label: window.AskConcierge.statusLabel }
    : { kind: "rules", label: "Rules mode" };

  return (
    <>
      <div className="twk-row" key={tick}>
        <div className="twk-lbl">
          <span>Status</span>
          <span className="twk-val" style={{
            color: brain.kind === "ai" ? "var(--ok)" : brain.kind === "fail" ? "var(--crit)" : "var(--ink-mute)"
          }}>{brain.label}</span>
        </div>
      </div>
      <div className="twk-row">
        <div className="twk-lbl"><span>Anthropic API key</span></div>
        <input
          className="twk-field"
          type="password"
          placeholder="sk-ant-…"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onBlur={(e) => commit(e.target.value.trim())}
        />
      </div>
      <div className="twk-row twk-row-h">
        <button className="twk-btn" onClick={handleTest} disabled={!val.trim() || testing}>
          {testing ? "Testing…" : "Test"}
        </button>
        <button className="twk-btn secondary" onClick={handleClear} disabled={!val}>
          Clear
        </button>
      </div>
      {testResult && (
        <div className="twk-row">
          <div className="twk-lbl">
            <span style={{
              color: testResult.ok ? "var(--ok)" : "var(--crit)",
              fontSize: 11
            }}>
              {testResult.ok ? "✓ Connection OK" : "✗ " + (testResult.error || "Failed")}
            </span>
          </div>
        </div>
      )}
      <div className="twk-row">
        <div className="twk-lbl">
          <span style={{ fontStyle: "italic", color: "var(--ink-mute)", fontSize: 10, lineHeight: 1.4 }}>
            Key is stored in your browser only. Production routes Concierge calls through a backend gateway.
          </span>
        </div>
      </div>
    </>
  );
}

function MarketplaceTab() {
  return (
    <main>
      <div className="section-hdr" style={{ marginTop: 8 }}>
        <div className="left">
          <span className="eyebrow">Coming Soon</span>
          <h2>The <em>Template Marketplace</em></h2>
        </div>
        <div className="right">
          A shared library where teams publish, browse, and clone report configurations.
        </div>
      </div>
      <div style={{
        background: "var(--paper)", border: "1px dashed var(--line-strong)",
        borderRadius: 18, padding: 48,
        textAlign: "center", maxWidth: 720, margin: "40px auto"
      }}>
        <div style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 32, color: "var(--accent)" }}>
          Currently being plated
        </div>
        <p style={{ color: "var(--ink-soft)", maxWidth: "44ch", margin: "16px auto 24px", lineHeight: 1.55 }}>
          A shared kitchen where your team's most useful report recipes live — published, browsed, cloned, and remixed. TEC-curated specials at the top, your colleagues' work below.
        </p>
        <button className="btn btn-primary"><Icon name="bell" size={14} /> Notify me when it's served</button>
      </div>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
