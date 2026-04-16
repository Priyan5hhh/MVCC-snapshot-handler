import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "./api.js";

// ─── Sub-components ───────────────────────────────────────────────────────────

function ErrorBanner({ message, onClose }) {
  if (!message) return null;
  return (
    <div className="error-banner" role="alert">
      <span>⚠️ {message}</span>
      <button className="close-btn" onClick={onClose} aria-label="Dismiss error">✕</button>
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

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const navigate = useNavigate();

  // ── State ──────────────────────────────────────────────────────────────────
  const [todos, setTodos]               = useState([]);
  const [title, setTitle]               = useState("");
  const [content, setContent]           = useState("");
  const [editingTodoId, setEditingTodoId] = useState(null);

  const [loadingList, setLoadingList]   = useState(false);
  const [submitting, setSubmitting]     = useState(false);
  const [deletingId, setDeletingId]     = useState(null);  // todoId actively being deleted
  const [confirmingId, setConfirmingId] = useState(null); // todoId awaiting inline confirm

  const [serverStatus, setServerStatus] = useState("");
  const [statusOk, setStatusOk]         = useState(null);  // true | false | null
  const [error, setError]               = useState("");

  const isEditing = Boolean(editingTodoId);

  // ── Load todos ─────────────────────────────────────────────────────────────
  async function loadTodos() {
    setLoadingList(true);
    setError("");
    try {
      const data = await apiRequest("/todos");
      setTodos(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingList(false);
    }
  }

  useEffect(() => { loadTodos(); }, []);

  // ── Health check ───────────────────────────────────────────────────────────
  async function checkServer() {
    setServerStatus("Checking…");
    setStatusOk(null);
    try {
      await apiRequest("/health");
      setServerStatus("Server is running ✓");
      setStatusOk(true);
    } catch (err) {
      setServerStatus(err.message);
      setStatusOk(false);
    }
  }

  // ── Reset form ─────────────────────────────────────────────────────────────
  function resetForm() {
    setTitle("");
    setContent("");
    setEditingTodoId(null);
    setError("");
  }

  // ── Create / Update ────────────────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) { setError("Title cannot be empty"); return; }
    setError("");
    setSubmitting(true);
    try {
      if (isEditing) {
        await apiRequest(`/todos/${editingTodoId}`, {
          method: "PUT",
          body: JSON.stringify({ title: title.trim(), content }),
        });
      } else {
        await apiRequest("/todos", {
          method: "POST",
          body: JSON.stringify({ title: title.trim(), content }),
        });
      }
      resetForm();
      await loadTodos();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  // ── Start editing ──────────────────────────────────────────────────────────
  function startEdit(todo) {
    setEditingTodoId(todo.todoId);
    setTitle(todo.title || "");
    setContent(todo.content || "");
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  function requestDelete(todoId) {
    setConfirmingId(todoId);
    setError("");
  }

  function cancelDelete() {
    setConfirmingId(null);
  }

  async function confirmDelete(todoId) {
    setConfirmingId(null);
    setError("");
    setDeletingId(todoId);
    try {
      await apiRequest(`/todos/${todoId}`, { method: "DELETE" });
      if (editingTodoId === todoId) resetForm();
      await loadTodos();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  }

  // ── Navigate to history page ───────────────────────────────────────────────
  function openHistory(todoId) {
    navigate(`/history/${todoId}`);
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="page">

      {/* Header */}
      <header className="header">
        <div className="header-title">
          <h1>MVCC Todo</h1>
          <span className="header-badge">MVCC</span>
        </div>
        <div className="status-row">
          <button className="btn btn-secondary btn-sm" onClick={checkServer} id="btn-check-server">
            Check Server
          </button>
          {serverStatus && (
            <span className={`status-text ${statusOk === true ? "ok" : statusOk === false ? "err" : ""}`}>
              {serverStatus}
            </span>
          )}
        </div>
      </header>

      {/* Error Banner */}
      <ErrorBanner message={error} onClose={() => setError("")} />

      {/* Create / Update Form */}
      <div className="card form-card">
        <h2>{isEditing ? "✏️ Editing Todo" : "➕ New Todo"}</h2>
        <form onSubmit={handleSubmit} noValidate>
          <div className="form-grid">
            <input
              id="input-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Todo title…"
              disabled={submitting}
              required
              autoComplete="off"
            />
            <textarea
              id="input-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Description (optional)…"
              rows={3}
              disabled={submitting}
            />
            <div className="btn-row">
              <button
                id="btn-submit"
                type="submit"
                className="btn btn-primary"
                disabled={submitting || !title.trim()}
              >
                {submitting ? (
                  <><span className="spinner" /> {isEditing ? "Saving…" : "Creating…"}</>
                ) : (
                  isEditing ? "Save Update" : "Create Todo"
                )}
              </button>
              {isEditing && (
                <button
                  id="btn-cancel-edit"
                  type="button"
                  className="btn btn-secondary"
                  onClick={resetForm}
                  disabled={submitting}
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </form>
      </div>

      {/* Todo List */}
      <div className="section-heading">
        <h2>Latest Todos</h2>
        {!loadingList && <span className="count-badge">{todos.length}</span>}
        <button
          className="btn btn-secondary btn-sm"
          style={{ marginLeft: "auto" }}
          onClick={loadTodos}
          disabled={loadingList}
          id="btn-refresh"
          title="Refresh"
        >
          {loadingList ? <span className="spinner" /> : "↻ Refresh"}
        </button>
      </div>

      {loadingList && <LoadingRow text="Loading todos…" />}

      {!loadingList && todos.length === 0 && (
        <div className="empty-state">
          <div className="icon">📋</div>
          <p>No todos yet — create your first one above.</p>
        </div>
      )}

      {!loadingList && (
        <ul className="todo-list">
          {todos.map((todo) => {
            const isBeingDeleted = deletingId === todo.todoId;
            const isCurrentlyEditing = editingTodoId === todo.todoId;
            return (
              <li
                key={`${todo.todoId}-${todo.version}`}
                className={`todo-item${isCurrentlyEditing ? " editing" : ""}`}
              >
                <div className="todo-title">{todo.title}</div>
                {todo.content && (
                  <div className="todo-content">{todo.content}</div>
                )}
                <div className="todo-meta">
                  <span>v{todo.version}</span>
                  <span title={todo.todoId}>
                    id: {todo.todoId.slice(0, 8)}…
                  </span>
                  <span>{new Date(todo.createdAt).toLocaleString()}</span>
                </div>
                {/* Inline delete confirmation */}
                {confirmingId === todo.todoId ? (
                  <div className="btn-row" style={{ alignItems: "center", background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "8px 12px", gap: 10 }}>
                    <span style={{ fontSize: "0.82rem", color: "#fca5a5" }}>🗑 Delete this todo?</span>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => confirmDelete(todo.todoId)}
                      id={`btn-confirm-delete-${todo.todoId}`}
                    >
                      Yes, Delete
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={cancelDelete}
                      id={`btn-cancel-delete-${todo.todoId}`}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="btn-row">
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => startEdit(todo)}
                      disabled={submitting || isBeingDeleted}
                      id={`btn-edit-${todo.todoId}`}
                    >
                      ✏️ Edit
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => requestDelete(todo.todoId)}
                      disabled={submitting || isBeingDeleted}
                      id={`btn-delete-${todo.todoId}`}
                    >
                      {isBeingDeleted ? <><span className="spinner" /> Deleting…</> : "🗑 Delete"}
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => openHistory(todo.todoId)}
                      disabled={submitting || isBeingDeleted}
                      id={`btn-history-${todo.todoId}`}
                    >
                      🕑 History
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}