import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiRequest } from "./api.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ErrorBanner({ message, onClose }) {
  if (!message) return null;
  return (
    <div className="error-banner" role="alert">
      <span>⚠️ {message}</span>
      <button className="close-btn" onClick={onClose} aria-label="Dismiss">✕</button>
    </div>
  );
}

function LoadingRow({ text = "Loading…" }) {
  return (
    <div className="loading-row">
      <span className="spinner" />
      <span>{text}</span>
    </div>
  );
}

// ─── Version dot style ────────────────────────────────────────────────────────

function versionDotClass(item) {
  if (item.isDeleted) return "version-dot deleted";
  if (item.isLatest)  return "version-dot latest";
  return "version-dot old";
}

function versionDotLabel(item) {
  if (item.isDeleted) return "🗑";
  return `v${item.version}`;
}

// ─── HistoryPage ──────────────────────────────────────────────────────────────

export default function HistoryPage() {
  const { todoId }   = useParams();
  const navigate     = useNavigate();

  // History state
  const [history, setHistory]     = useState([]);
  const [loadingHist, setLoadingHist] = useState(false);
  const [histError, setHistError] = useState("");

  const [versionInput, setVersionInput]   = useState("");
  const [snapshot, setSnapshot]           = useState(null);
  const [loadingSnap, setLoadingSnap]     = useState(false);
  const [snapError, setSnapError]         = useState("");
  const snapErrorRef                      = useRef(null);

  // ── Fetch history on mount ──────────────────────────────────────────────────
  useEffect(() => {
    if (!todoId) return;
    fetchHistory();
  }, [todoId]);

  async function fetchHistory() {
    setLoadingHist(true);
    setHistError("");
    setSnapshot(null);
    try {
      const data = await apiRequest(`/todos/${todoId}/history`);
      setHistory(Array.isArray(data) ? data : []);
    } catch (err) {
      setHistError(err.message);
      setHistory([]);
    } finally {
      setLoadingHist(false);
    }
  }

  // ── Fetch snapshot ──────────────────────────────────────────────────────────
  async function handleSnapshot(e) {
    e.preventDefault();
    setSnapError("");
    setSnapshot(null);

    const raw = versionInput.trim();

    if (!raw) {
      setSnapError("Enter a version number");
      return;
    }
    if (!/^\d+$/.test(raw)) {
      setSnapError("Version must be a whole positive number (e.g. 1, 2, 3)");
      return;
    }
    const v = parseInt(raw, 10);
    if (v <= 0) {
      setSnapError("Version must be greater than 0");
      return;
    }

    setLoadingSnap(true);
    try {
      const data = await apiRequest(`/todos/${todoId}/snapshot/${v}`);
      setSnapshot(data);
    } catch (err) {
      setSnapError(err.message);
      // Scroll error into view after render
      requestAnimationFrame(() => {
        snapErrorRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    } finally {
      setLoadingSnap(false);
    }
  }

  // ── Quick-snapshot: click version in timeline ───────────────────────────────
  function quickSnap(v) {
    setVersionInput(String(v));
    setSnapshot(null);
    setSnapError("");
  }

  // ── Computed ────────────────────────────────────────────────────────────────
  const latestVersion = history.length > 0 ? Math.max(...history.map((h) => h.version)) : null;
  const shortId = todoId ? todoId.slice(0, 8) + "…" : "";

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="page">

      {/* Back + Title */}
      <div className="back-row">
        <button
          id="btn-back"
          className="btn btn-secondary btn-sm"
          onClick={() => navigate("/")}
        >
          ← Back
        </button>
        <div>
          <div className="page-title">Version History</div>
          <div className="page-subtitle">todoId: {todoId}</div>
        </div>
      </div>

      {/* History fetch error */}
      <ErrorBanner message={histError} onClose={() => setHistError("")} />

      {/* History Timeline */}
      <div className="card" style={{ marginBottom: 28 }}>
        <div className="section-heading">
          <h2>All Versions</h2>
          {history.length > 0 && (
            <span className="count-badge">{history.length} versions</span>
          )}
          <button
            className="btn btn-secondary btn-sm"
            style={{ marginLeft: "auto" }}
            onClick={fetchHistory}
            disabled={loadingHist}
            id="btn-refresh-history"
          >
            {loadingHist ? <span className="spinner" /> : "↻ Refresh"}
          </button>
        </div>

        {loadingHist && <LoadingRow text="Fetching history…" />}

        {!loadingHist && history.length === 0 && !histError && (
          <div className="empty-state">
            <div className="icon">📂</div>
            <p>No history found for this todo.</p>
          </div>
        )}

        {!loadingHist && history.length > 0 && (
          <ul className="history-timeline">
            {history.map((item) => (
              <li key={`${item.todoId}-${item.version}`} className="history-entry">
                {/* Version dot */}
                <div
                  className={versionDotClass(item)}
                  title={item.isDeleted ? "Deleted" : item.isLatest ? "Latest" : "Old version"}
                >
                  {versionDotLabel(item)}
                </div>

                {/* Card */}
                <div
                  className={`history-card${item.isLatest ? " is-latest" : ""}${item.isDeleted ? " is-deleted" : ""}`}
                >
                  <div className="history-top">
                    <span className="history-title">
                      v{item.version} — {item.title}
                    </span>
                    {item.isLatest && (
                      <span className="tag tag-latest">Latest</span>
                    )}
                    {item.isDeleted && (
                      <span className="tag tag-deleted">Deleted</span>
                    )}
                  </div>
                  {item.content && (
                    <div className="history-content">{item.content}</div>
                  )}
                  <div className="history-date">
                    {item.isDeleted && item.deletedAt
                      ? `Deleted: ${new Date(item.deletedAt).toLocaleString()}`
                      : `Created: ${new Date(item.createdAt).toLocaleString()}`
                    }
                  </div>
                  {/* Quick-snap link */}
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ marginTop: 10 }}
                    onClick={() => quickSnap(item.version)}
                    id={`btn-quicksnap-v${item.version}`}
                  >
                    🔍 View Snapshot
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Snapshot Panel */}
      <div className="card snapshot-panel">
        <div className="section-heading">
          <h2>🔍 Fetch Snapshot</h2>
          {latestVersion && (
            <span className="count-badge">max v{latestVersion}</span>
          )}
        </div>

        <form onSubmit={handleSnapshot} noValidate>
          <div className="snapshot-row">
            <div className="field">
              <label htmlFor="input-version">Version number</label>
              <input
                id="input-version"
                type="text"
                inputMode="numeric"
                pattern="\d+"
                value={versionInput}
                onChange={(e) => {
                  setVersionInput(e.target.value);
                  setSnapshot(null);
                  setSnapError("");
                }}
                placeholder={latestVersion ? `1 – ${latestVersion}` : "e.g. 1"}
                disabled={loadingSnap}
                autoComplete="off"
              />
            </div>
            <button
              id="btn-fetch-snapshot"
              type="submit"
              className="btn btn-primary"
              disabled={loadingSnap || !versionInput.trim()}
            >
              {loadingSnap ? <><span className="spinner" /> Fetching…</> : "Fetch Snapshot"}
            </button>
          </div>
        </form>

        {/* Snapshot error — inline below the button, always visible */}
        {snapError && (
          <div ref={snapErrorRef} className="error-banner" role="alert" style={{ marginTop: 12 }}>
            <span>⚠️ {snapError}</span>
            <button className="close-btn" onClick={() => setSnapError("")} aria-label="Dismiss">✕</button>
          </div>
        )}

        {/* Snapshot Result */}
        {snapshot && (
          <div className="snapshot-result">
            <h3>Snapshot — Version {snapshot.version}</h3>
            <dl className="snapshot-fields">
              <div className="snapshot-field">
                <dt>Version</dt>
                <dd>v{snapshot.version}</dd>
              </div>
              <div className="snapshot-field">
                <dt>Title</dt>
                <dd>{snapshot.title}</dd>
              </div>
              <div className="snapshot-field">
                <dt>Content</dt>
                <dd>{snapshot.content || <em style={{ color: "var(--text-muted)" }}>—</em>}</dd>
              </div>
              <div className="snapshot-field">
                <dt>Status</dt>
                <dd>
                  {snapshot.isDeleted ? (
                    <span style={{ color: "var(--danger)" }}>🗑 Deleted</span>
                  ) : snapshot.isLatest ? (
                    <span style={{ color: "var(--success)" }}>✓ Latest</span>
                  ) : (
                    <span style={{ color: "var(--text-muted)" }}>Historical</span>
                  )}
                </dd>
              </div>
              <div className="snapshot-field">
                <dt>Todo ID</dt>
                <dd style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>{snapshot.todoId}</dd>
              </div>
              <div className="snapshot-field">
                <dt>Recorded</dt>
                <dd>{new Date(snapshot.createdAt).toLocaleString()}</dd>
              </div>
              {snapshot.isDeleted && snapshot.deletedAt && (
                <div className="snapshot-field">
                  <dt>Deleted at</dt>
                  <dd>{new Date(snapshot.deletedAt).toLocaleString()}</dd>
                </div>
              )}
            </dl>
          </div>
        )}
      </div>
    </div>
  );
}
