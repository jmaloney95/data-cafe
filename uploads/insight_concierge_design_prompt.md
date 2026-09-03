# Insight Concierge — Design Prompt

> A self-service report scoping and generation tool for Marriott International's Technology Experience Center.
>
> Use this document as the single source of truth for designing the UI. Read the whole thing before starting. The design principles matter more than any individual screen spec.

---

## The Problem This Solves

Every reporting request at a large enterprise follows the same broken loop:

1. A business stakeholder says "I need a dashboard."
2. The dev team asks "What do you want on it?"
3. The stakeholder doesn't know. They know they have a problem. They don't know which metrics describe it.
4. The dev team guesses, builds something, presents it.
5. The stakeholder says "That's not what I meant."
6. Repeat 3–6 times over several weeks.

The people who need data don't speak data. The people who build reports don't speak business. There is no shared language between them. **This tool is the translator.**

Most stakeholders don't want to design a dashboard. They want to describe a problem and receive clarity. The right model is a concierge — someone who listens, knows what's available, makes a smart recommendation, and lets you adjust if you want.

---

## Design Principles

These are non-negotiable. Every screen, component, and interaction should be measured against them.

### 1. Infer, Don't Interrogate

The system knows who you are before you tell it. Your role, your team, your domain, your recent activity — these are signals. A FLEX Manager working in Incident Management should see Incident metrics pre-surfaced with a sensible starting recommendation. An executive should see a high-level template with fewer options. The system does the work upfront. The user confirms or adjusts.

### 2. Progressive Disclosure

The default experience is radically simple. Pick a starting template, review what's included, generate. Three interactions. But if you're a power user who wants to hand-pick every metric, choose specific chart types, set custom date ranges, or configure export options — that surface area exists. It's just not in your face. Complexity is available on demand, never imposed by default.

### 3. No Blank Canvases

The system never presents an empty state and waits. Every screen has a smart default. Every section has a recommendation. The concierge always has an opinion. The user's job is to say "yes, that" or "no, change this." Saying yes is always easier than building from scratch.

### 4. Metric Literacy, Not Metric Overload

Most stakeholders don't know what MTTR means. They shouldn't have to. Every metric has:
- A plain-English name
- A one-sentence description
- A **"Nutrition Facts"** detail panel (accessible via an info icon) that explains exactly what it measures, where the data comes from, how it's calculated, what it excludes, and when it was last refreshed

This is the metric's ingredient label. It's styled after a real nutrition facts label so the format is instantly recognizable. It builds trust and eliminates the "where does this number come from?" question that derails every dashboard review.

### 5. The Output Is the Product

The scoping experience is a means to an end. The real product is the generated report — a self-contained HTML file with embedded data and charts. No Power BI license. No VPN. Just a file anyone can open in a browser, email, or embed. If it doesn't look like something a VP would be proud to present, the tool has failed.

---

## Branding & Visual Identity

The visual identity must be **unmistakably Marriott**. Not a generic enterprise tool with a logo on top — something that feels like it belongs to the company.

Marriott's brand DNA balances tradition and modernity: warmth without being casual, premium without being cold, confident without being loud. Think boutique hotel lobby, not IT control room.

### Design Direction

- **Warm and tactile** — the hospitality metaphor runs through everything. The user is a guest. The system is a concierge. The report is the experience being curated for them.
- **Marriott brand palettes used authentically** — draw from the corporate and Bonvoy brand systems. Not just the logo colors — the full spectrum of how the brand expresses itself across properties, communications, and digital products.
- **Premium but approachable** — clean type hierarchy, generous whitespace, subtle depth and shadow, purposeful animation. Nothing sterile, nothing flashy.
- **Accessible and inclusive** — no reliance on color alone for status indicators. Clean contrast ratios. Legible at all sizes. Keyboard navigable.
- **Works in light and dark** — support both contexts. Translate cleanly to print/PDF.

**Do not replicate any existing Marriott internal tool.** This is a new product with its own visual identity — inspired by the brand guidelines but purpose-built for a data tool. Develop a fresh type system, color tokens, spacing scale, and component library.

---

## Product Structure

The tool has **three main tabs/views** in a top-level navigation:

1. **Build** — the primary report building experience (default view)
2. **My Reports** — previously generated reports, saved manifests, version history
3. **Marketplace** — shared template library (marked "Coming Soon" in MVP)

Plus a persistent header with: Marriott branding/logo, product name "Insight Concierge", user identity (name, role, avatar via SSO), and a help/docs link.

