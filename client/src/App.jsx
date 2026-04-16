import { useEffect, useMemo, useState } from "react";

const API_BASE = "http://localhost:5000/api";

async function apiRequest(path, options = {}) {
  const hasBody = options.body !== undefined;
  const headers = {
    ...(hasBody ? { "Content-Type": "application/json" } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const raw = await response.text();

  let payload = null;
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch (error) {
    throw new Error(`Invalid JSON response (${response.status})`);
  }

  if (!response.ok || payload.success === false) {
    throw new Error(payload.message || `Request failed (${response.status})`);
  }

  return payload.data;
}

function App() {
  const [todos, setTodos] = useState([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [editingTodoId, setEditingTodoId] = useState("");
  const [loading, setLoading] = useState(false);
  const [serverStatus, setServerStatus] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [historyTodoId, setHistoryTodoId] = useState("");
  const [historyItems, setHistoryItems] = useState([]);
  const [snapshotTodoId, setSnapshotTodoId] = useState("");
  const [snapshotVersion, setSnapshotVersion] = useState("");
  const [snapshotItem, setSnapshotItem] = useState(null);

  const submitLabel = useMemo(() => {
    return editingTodoId ? "Update Todo" : "Create Todo";
  }, [editingTodoId]);

  const loadTodos = async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      const latestTodos = await apiRequest("/todos");
      setTodos(Array.isArray(latestTodos) ? latestTodos : []);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTodos();
  }, []);

  const resetForm = () => {
    setTitle("");
    setContent("");
    setEditingTodoId("");
  };

  const checkServer = async () => {
    setServerStatus("Checking...");
    try {
      const response = await fetch(`${API_BASE}/health`);
      const raw = await response.text();
      const payload = raw ? JSON.parse(raw) : {};

      if (!response.ok || payload.success === false) {
        throw new Error(payload.message || "Health check failed");
      }

      setServerStatus(payload.message || "Server is running");
    } catch (error) {
      setServerStatus(`Error: ${error.message}`);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage("");

    try {
      const body = {
        title,
        content,
      };

      if (editingTodoId) {
        await apiRequest(`/todos/${editingTodoId}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
      } else {
        await apiRequest("/todos", {
          method: "POST",
          body: JSON.stringify(body),
        });
      }

      resetForm();
      await loadTodos();
    } catch (error) {
      setErrorMessage(error.message);
    }
  };

  const startEdit = (todo) => {
    setEditingTodoId(todo.todoId);
    setTitle(todo.title || "");
    setContent(todo.content || "");
  };

  const handleDelete = async (todoId) => {
    setErrorMessage("");
    try {
      await apiRequest(`/todos/${todoId}`, { method: "DELETE" });
      await loadTodos();
    } catch (error) {
      setErrorMessage(error.message);
    }
  };

  const handleHistory = async (todoId) => {
    setErrorMessage("");
    setSnapshotItem(null);
    setSnapshotTodoId(todoId);
    try {
      const versions = await apiRequest(`/todos/${todoId}/history`);
      setHistoryTodoId(todoId);
      setHistoryItems(Array.isArray(versions) ? versions : []);
    } catch (error) {
      setErrorMessage(error.message);
    }
  };

  const handleSnapshot = async (todoId) => {
    if (!snapshotVersion) {
      setErrorMessage("Enter a version for snapshot");
      return;
    }

    const parsedVersion = Number.parseInt(snapshotVersion, 10);
    if (!Number.isInteger(parsedVersion) || parsedVersion <= 0) {
      setErrorMessage("Snapshot version must be a positive integer");
      return;
    }

    setErrorMessage("");
    setHistoryTodoId("");

    try {
      const snapshot = await apiRequest(
        `/todos/${todoId}/snapshot/${parsedVersion}`
      );

      setSnapshotTodoId(todoId);
      setSnapshotItem(snapshot);
    } catch (error) {
      setErrorMessage(error.message);
    }
  };

  return (
    <div style={{ fontFamily: "Segoe UI, sans-serif", maxWidth: 960, margin: "24px auto", padding: "0 16px" }}>
      <h1>MVCC Todo App</h1>

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 20 }}>
        <button type="button" onClick={checkServer}>Check Server</button>
        <span>{serverStatus}</span>
      </div>

      {errorMessage && (
        <div style={{ background: "#ffeaea", border: "1px solid #ffb5b5", padding: 12, marginBottom: 16 }}>
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 8, marginBottom: 20 }}>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Title"
          required
        />
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Content"
          rows={3}
        />
        <div style={{ display: "flex", gap: 8 }}>
          <button type="submit">{submitLabel}</button>
          {editingTodoId && (
            <button type="button" onClick={resetForm}>Cancel Edit</button>
          )}
        </div>
      </form>

      <div style={{ marginBottom: 16 }}>
        <label htmlFor="snapshotVersion">Snapshot version: </label>
        <input
          id="snapshotVersion"
          type="number"
          min="1"
          step="1"
          value={snapshotVersion}
          onChange={(event) => setSnapshotVersion(event.target.value)}
          placeholder="e.g. 2"
        />
      </div>

      <h2>Latest Todos</h2>
      {loading && <p>Loading...</p>}
      {!loading && todos.length === 0 && <p>No todos yet.</p>}

      <ul style={{ display: "grid", gap: 10, paddingLeft: 20 }}>
        {todos.map((todo) => (
          <li key={`${todo.todoId}-${todo.version}`} style={{ border: "1px solid #ddd", padding: 12 }}>
            <strong>{todo.title}</strong>
            <p style={{ margin: "6px 0" }}>{todo.content || "No content"}</p>
            <small>todoId: {todo.todoId} | version: {todo.version}</small>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
              <button type="button" onClick={() => startEdit(todo)}>Edit</button>
              <button type="button" onClick={() => handleDelete(todo.todoId)}>Delete</button>
              <button type="button" onClick={() => handleHistory(todo.todoId)}>History</button>
              <button type="button" onClick={() => handleSnapshot(todo.todoId)}>Snapshot</button>
            </div>
          </li>
        ))}
      </ul>

      {historyTodoId && (
        <section style={{ marginTop: 24 }}>
          <h2>History for {historyTodoId}</h2>
          <ul style={{ paddingLeft: 20 }}>
            {historyItems.map((item) => (
              <li key={`${item.todoId}-${item.version}`}>
                v{item.version} | {item.title} | deleted: {String(item.isDeleted)} | createdAt: {new Date(item.createdAt).toLocaleString()}
              </li>
            ))}
          </ul>
        </section>
      )}

      {snapshotItem && (
        <section style={{ marginTop: 24 }}>
          <h2>Snapshot for {snapshotTodoId}</h2>
          <p>Version: {snapshotItem.version}</p>
          <p>Title: {snapshotItem.title}</p>
          <p>Content: {snapshotItem.content || "No content"}</p>
          <p>Deleted: {String(snapshotItem.isDeleted)}</p>
          <p>Created At: {new Date(snapshotItem.createdAt).toLocaleString()}</p>
        </section>
      )}
    </div>
  );
}

export default App;