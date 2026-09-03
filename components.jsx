// Reusable presentation components

const { useState, useEffect, useRef, useMemo } = React;

// ---- Header ------------------------------------------------------------
function Header({ persona, tab, onTab, onChangePersona }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapRef = useRef(null);

  // Close on outside click + Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setMenuOpen(false);
    };
    const onKey = (e) => { if (e.key === "Escape") setMenuOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const personaList = ["exec", "manager", "analyst"]
    .map(id => PERSONAS[id])
    .filter(Boolean);

  return (
    <header className="hdr">
      <a className="brand" href="#">
        <div className="brand-mark" aria-hidden><DataCafeMark /></div>
        <div>
          <div className="brand-name">Data <em>Cafe</em></div>
        </div>
      </a>
      <div className="brand-sub">Technology Experience Center</div>

      <nav className="nav" aria-label="Primary">
        {[
          { id: "build",   label: "Build" },
          { id: "reports", label: "My Reports" },
          { id: "market",  label: "Marketplace", coming: true }
        ].map(t => (
          <button key={t.id} className="nav-btn"
            aria-current={tab === t.id ? "page" : undefined}
            onClick={() => onTab(t.id)}>
            {t.label}
            {t.coming && <span className="pill">Soon</span>}
          </button>
        ))}
      </nav>

      <div className="hdr-spacer" />

      <div className="hdr-actions">
        <button className="icon-btn" aria-label="Help"><Icon name="help" size={16} /></button>
        <button className="icon-btn" aria-label="Notifications"><Icon name="bell" size={16} /></button>
        <div className="user-chip-wrap" ref={wrapRef}>
          <button
            className="user-chip"
            aria-haspopup="menu"
            aria-expanded={menuOpen ? "true" : "false"}
            title="Switch perspective"
            onClick={() => setMenuOpen(o => !o)}>
            <div className="avatar">{persona.initials}</div>
            <div className="user-chip-id">
              <div className="who">{persona.name}</div>
              <div className="role">{persona.role}</div>
            </div>
            <Icon name="chev" size={12} className="user-chip-chev" />
          </button>
          {menuOpen && onChangePersona && (
            <div className="persona-menu" role="menu">
              <div className="persona-menu-head">Switch perspective</div>
              {personaList.map(p => {
                const active = p.id === persona.id;
                return (
                  <button
                    key={p.id}
                    role="menuitem"
                    className={"persona-menu-item" + (active ? " active" : "")}
                    onClick={() => { onChangePersona(p.id); setMenuOpen(false); }}>
                    <div className="avatar">{p.initials}</div>
                    <div className="persona-menu-text">
                      <div className="nm">{p.name}</div>
                      <div className="rl">{p.role}</div>
                    </div>
                    {active && <Icon name="check" size={13} className="persona-menu-check" />}
                  </button>
                );
              })}
              <div className="persona-menu-foot">
                A demo affordance — in production this comes from SSO.
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

// ---- Concierge zone ----------------------------------------------------
function Concierge({ persona, template, onAccept, onCustomize, onStart }) {
  return (
    <section className="concierge">
      <div className="concierge-inner">
        <div>
          <div className="concierge-id">
            <div className="concierge-avatar">C</div>
            <div className="label">
              <div className="nm">Insight Concierge</div>
              <div className="sb">On duty · {new Date().toLocaleDateString("en-US", { weekday: "long" })}</div>
            </div>
          </div>
          <h1 dangerouslySetInnerHTML={{ __html: persona.headline }} />
          <p className="lede">{persona.intent} Glance below — if it looks right, we're two clicks away.</p>
          <div className="concierge-actions">
            <button className="btn btn-primary" onClick={onAccept}>
              Looks good — generate <Icon name="arrow" size={14} className="arrow" />
            </button>
            <button className="btn btn-secondary" onClick={onCustomize}>Let me customize</button>
            <button className="btn btn-ghost" onClick={onStart}>Not what I need? Start fresh</button>
          </div>
        </div>

        <div className="rec-card">
          <div className="head">
            <h3>{template.name}</h3>
            <div className="stamp">Recommended</div>
          </div>

          <div className="row">
            <span className="k">Time window</span>
            <span className="v">Past {template.window === "90d" ? "90 days" : template.window === "60d" ? "60 days" : template.window === "30d" ? "30 days" : "7 days"}</span>
          </div>
          <div className="row">
            <span className="k">Layout</span>
            <span className="v">Single-page summary</span>
          </div>
          <div className="row">
            <span className="k">Theme</span>
            <span className="v">Brand · light</span>
          </div>
          <div className="row" style={{ alignItems: "flex-start", flexDirection: "column", gap: 6 }}>
            <span className="k">Includes</span>
            <div className="metric-list">
              {template.metrics.map(mid => {
                const m = METRICS.find(x => x.id === mid);
                return <span key={mid} className={`tag cat-${m.category}`}><span className="dot" />{m.name}</span>;
              })}
            </div>
          </div>

          <div className="rationale">"{persona.rationale}"</div>
        </div>
      </div>
    </section>
  );
}

// ---- Ask Instead -------------------------------------------------------
const ASK_SUGGESTIONS = [
  "How has incident routing changed this quarter?",
  "Why is reopen rate creeping up?",
  "Show me a five-domain executive snapshot",
  "How is self-service deflection trending?"
];

// Friendly metric name lookup — used by the build-mode result panel chip list.
function _metricName(id) {
  const m = (window.METRICS || []).find(x => x.id === id);
  return m ? m.name : id;
}

// Map a normalized window value to a human label.
function _winLabel(v) {
  if (!v) return "30 days";
  if (v === "7d") return "7 days"; if (v === "30d") return "30 days";
  if (v === "60d") return "60 days"; if (v === "90d") return "90 days";
  if (v === "custom") return "custom range";
  return v;
}

function AskInstead({ persona, kpis, windowLabel, onApply }) {
  const [val, setVal] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState(null); // { mode: "build"|"answer", ...payload }
  const [brainTick, setBrainTick] = useState(0);  // bump to re-read AskConcierge.statusLabel

  // Refresh the brain indicator periodically (catches API-key changes from the Tweaks panel).
  useEffect(() => {
    const t = setInterval(() => setBrainTick(k => k + 1), 1500);
    return () => clearInterval(t);
  }, []);

  const submit = async (text) => {
    const q = (text || "").trim();
    if (!q || !window.AskConcierge) return;
    setVal(q);
    setLoading(true);
    setResponse(null);
    try {
      const mode = await window.AskConcierge.classifyIntent(q);
      if (mode === "answer") {
        const r = await window.AskConcierge.answerQuestion(q, { persona, kpis, windowLabel });
        setResponse({ mode: "answer", text: r.text, source: r.source });
      } else {
        const r = await window.AskConcierge.buildManifestFromQuery(q, { persona });
        setResponse({ mode: "build", ...r });
      }
    } catch (e) {
      console.error("[AskInstead] submit failed", e);
      setResponse({ mode: "answer", text: "Something went wrong. Try again in a moment.", source: "rules" });
    } finally {
      setLoading(false);
      setBrainTick(k => k + 1);
    }
  };

  const onChangeInput = (e) => {
    setVal(e.target.value);
    if (response) setResponse(null);
  };

  const brain = window.AskConcierge
    ? { kind: window.AskConcierge.statusKind, label: window.AskConcierge.statusLabel }
    : { kind: "rules", label: "Rules mode" };

  return (
    <section className="ask">
      <div className="ask-row">
        <div className="ask-icon"><Icon name="sparkle" size={16} /></div>
        <input
          value={val}
          onChange={onChangeInput}
          onKeyDown={e => { if (e.key === "Enter" && val.trim() && !loading) submit(val); }}
          placeholder="Ask the concierge — &ldquo;Why is reopen rate creeping up?&rdquo;"
        />
        <button className="ask-go" aria-label="Ask" disabled={loading}
          onClick={() => val.trim() && !loading && submit(val)}>
          <Icon name={loading ? "sparkle" : "send"} size={14} />
        </button>
      </div>
      <div className="ask-suggestions">
        {ASK_SUGGESTIONS.map(s => (
          <button key={s} className="ask-suggestion" disabled={loading} onClick={() => submit(s)}>{s}</button>
        ))}
        {(() => {
          // The brain pill doubles as a one-click mode toggle: when a key is
          // configured, clicking it flips between AI mode and a forced-rules
          // override. When no key is set, the click is a no-op with a tooltip
          // that points at the Tweaks panel.
          const canToggle = brain.kind === "ai" || brain.kind === "fail" || brain.kind === "rules_override";
          const togglesTo = brain.kind === "rules_override" ? "AI mode" : "rules mode";
          const tooltip = canToggle
            ? `Currently ${brain.label}. Click to switch to ${togglesTo}.`
            : "AI mode requires an API key. Open the Tweaks panel → Concierge brain to set one.";
          const onClick = () => {
            if (!canToggle || !window.AskConcierge) return;
            window.AskConcierge.setForceRules(brain.kind !== "rules_override");
            setBrainTick(k => k + 1);
          };
          return (
            <button
              type="button"
              className={"ask-brain ask-brain-" + brain.kind}
              key={brainTick}
              title={tooltip}
              aria-label={tooltip}
              aria-pressed={brain.kind === "rules_override"}
              disabled={!canToggle}
              onClick={onClick}>
              <span className="brain-dot" />
              {brain.label}
            </button>
          );
        })()}
      </div>

      {loading && (
        <div className="ask-result ask-result-loading">
          <span className="pulse" />
          <div style={{ flex: 1, fontStyle: "italic" }}>
            {brain.kind === "ai" ? "Asking the concierge…" : "Interpreting…"}
          </div>
        </div>
      )}

      {!loading && response && response.mode === "build" && (
        <div className="ask-result">
          <span className="pulse" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <span className="interp"
              dangerouslySetInnerHTML={{ __html: (response.intent_summary || "").replace(/^Reads as/, "Reads as <em>").replace(/\.$/, "</em>.") }} />
            <div className="ask-chips">
              {(response.metrics || []).map(m => (
                <span key={m.id} className="ask-chip">{_metricName(m.id)}</span>
              ))}
              <span className="ask-chip ask-chip-win">{_winLabel(response.time_window && response.time_window.value)}</span>
            </div>
            {response.explanation && (
              <span className="ask-explain">{response.explanation}</span>
            )}
          </div>
          <button className="btn btn-secondary" onClick={() => onApply && onApply(response)}>Apply this →</button>
        </div>
      )}

      {!loading && response && response.mode === "answer" && (
        <div className="ask-result ask-result-answer">
          <div className="ask-bubble">
            <div className="ask-bubble-head">
              <span className="ask-bubble-icon"><Icon name="sparkle" size={11} /></span>
              <span>Insight Concierge</span>
              <span className={"ask-bubble-source ask-bubble-source-" + (response.source || "rules")}>
                {response.source === "ai" ? "AI" : "Rules"}
              </span>
            </div>
            <div className="ask-bubble-text">{response.text}</div>
          </div>
        </div>
      )}
    </section>
  );
}

// ---- Templates grid ----------------------------------------------------
function Templates({ selectedId, onSelect, recommendedId }) {
  return (
    <div className="templates">
      {TEMPLATES.map(t => (
        <article key={t.id} className="tmpl"
          aria-selected={selectedId === t.id}
          onClick={() => onSelect(t.id)}>
          <div className="glyph"><Icon name={t.glyph} size={22} /></div>
          {t.id === recommendedId && (
            <div className="recommended-flag"><Icon name="star" size={11} />Concierge pick</div>
          )}
          <h3>{t.name}</h3>
          <div className="desc">{t.desc}</div>
          <div className="meta">
            <div className="pills">
              {t.metrics.slice(0, 4).map(mid => {
                const m = METRICS.find(x => x.id === mid);
                return <span key={mid} className={`tag cat-${m.category}`} title={m.name}><span className="dot" /></span>;
              })}
              {t.metrics.length > 4 && <span className="pill-mini">+{t.metrics.length - 4}</span>}
            </div>
            <span className="window">{t.window === "7d" ? "7 days" : t.window === "30d" ? "30 days" : t.window === "60d" ? "60 days" : "90 days"}</span>
          </div>
        </article>
      ))}
    </div>
  );
}

// ---- Time row ----------------------------------------------------------
function TimeRow({ value, onChange }) {
  return (
    <div className="time-row">
      <span className="label">Time window</span>
      {TIME_WINDOWS.map(t => (
        <button key={t.id} className="chip"
          aria-pressed={value === t.id}
          onClick={() => onChange(t.id)}>{t.label}</button>
      ))}
    </div>
  );
}

// ---- Domain filter -----------------------------------------------------
function DomainFilter({ value, onChange }) {
  const counts = useMemo(() => {
    const c = { all: METRICS.length };
    METRICS.forEach(m => { c[m.domain] = (c[m.domain] || 0) + 1; });
    return c;
  }, []);
  return (
    <div className="domain-filter" role="tablist">
      {DOMAINS.map(d => (
        <button key={d.id} role="tab"
          aria-pressed={value === d.id}
          onClick={() => onChange(d.id)}>
          {d.name}
          <span className="count">{counts[d.id] || 0}</span>
        </button>
      ))}
    </div>
  );
}

// ---- Metric card -------------------------------------------------------
function MetricCard({ metric, selected, viz, onToggle, onSetViz, onInfo, atMax, hideVizRow }) {
  const disabled = metric.comingSoon;
  const cantAdd = !selected && atMax;
  return (
    <article className={`metric ${disabled ? "disabled" : ""}`}
      aria-selected={selected}
      onClick={() => { if (!disabled && !cantAdd) onToggle(); }}
      title={cantAdd ? "Maximum 6 metrics per report" : undefined}
      style={cantAdd ? { cursor: "not-allowed", opacity: .55 } : {}}>
      <div className="top">
        <div className="cat"><span className="dot" style={{ background: `var(--cat-${metric.category}, var(--accent))` }} />{metric.category}</div>
        <div className="actions">
          <button className="info-btn" aria-label={`About ${metric.name}`}
            onClick={(e) => { e.stopPropagation(); onInfo(); }}>
            <Icon name="info" size={13} />
          </button>
          {!disabled && (
            <button className="check" aria-label={selected ? "Remove metric" : "Add metric"}
              onClick={(e) => { e.stopPropagation(); if (!cantAdd) onToggle(); }}>
              {selected ? <Icon name="check" size={13} /> : <Icon name="plus" size={13} />}
            </button>
          )}
        </div>
      </div>
      <div className="name">{metric.name}</div>
      <div className="descr">{metric.desc}</div>
      <div className="value-row">
        {disabled
          ? <span className="coming">Coming soon</span>
          : (<>
              <span className="value">{metric.value}</span>
              <span className="value-label">{metric.unit} · current</span>
            </>)
        }
      </div>
      {selected && metric.vizOptions.length > 0 && !hideVizRow && (
        <div className="viz-row">
          <span className="label">Visual</span>
          {metric.vizOptions.map(v => (
            <button key={v} className="viz-btn"
              aria-pressed={viz === v}
              onClick={(e) => { e.stopPropagation(); onSetViz(v); }}>
              <Icon name={VIZ_ICON[v] || "spark"} size={11} /> {v}
            </button>
          ))}
        </div>
      )}
    </article>
  );
}

// ---- Paginated metric table -------------------------------------------
// Replaces the long scrolling card grid with a compact, paged table so the
// "Build your own" section stays short. Selection / viz / info behaviour is
// identical to MetricCard — only the presentation changes.
const METRIC_TABLE_CSS = `
.mt { border: 1px solid var(--line); border-radius: 14px; overflow: hidden; background: var(--paper); }
.mt-head, .mt-row {
  display: grid;
  grid-template-columns: 44px minmax(0,1.9fr) 0.7fr 0.8fr 40px;
  gap: 14px; align-items: center;
}
.mt-head {
  padding: 11px 18px; border-bottom: 1px solid var(--line);
  background: var(--paper-2);
  font-family: var(--font-mono); font-size: 9px; letter-spacing: .14em;
  text-transform: uppercase; color: var(--ink-mute);
}
.mt-head .r { text-align: right; }
.mt-item { border-bottom: 1px dashed color-mix(in oklab, var(--line) 70%, transparent); }
.mt-item:last-child { border-bottom: 0; }
.mt-item[aria-selected="true"] { background: color-mix(in oklab, var(--accent) 6%, transparent); box-shadow: inset 3px 0 0 var(--accent); }
.mt-row { padding: 12px 18px; cursor: pointer; transition: background .12s; }
.mt-row:hover { background: color-mix(in oklab, var(--ink) 3%, transparent); }
.mt-item.disabled .mt-row { cursor: default; opacity: .55; }
.mt-check {
  width: 26px; height: 26px; border-radius: 50%; border: 1px solid var(--line-strong);
  display: grid; place-items: center; color: var(--ink-mute); background: transparent; flex-shrink: 0;
}
.mt-item[aria-selected="true"] .mt-check { background: var(--accent); color: var(--accent-ink, #fff); border-color: var(--accent); }
.mt-name { min-width: 0; }
.mt-name .nm { font-family: var(--font-display); font-size: 15.5px; font-weight: 500; color: var(--ink); line-height: 1.2; }
.mt-name .desc { font-size: 11.5px; color: var(--ink-soft); line-height: 1.35; margin-top: 2px;
  overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; }
.mt-cat { font-family: var(--font-mono); font-size: 9.5px; letter-spacing: .12em; text-transform: uppercase; color: var(--ink-mute);
  display: flex; align-items: center; gap: 6px; }
.mt-cat .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); flex-shrink: 0; }
.mt-val { text-align: right; }
.mt-val .v { font-family: var(--font-display); font-size: 16px; font-weight: 500; color: var(--ink); font-variant-numeric: tabular-nums; }
.mt-val .u { display: block; font-family: var(--font-mono); font-size: 8.5px; letter-spacing: .1em; text-transform: uppercase; color: var(--ink-mute); }
.mt-val .coming { font-family: var(--font-mono); font-size: 9px; letter-spacing: .12em; text-transform: uppercase; color: var(--ink-mute); }
.mt-info {
  appearance: none; background: transparent; border: 1px solid var(--line); color: var(--ink-mute);
  width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; cursor: pointer; justify-self: end;
}
.mt-info:hover { color: var(--ink); border-color: var(--line-strong); }
.mt-viz {
  display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
  padding: 0 18px 14px 76px;
}
.mt-viz .vlabel { font-family: var(--font-mono); font-size: 9px; letter-spacing: .14em; text-transform: uppercase; color: var(--ink-mute); margin-right: 2px; }
.mt-viz .vbtn {
  appearance: none; background: var(--paper); border: 1px solid var(--line); color: var(--ink-soft);
  font: inherit; font-size: 11.5px; padding: 5px 10px; border-radius: 999px; cursor: pointer;
  display: inline-flex; align-items: center; gap: 5px;
}
.mt-viz .vbtn[aria-pressed="true"] { background: var(--ink); color: var(--paper); border-color: var(--ink); }
[data-theme="midnight"] .mt-viz .vbtn[aria-pressed="true"] { background: var(--accent); color: var(--bg); border-color: var(--accent); }
.mt-foot {
  display: flex; align-items: center; justify-content: space-between; gap: 14px;
  padding: 12px 18px; border-top: 1px solid var(--line); background: var(--paper-2);
}
.mt-foot .count { font-family: var(--font-mono); font-size: 10px; letter-spacing: .08em; text-transform: uppercase; color: var(--ink-mute); }
.mt-pager { display: flex; align-items: center; gap: 4px; }
.mt-pager button {
  appearance: none; background: var(--paper); border: 1px solid var(--line); color: var(--ink-soft);
  font: inherit; font-size: 12px; min-width: 30px; height: 30px; padding: 0 8px; border-radius: 8px; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
}
.mt-pager button:hover:not(:disabled) { border-color: var(--line-strong); color: var(--ink); }
.mt-pager button[aria-current="true"] { background: var(--ink); color: var(--paper); border-color: var(--ink); }
[data-theme="midnight"] .mt-pager button[aria-current="true"] { background: var(--accent); color: var(--bg); border-color: var(--accent); }
.mt-pager button:disabled { opacity: .4; cursor: default; }
@media (max-width: 700px) {
  .mt-head, .mt-row { grid-template-columns: 36px 1.4fr 40px; }
  .mt-head .c-cat, .mt-head .c-val, .mt-cat, .mt-val { display: none; }
  .mt-viz { padding-left: 18px; }
}
`;
function injectMetricTableCss() {
  if (document.getElementById("metric-table-styles")) return;
  const tag = document.createElement("style");
  tag.id = "metric-table-styles";
  tag.textContent = METRIC_TABLE_CSS;
  document.head.appendChild(tag);
}

function MetricTable({ metrics, selected, vizMap, onToggle, onSetViz, onInfo, atMax, hideVizRow, domainKey, pageSize }) {
  useEffect(injectMetricTableCss, []);
  const size = pageSize || 8;
  const [page, setPage] = useState(0);

  // Reset to the first page whenever the domain filter (and thus the metric
  // list) changes, so the user never lands on an out-of-range page.
  useEffect(() => { setPage(0); }, [domainKey]);

  const total = metrics.length;
  const pageCount = Math.max(1, Math.ceil(total / size));
  const safePage = Math.min(page, pageCount - 1);
  const start = safePage * size;
  const pageItems = metrics.slice(start, start + size);
  const selectedCount = Object.keys(selected || {}).length;

  return (
    <div className="mt">
      <div className="mt-head">
        <span />
        <span>Metric</span>
        <span className="c-cat">Category</span>
        <span className="c-val r">Current</span>
        <span />
      </div>
      <div className="mt-body">
        {pageItems.map(m => {
          const isSel = !!selected[m.id];
          const disabled = m.comingSoon;
          const cantAdd = !isSel && atMax;
          const showViz = isSel && !hideVizRow && m.vizOptions && m.vizOptions.length > 0;
          const rowClick = () => { if (!disabled && !cantAdd) onToggle(m.id); };
          return (
            <div key={m.id} className={"mt-item" + (disabled ? " disabled" : "")} aria-selected={isSel}>
              <div className="mt-row" onClick={rowClick}
                title={cantAdd ? "Maximum metrics reached" : undefined}
                style={cantAdd ? { cursor: "not-allowed", opacity: .6 } : undefined}>
                <span className="mt-check">
                  {disabled ? <Icon name="minus" size={12} /> : isSel ? <Icon name="check" size={13} /> : <Icon name="plus" size={13} />}
                </span>
                <div className="mt-name">
                  <div className="nm">{m.name}</div>
                  <div className="desc">{m.desc}</div>
                </div>
                <div className="mt-cat"><span className="dot" style={{ background: `var(--cat-${m.category}, var(--accent))` }} />{m.category}</div>
                <div className="mt-val">
                  {disabled
                    ? <span className="coming">Soon</span>
                    : <><span className="v">{m.value}</span><span className="u">{m.unit}</span></>}
                </div>
                <button className="mt-info" aria-label={`About ${m.name}`}
                  onClick={(e) => { e.stopPropagation(); onInfo(m.id); }}>
                  <Icon name="info" size={13} />
                </button>
              </div>
              {showViz && (
                <div className="mt-viz">
                  <span className="vlabel">Visual</span>
                  {m.vizOptions.map(v => (
                    <button key={v} className="vbtn" aria-pressed={(vizMap[m.id] || m.defaultViz) === v}
                      onClick={(e) => { e.stopPropagation(); onSetViz(m.id, v); }}>
                      <Icon name={VIZ_ICON[v] || "spark"} size={11} /> {v}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-foot">
        <span className="count">
          {total === 0 ? "No metrics" : `Showing ${start + 1}–${Math.min(start + size, total)} of ${total}`}
          {selectedCount > 0 ? ` · ${selectedCount} selected` : ""}
        </span>
        {pageCount > 1 && (
          <div className="mt-pager">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={safePage === 0} aria-label="Previous page">‹</button>
            {Array.from({ length: pageCount }, (_, i) => (
              <button key={i} aria-current={i === safePage ? "true" : undefined} onClick={() => setPage(i)}>{i + 1}</button>
            ))}
            <button onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))} disabled={safePage === pageCount - 1} aria-label="Next page">›</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Nutrition Facts modal --------------------------------------------
function NutritionFacts({ metric, onClose }) {
  useEffect(() => {
    const onKey = e => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!metric) return null;
  const n = metric.nutrition;
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="nutrition" onClick={e => e.stopPropagation()} role="dialog" aria-label={`Metric details for ${metric.name}`}>
        <div className="top">
          <div>
            <div className="label-mark">Metric Facts</div>
            <h3>{metric.name}</h3>
            <div className="descr">{metric.desc}</div>
          </div>
          <button className="close" aria-label="Close" onClick={onClose}><Icon name="x" size={14} /></button>
        </div>

        <div className="servings">
          <span className="lk">Current value</span>
          <span className="vk">{metric.value} <small>{metric.unit}</small></span>
        </div>

        <div className="body">
          <div className="nrow">
            <span className="k">Domain</span>
            <span className="v">{metric.domain.toUpperCase()}</span>
          </div>
          <div className="nrow">
            <span className="k">Category</span>
            <span className="v">{metric.category.toUpperCase()}</span>
          </div>
          <div className="nrow">
            <span className="k">Source table</span>
            <span className="v">{n.source}</span>
          </div>
          <div className="nrow indent">
            <span className="k">Columns</span>
            <span className="v">{n.column}</span>
          </div>
          <div className="nrow" style={{ flexDirection: "column", alignItems: "stretch", gap: 4 }}>
            <span className="k">Calculation</span>
            <div className="calc">{n.calc}</div>
          </div>
          <div className="nrow">
            <span className="k">Filters / exclusions</span>
            <span className="v" style={{ maxWidth: "60%", whiteSpace: "normal", textAlign: "right", fontFamily: "inherit", fontSize: 12.5, letterSpacing: 0 }}>{n.filters}</span>
          </div>
          <div className="nrow">
            <span className="k">Refresh frequency</span>
            <span className="v">{n.refresh}</span>
          </div>
        </div>

        <div className="footnote">
          <strong>Note. </strong>{n.caveat}
        </div>
      </div>
    </div>
  );
}

// ---- Generation overlay -----------------------------------------------
function GenerationOverlay({ manifest, onClose, onView, onDownload }) {
  const [stage, setStage] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let i = 0;
    const tick = () => {
      i++;
      if (i >= GEN_STAGES.length) {
        setStage(GEN_STAGES.length - 1);
        setTimeout(() => setDone(true), 600);
        return;
      }
      setStage(i);
      setTimeout(tick, 850 + Math.random() * 350);
    };
    const t = setTimeout(tick, 850);
    return () => clearTimeout(t);
  }, []);

  const pct = done ? 100 : Math.min(95, ((stage + 1) / GEN_STAGES.length) * 100);

  return (
    <div className="gen-back">
      <div className="gen-card">
        <div className="anim">
          <svg viewBox="0 0 100 100">
            <circle className="ring" cx="50" cy="50" r="46" />
            <circle className="ring" cx="50" cy="50" r="34" />
            <circle className="arc" cx="50" cy="50" r="46" strokeDasharray="60 230" />
            <circle className="arc arc-2" cx="50" cy="50" r="34" strokeDasharray="30 180" />
          </svg>
          <div className="mark"><DataCafeMark animated /></div>
        </div>
        <h2>{done ? <>Your report is <em>ready</em></> : <>Crafting your <em>report</em></>}</h2>
        <div className="gen-status">{done ? "Served warm. Bon appétit." : GEN_STAGES[stage]}</div>

        <div className="gen-progress"><div className="bar" style={{ width: `${pct}%` }} /></div>

        <div className="gen-receipt">
          <div className="head">
            <span className="ttl">Order receipt</span>
            <span className="win">{manifest.window}</span>
          </div>
          <ul>
            {manifest.metrics.map(m => (
              <li key={m.id}>
                <span>{m.name}</span>
                <span className="vt">{m.viz}</span>
              </li>
            ))}
          </ul>
        </div>

        <details className="gen-dev">
          <summary>For developers · manifest.json</summary>
          <pre>{JSON.stringify(manifest.json, null, 2)}</pre>
        </details>

        <div className="gen-actions">
          {done
            ? <>
                <button className="btn btn-ghost" onClick={onClose}>Back to builder</button>
                {onDownload && (
                  <button className="btn btn-secondary" onClick={onDownload}>
                    <Icon name="download" size={14} /> Export HTML
                  </button>
                )}
                <button className="btn btn-primary" onClick={onView}>
                  View dashboard <Icon name="arrow" size={14} className="arrow" />
                </button>
              </>
            : <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          }
        </div>
        {done && (
          <div style={{
            marginTop: 12, fontSize: 11.5, color: "var(--ink-mute)",
            fontStyle: "italic", fontFamily: "var(--font-display)"
          }}>
            Your dashboard is ready. Export an HTML copy any time from the dashboard header.
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Order bar ---------------------------------------------------------
function OrderBar({ window, selectedMetrics, vizMap, onRemove, onGenerate, persona, max }) {
  const ready = selectedMetrics.length > 0;
  const winLabel = TIME_WINDOWS.find(w => w.id === window)?.label || window;

  return (
    <div className="order-bar">
      <div className="order-inner">
        <div className="order-tag">
          <strong>Your order</strong>
          for {persona.salutation}
        </div>

        <div className="order-meta">
          <span className="k">Window</span>
          <span className="v">{winLabel}</span>
        </div>

        <div className="order-chips">
          {selectedMetrics.length === 0 ? (
            <span className="empty">Choose a template above, or hand-pick a few metrics…</span>
          ) : selectedMetrics.map(m => (
            <span key={m.id} className="order-chip">
              <span className="dot" style={{ background: `var(--cat-${m.category}, var(--accent))` }} />
              {m.name}
              <span className="viz">{vizMap[m.id] || m.defaultViz}</span>
              <button className="x" aria-label={`Remove ${m.name}`} onClick={() => onRemove(m.id)}><Icon name="x" size={11} /></button>
            </span>
          ))}
        </div>

        <div className="order-counter">
          <strong>{selectedMetrics.length}</strong> of {max}
        </div>

        <button className="btn-generate" disabled={!ready} onClick={onGenerate}>
          Serve up the report <Icon name="arrow" size={15} className="arrow" />
        </button>
      </div>
    </div>
  );
}

// ---- MyReports (library) tab ------------------------------------------
const MY_REPORTS_CSS = `
.lib-grid { display: grid; gap: 12px; }
.lib-row {
  display: grid;
  grid-template-columns: 1.6fr .9fr .8fr 1fr auto;
  gap: 18px; align-items: center;
  background: var(--paper);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 16px 20px;
  transition: border-color .15s, box-shadow .15s;
}
.lib-row:hover { border-color: var(--line-strong); box-shadow: var(--shadow-sm); cursor: default; }
.lib-row .nm-block { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.lib-row .nm {
  font-family: var(--font-display); font-size: 17px; font-weight: 500;
  color: var(--ink);
  display: inline-flex; align-items: center; gap: 6px;
  max-width: 100%;
}
.lib-row .nm .nm-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lib-row input.nm-edit {
  font: inherit; font-size: 17px; font-weight: 500;
  font-family: var(--font-display);
  background: transparent; border: 0; outline: 0;
  color: var(--ink); padding: 0; min-width: 18ch;
  border-bottom: 1px dashed var(--accent);
}
.lib-row .nm-pencil {
  appearance: none; background: transparent; border: 0; color: var(--ink-mute);
  cursor: pointer; width: 22px; height: 22px; border-radius: 50%;
  display: grid; place-items: center; padding: 0; opacity: 0;
  transition: opacity .15s;
}
.lib-row:hover .nm-pencil { opacity: 1; }
.lib-row .nm-pencil:hover { color: var(--accent); background: color-mix(in oklab, var(--accent) 10%, transparent); }
.lib-row .sub { font-family: var(--font-mono); font-size: 10px; letter-spacing: .12em;
                text-transform: uppercase; color: var(--ink-mute); }
.lib-row .field { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.lib-row .field .k { font-family: var(--font-mono); font-size: 9.5px;
                     letter-spacing: .14em; text-transform: uppercase; color: var(--ink-mute); }
.lib-row .field .v { font-size: 13px; color: var(--ink-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.lib-row .pills { display: flex; gap: 4px; flex-wrap: wrap; }
.lib-row .pills .tag {
  display: inline-flex; align-items: center; gap: 4px;
  font-family: var(--font-mono); font-size: 9.5px;
  padding: 3px 7px; border-radius: 4px;
  background: var(--paper-2); border: 1px solid var(--line);
  color: var(--ink-2); letter-spacing: .04em;
}
.lib-row .pills .tag .dot { width: 5px; height: 5px; border-radius: 50%; background: var(--accent); }
.lib-row .actions { display: flex; gap: 4px; }
.lib-row .actions .open {
  appearance: none; cursor: pointer; font: inherit; font-size: 12.5px; font-weight: 500;
  background: var(--ink); color: var(--paper); border: 0;
  padding: 7px 14px; border-radius: 999px;
  display: inline-flex; align-items: center; gap: 6px;
}
html[data-theme="midnight"] .lib-row .actions .open { background: var(--accent); color: var(--bg); }
.lib-row .actions .open:hover { transform: translateY(-1px); box-shadow: var(--shadow-sm); }
.lib-row .actions .icon-act {
  appearance: none; cursor: pointer;
  background: transparent; border: 1px solid var(--line);
  color: var(--ink-mute);
  width: 32px; height: 32px; border-radius: 50%;
  display: grid; place-items: center;
  transition: color .15s, border-color .15s, background .15s;
}
.lib-row .actions .icon-act:hover { color: var(--ink); border-color: var(--line-strong); }
.lib-row .actions .icon-act.danger:hover { color: var(--crit); border-color: var(--crit); }

.lib-empty {
  background: var(--paper);
  border: 1px dashed var(--line-strong);
  border-radius: 18px;
  padding: 56px 32px;
  text-align: center;
  max-width: 720px;
  margin: 32px auto;
}
.lib-empty .glyph {
  width: 56px; height: 56px;
  border-radius: 14px;
  background: color-mix(in oklab, var(--accent) 12%, transparent);
  color: var(--accent);
  display: grid; place-items: center;
  margin: 0 auto 18px;
}
.lib-empty h2 { font-family: var(--font-display); font-style: italic; font-size: 26px;
                color: var(--accent); margin-bottom: 10px; }
.lib-empty p { color: var(--ink-soft); max-width: 44ch; margin: 0 auto;
               line-height: 1.55; font-size: 13.5px; }

@media (max-width: 900px) {
  .lib-row { grid-template-columns: 1fr; gap: 8px; }
  .lib-row .actions { justify-self: start; flex-wrap: wrap; }
}
`;

function injectMyReportsCss() {
  if (document.getElementById("my-reports-styles")) return;
  const tag = document.createElement("style");
  tag.id = "my-reports-styles";
  tag.textContent = MY_REPORTS_CSS;
  document.head.appendChild(tag);
}

function MyReports({ reports, onOpen, onEdit, onDuplicate, onRename, onDelete, onExport }) {
  useEffect(injectMyReportsCss, []);

  const [renamingId, setRenamingId] = useState(null);
  const [draftName, setDraftName] = useState("");

  const beginRename = (r) => { setRenamingId(r.id); setDraftName(r.name); };
  const commitRename = () => {
    const next = (draftName || "").trim();
    const id = renamingId;
    setRenamingId(null);
    if (id && next) onRename(id, next);
  };

  const fmtDate = (iso) => {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
    } catch { return iso.slice(0, 10); }
  };

  const themeLabel = (theme) =>
    theme === "modern_dark" ? "Concierge Midnight"
    : theme === "minimal_print" ? "Letterpress"
    : "Bonvoy Cream";

  const windowLabel = (m) => {
    const v = m && m.time_window && m.time_window.value;
    if (v === "7d")  return "7 days";
    if (v === "30d") return "30 days";
    if (v === "60d") return "60 days";
    if (v === "90d") return "90 days";
    if (v === "custom") return "Custom";
    return v || "—";
  };

  return (
    <main>
      <div className="section-hdr" style={{ marginTop: 8 }}>
        <div className="left">
          <span className="eyebrow">My Library</span>
          <h2>Reports you've <em>already served</em></h2>
        </div>
        <div className="right">
          {reports.length === 0
            ? "Generate a report from the Build tab and click Save to keep it here."
            : `${reports.length} report${reports.length === 1 ? "" : "s"} on file. Open, refresh, or duplicate as a starting point.`}
        </div>
      </div>

      {reports.length === 0 ? (
        <div className="lib-empty">
          <div className="glyph"><Icon name="library" size={28} /></div>
          <h2>Your library is <em>empty</em></h2>
          <p>Generate a report from the Build tab and click <strong>Save to library</strong> on the dashboard to keep it here. Saved reports stay on this device and can be opened, edited, or duplicated anytime.</p>
        </div>
      ) : (
        <div className="lib-grid">
          {reports.map(r => {
            const m = r.manifest || {};
            const metrics = (m.metrics || []).map(x => x.id);
            return (
              <div key={r.id} className="lib-row">
                <div className="nm-block">
                  <div className="nm">
                    {renamingId === r.id ? (
                      <input
                        className="nm-edit"
                        autoFocus
                        value={draftName}
                        onChange={(e) => setDraftName(e.target.value)}
                        onBlur={commitRename}
                        onKeyDown={(e) => {
                          if (e.key === "Enter")  commitRename();
                          if (e.key === "Escape") setRenamingId(null);
                        }}
                      />
                    ) : (
                      <span className="nm-text">{r.name}</span>
                    )}
                    {renamingId !== r.id && (
                      <button className="nm-pencil" onClick={() => beginRename(r)}
                        aria-label="Rename" title="Rename">
                        <Icon name="edit" size={11} />
                      </button>
                    )}
                  </div>
                  <div className="sub">
                    Saved {fmtDate(r.savedAt)} · for {m.user || "—"}
                  </div>
                </div>

                <div className="field">
                  <div className="k">Window</div>
                  <div className="v">{windowLabel(m)}</div>
                </div>
                <div className="field">
                  <div className="k">Theme</div>
                  <div className="v">{themeLabel(m.theme)}</div>
                </div>
                <div className="field">
                  <div className="k">Metrics</div>
                  <div className="pills">
                    {metrics.slice(0, 4).map(id => (
                      <span key={id} className="tag"><span className="dot" />{id}</span>
                    ))}
                    {metrics.length > 4 && <span className="tag">+{metrics.length - 4}</span>}
                  </div>
                </div>

                <div className="actions">
                  <button className="open" onClick={() => onOpen(r.id)} title="Open dashboard">
                    Open <Icon name="arrow" size={12} />
                  </button>
                  <button className="icon-act" onClick={() => onEdit(r.id)}
                    aria-label="Edit in builder" title="Edit in builder">
                    <Icon name="edit" size={13} />
                  </button>
                  <button className="icon-act" onClick={() => onDuplicate(r.id)}
                    aria-label="Duplicate" title="Duplicate">
                    <Icon name="copy" size={13} />
                  </button>
                  <button className="icon-act" onClick={() => onExport(r.id)}
                    aria-label="Export HTML" title="Export HTML">
                    <Icon name="download" size={13} />
                  </button>
                  <button className="icon-act danger" onClick={() => onDelete(r.id)}
                    aria-label="Delete" title="Delete">
                    <Icon name="trash" size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}

Object.assign(window, {
  Header, Concierge, AskInstead, Templates, TimeRow, DomainFilter,
  MetricCard, MetricTable, NutritionFacts, GenerationOverlay, OrderBar, MyReports, ASK_SUGGESTIONS
});