---

## Tab 1: Build (Primary Experience)

This is where the user scopes and generates a report. It is **not a multi-step wizard with a progress bar**. It is a single, flowing experience — but it has distinct zones that the user moves through naturally.

### Zone A: Concierge Recommendation

The first thing the user sees. The system has already analyzed their role, team, and recent activity and produced a recommendation.

**What to show:**
- A warm, prominent card or banner at the top of the page
- Concierge identity (icon/avatar + "Concierge" label — this is the system's persona)
- A personalized message: something like "Welcome back, John. Based on your role as FLEX Manager and your recent work in Incident Management, here's what we'd recommend."
- A pre-configured report summary: the recommended template name, which metrics it includes (shown as compact pills/tags), the suggested time window, and a brief rationale
- Two clear actions: **"Looks good — generate"** (primary CTA) and **"Let me customize"** (secondary, scrolls to the build area below)
- A subtle dismiss: "Not what I need? Start from scratch."

**Design intent:** This zone is the "two-click path." For most users, this is the entire experience. See recommendation → generate. Done.

### Zone B: Ask Instead (Natural Language Input)

Directly below or alongside the concierge recommendation: a text input where the user can type what they need in plain English.

**Examples of inputs:**
- "Show me how incident routing has changed over the last quarter"
- "I need a report for my VP on outage response times"
- "What does our change success rate look like month over month?"

The system parses the intent, maps it to available metrics and domains, selects appropriate visualizations, and pre-fills the configuration — which the user can review and adjust before generating.

**Design intent:** This is the lowest-friction path for users who know what they want but don't want to click through menus. It should feel conversational, not like a search box. Consider showing 2–3 example prompts as placeholder text or ghost suggestions.

### Zone C: Curated Templates

A collection of pre-built report configurations. Think of these as "house specials" — common reporting patterns that cover the most frequent use cases.

**Show 6–8 template cards** in a grid. Each card contains:
- A distinctive icon or illustration
- A template name (descriptive and memorable, not generic)
- A one-line description of what it answers
- Small tags/pills showing which metrics are included
- The default time window
- A selected/active state when chosen

**Example templates** (refine naming to fit the brand voice):
1. Executive health overview — P1s, Opened, Resolved, Reassignment, MTTR — 90 days
2. Routing efficiency audit — Reassignment, Reopen, MTTR — 30 days
3. Daily operational snapshot — Opened, P1, Same Day Resolution — 7 days
4. Quarterly board briefing — Opened, Resolved, Same Day, Reopen — 90 days
5. Full incident deep dive — all available incident KPIs — 60 days
6. Regional/property performance — Opened, P1, Reassignment with geographic view — 30 days

**Behavior:** Clicking a template pre-selects its metrics and time window in the sections below. The user can then adjust before generating. One template can be pre-highlighted based on the concierge recommendation from Zone A.

### Zone D: Build Your Own (Manual Metric Selection)

For users who want control, this section contains:

#### Time Window Selector
A row of selectable time chips: 7 days, 30 days, 60 days, 90 days, Custom.
- One active by default (set by template or concierge recommendation)
- "Custom" expands an inline date picker with start/end inputs

#### Metric Menu
Metrics organized by domain (Incident, Change, Problem, Outage, Knowledge).

**Filtering:** A segmented control or tab bar to filter by domain, or show all. Include a "Featured" or "Recommended" filter that highlights metrics relevant to the user's detected intent.

**Each metric is a selectable card showing:**
- Domain category label (small, uppercase, monospace)
- Metric name (clear, readable)
- One-sentence plain-English description
- Current live value for the selected time window (makes the data tangible)
- A selection affordance (checkbox, toggle, or card highlight)
- An **info icon** that opens the **Nutrition Facts** panel (see below)
- When selected: a **visualization picker** appears within the card — small options like "Trend line," "Bar chart," "Heatmap," etc. Only show viz types that are relevant to that specific metric. One is pre-selected as the default.

**Constraints:**
- Maximum of ~6 metrics per report (enforced with clear feedback)
- Metrics that are unavailable or pending validation are shown but visually disabled with a "coming soon" indicator

#### Nutrition Facts Panel
Triggered by the info icon on any metric card. Opens a modal or slide-over panel styled after a real-world **nutrition facts label**. Contains:

- **Metric name and description** (header)
- **Source table** — where the data lives
- **Column(s)** — specific fields used
- **Calculation** — the exact formula or logic
- **Filters/exclusions** — what's included and what's not
- **Refresh frequency** — how often the data updates
- **Caveats/notes** — edge cases, known limitations, interpretation guidance

The nutrition label metaphor makes this information feel structured and trustworthy rather than like a wall of technical documentation. The format should be immediately recognizable: bordered box, bold headers, row-based key-value pairs, just like reading the back of a cereal box.

### Zone E: Customize (Collapsed by Default)

A collapsible section with a clear toggle label (e.g., "Customize layout & theme" or similar). Progressive disclosure — only power users expand this.

**When expanded, contains:**

**Layout preference** — two options shown as visual radio cards with small illustrations:
- Single Page Summary — one scannable view, great for standups and executive briefings
- Multi-Tab Deep Dive — tabbed pages with drill-through, for analysts who investigate

**Theme selection** — multiple Marriott-branded visual themes. Each shown as a live mini-preview card depicting the same small dashboard mockup rendered in that theme. Themes should range across:
- A light, corporate, brand-forward option
- A dark, modern, operational/SOC-style option
- A minimal, grayscale, print-optimized option
- (Potentially more in the future)

Selected theme gets a clear visual indicator.

### Zone F: Advanced Options (Hidden by Default)

A text link or small toggle below Zone E: something like "Advanced options."

**When expanded:**
- Service Group filter dropdown
- Priority filter dropdown
- Region/geography filter
- Refresh cadence preference: Real-time | Daily | Weekly
- Export toggles: CSV download, PDF generation, scheduled email delivery

This is for the 5% of users who need it. It should never be visible to someone on the happy path.

### Persistent Order/Summary Bar

A bar fixed to the bottom of the viewport, always visible while the user is building. This IS the live review — there is no separate "review step."

**Contents:**
- Label identifying it as the current order/selection summary
- The selected time window
- Compact chips/tags for each selected metric (with category color indicator, viz type icon, and a remove button)
- A counter showing how many metrics are selected out of the maximum
- Empty state: placeholder text encouraging the user to make selections
- **Primary CTA button** to generate the report — disabled when nothing is selected, vivid and prominent when ready. The label should convey generation/creation (not "Submit" — something with more personality).

---

## Generation Overlay

When the user triggers generation, a modal overlay appears.

**Contents:**
- Warm backdrop blur
- Centered card with:
  - A distinctive animation (branded, not a generic spinner)
  - A title conveying that the report is being built
  - The selected time window and a receipt-style summary of what's being generated (metric list with their viz types)
  - A progress bar or staged status indicator with descriptive status messages that update as the system works (these should have personality — not "Loading step 3 of 5")
  - When complete: the CTA button transitions from a disabled/building state to an enabled state inviting the user to view their report
  - Secondary action: go back to the builder

**Timing:** The whole generation should feel fast — real or perceived. ~4–5 seconds of animated progress even if the backend is faster. The experience should feel like something was crafted, not just fetched.

---

## Tab 2: My Reports

A personal library of previously generated reports.

**Each report entry shows:**
- Report name (auto-generated from template + date, editable)
- Date generated
- Metrics included (as compact tags)
- Theme used
- Time window
- Actions: Open, Regenerate (with fresh data), Edit (re-open in Build with that manifest), Download, Delete

**Future considerations:**
- Version history: see how a report's data has changed over regenerations
- Sharing: send a report link to a colleague
- Pinning: mark a report as a favorite for quick access

---

## Tab 3: Template Marketplace (Coming Soon)

This tab is visible in the navigation but marked as "Coming Soon" in the MVP.

**The concept for the full version:**
- A shared library where users can publish, browse, and clone report configurations
- Users can publish a report config they've built, giving it a name, description, and tags
- Other users browse the marketplace, preview templates, and clone them into their own Build flow to customize
- TEC-curated "official" templates are pinned/featured at the top — gold-standard configs maintained by the analytics team
- Templates are versioned: if the author updates, clones can optionally pull the update
- Categories, search, popularity sorting, ratings

**For the MVP design:** Show the tab with an engaging "Coming Soon" state — not just a gray empty page. Show the vision: a preview of what the marketplace will look like with a few example template cards, a brief description of the concept, and possibly a "Notify me when it's live" or "Suggest a template" call to action. Make it feel like something worth waiting for.

---

## Architecture Context (For Design Understanding)

The UI produces a `manifest.json` — a structured file capturing all the user's selections:

```json
{
  "user": "John Maloney",
  "role": "FLEX Manager",
  "intent": "monitor_health",
  "domains": ["incident"],
  "metrics": [
    {"id": "mttr", "viz": "trend"},
    {"id": "reopen_rate", "viz": "bar_by_service"},
    {"id": "p1_open", "viz": "trend"}
  ],
  "time_window": {"type": "preset", "value": "90d"},
  "theme": "modern_dark",
  "layout": "single_page",
  "filters": {"priority": "all", "service_group": "all"}
}
```

This manifest flows to a backend that queries the data platform (Microsoft Fabric Lakehouse), populates a `data.json`, and injects both into an HTML template — producing a self-contained static web app.

Power users can export/import the manifest directly. This is also what gets saved to the Template Marketplace.

Show the manifest in a collapsible "For developers" section on the generation overlay or Build summary — most users ignore it, but technical users appreciate the transparency.

---

## Available Metrics (Reference Data)

These are the real metrics available in the system for the MVP. Use these in all mockups and examples.

### Incident Domain
| Metric | Current Value | Category | Direction |
|---|---|---|---|
| Opened Incidents | 492,734 | Volume | Neutral |
| Resolved | 457,589 | Resolution | Higher is better |
| P1 Critical (Open) | 1,344 | Priority | Lower is better |
| Same Day Resolution | 38.0% | Efficiency | Higher is better |
| Reassignment Rate | 42.7% | Routing Health | Lower is better |
| Reopen Rate | 5.8% | Quality | Lower is better |
| Avg. MTTR | 96.2 hours | Velocity | Lower is better |
| Aging > 7 Days | 35,145 | Backlog | Lower is better |
| SLA Compliance | — | Compliance | *(coming soon, disabled)* |

### Visualization Options (per metric type)
- Volume metrics → Trend line, Status donut, Heatmap
- Rate metrics → Bar by team, Bar by service, Trend line
- Time metrics → Bar by team, Bar by service, Trend line
- Priority metrics → Trend line, Priority donut, Globe/geographic view
- Backlog metrics → Aging waterfall, Bar by service, Globe/geographic view

---

## User Personas (For Contextual Recommendations)

The concierge recommendation adapts based on the user's role:

| Role | Default Behavior |
|---|---|
| **Executive / VP** | Sees 3-step path. High-level template pre-selected. Minimal options visible. Layout defaults to single page. |
| **Manager / Practice Lead** | Sees template recommendation + full metric menu. Moderate options. Layout defaults to single page. |
| **Analyst / Developer** | Sees all options expanded. NL input prominent. Advanced options visible by default. Layout defaults to multi-tab. |
| **First-time user** | Sees a brief onboarding moment explaining the tool. Concierge walks them through with extra context. |

---

## States & Interactions to Design

For a complete concept, the following screens/states should be represented:

1. **Default landing** — Build tab with concierge recommendation visible, no selections yet
2. **Template selected** — A curated template is chosen, metrics and time window pre-filled, order bar populated
3. **Manual build in progress** — User is in the metric menu, 3 of 6 metrics selected, viz pickers visible on selected cards
4. **Nutrition Facts panel open** — The detail modal for one metric, showing the full nutrition label
5. **Customize expanded** — Layout and theme options visible, a theme selected
6. **Ask Instead active** — The NL input is focused with a typed query and the system is showing a suggested configuration
7. **Generation overlay** — Modal with progress animation, receipt summary, staged status messages
8. **My Reports tab** — Library of 3–4 previously generated reports with metadata
9. **Marketplace tab (Coming Soon)** — Engaging preview state with example template cards and the "coming soon" message
10. **Generated report preview** — What the output HTML dashboard looks like when opened (one of the themes applied, real metric values, charts rendered)

---

## What NOT to Do

- **No wizard stepper.** No numbered steps. No progress bar. No "Step 3 of 7."
- **No blank canvas.** Never show an empty page waiting for the user to figure it out.
- **No weights, targets, or scores on metrics.** This is not the scorecard project. Metrics are selected and visualized, not graded.
- **No cold enterprise aesthetic.** This is a Marriott product. It should feel warm, premium, and human.
- **No jargon without explanation.** If a term like "MTTR" appears, the plain-English name and description are always visible. The nutrition facts panel goes deeper.
- **No feature parity anxiety.** The MVP is deliberately scoped. Coming Soon states are honest and engaging, not apologetic.

---

*End of design prompt. Build something that makes people want to use it — not something that makes them fill out a form.*
