// Saved-report storage adapter.
//
// Today: localStorage-backed. Schema-versioned, UUID-keyed, indexed.
// Tomorrow: swap this whole module for an HTTP/Fabric adapter that exposes
// the same five public methods. The rest of the app — MyReports, Dashboard,
// app.jsx — should not change.
//
// Future stub for reference (not wired):
// ─────────────────────────────────────────────────────────────────────────
// window.FabricReportStore = {
//   list:        async ()  => fetch("/api/reports").then(r => r.json()),
//   save:        async (r) => fetch("/api/reports", { method: "POST", body: JSON.stringify(r) }).then(r => r.json()),
//   get:         async (id) => fetch("/api/reports/" + id).then(r => r.json()),
//   delete:      async (id) => fetch("/api/reports/" + id, { method: "DELETE" }),
//   rename:      async (id, name) => fetch("/api/reports/" + id, { method: "PATCH", body: JSON.stringify({name}) }),
//   refreshData: async (id) => fetch("/api/reports/" + id + "/refresh", { method: "POST" })
// };
// The interface is identical — only the storage substrate changes.

(function () {
  const SCHEMA_VERSION = 1;
  const NS    = "ic.report.";       // per-record key prefix
  const INDEX = "ic.report.index";  // ordered id list

  // ---- low-level localStorage helpers --------------------------------
  function readIndex() {
    try {
      const raw = localStorage.getItem(INDEX);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      console.warn("[ReportStore] index unreadable, resetting", e);
      return [];
    }
  }
  function writeIndex(ids) {
    localStorage.setItem(INDEX, JSON.stringify(ids));
  }
  function readRecord(id) {
    try {
      const raw = localStorage.getItem(NS + id);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.warn("[ReportStore] record " + id + " unreadable", e);
      return null;
    }
  }
  function writeRecord(rec) {
    localStorage.setItem(NS + rec.id, JSON.stringify(rec));
  }

  // ---- id generator ---------------------------------------------------
  function uuid() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    // Fallback for older browsers.
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  // ---- public API -----------------------------------------------------
  function list() {
    const ids = readIndex();
    const records = ids.map(readRecord).filter(Boolean);
    // Default sort: most-recently-opened first.
    records.sort((a, b) => {
      const ax = a.lastOpenedAt || a.savedAt || "";
      const bx = b.lastOpenedAt || b.savedAt || "";
      return bx.localeCompare(ax);
    });
    return records;
  }

  function save(input) {
    const now = new Date().toISOString();
    const isUpdate = !!(input && input.id && readRecord(input.id));
    const rec = {
      schema_version: SCHEMA_VERSION,
      id: (input && input.id) || uuid(),
      name: input && input.name ? input.name : "Untitled report",
      manifest: input && input.manifest ? input.manifest : null,
      dataRef: (input && input.dataRef) || { source: "embedded" },
      savedAt: isUpdate ? (readRecord(input.id).savedAt || now) : now,
      lastOpenedAt: now,
      dataRefreshedAt: (input && input.dataRefreshedAt)
        || (isUpdate ? readRecord(input.id).dataRefreshedAt : now)
    };
    writeRecord(rec);
    if (!isUpdate) {
      const ids = readIndex();
      if (!ids.includes(rec.id)) {
        ids.unshift(rec.id);
        writeIndex(ids);
      }
    }
    return rec.id;
  }

  function get(id) {
    const rec = readRecord(id);
    if (!rec) return null;
    rec.lastOpenedAt = new Date().toISOString();
    writeRecord(rec);
    return rec;
  }

  function _delete(id) {
    localStorage.removeItem(NS + id);
    const ids = readIndex().filter(x => x !== id);
    writeIndex(ids);
    return true;
  }

  function rename(id, name) {
    const rec = readRecord(id);
    if (!rec) return false;
    rec.name = String(name || "").trim() || rec.name;
    writeRecord(rec);
    return true;
  }

  function refreshData(id) {
    // Today: no-op + bumps dataRefreshedAt. The Dashboard's refresh button
    // animates over this call. Tomorrow this issues a Fabric query against
    // dataRef and replaces the cached dataset for this report.
    const rec = readRecord(id);
    if (!rec) return Promise.resolve(null);
    rec.dataRefreshedAt = new Date().toISOString();
    writeRecord(rec);
    return new Promise(resolve => setTimeout(() => resolve(rec), 600));
  }

  // ---- expose ---------------------------------------------------------
  window.ReportStore = {
    list, save, get, rename, refreshData,
    delete: _delete   // `delete` is a reserved word
  };
})();
