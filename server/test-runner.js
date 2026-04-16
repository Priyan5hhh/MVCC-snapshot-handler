const BASE = "http://localhost:5000/api";

async function call(label, method, path, body) {
  const opts = { method, headers: { "Content-Type": "application/json" } };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(BASE + path, opts);
  const json = await res.json();
  const passed = res.ok && json.success !== false;
  console.log(`[${passed ? "PASS" : "FAIL"}] ${label} -> HTTP ${res.status}`);
  return { status: res.status, json, passed };
}

async function run() {
  const errors = [];
  let todoId;

  // 1. Health
  const health = await call("GET /health", "GET", "/health");
  if (!health.passed) errors.push("Health check failed");

  // 2. Create
  const create = await call("POST /todos", "POST", "/todos", {
    title: "Test Todo",
    content: "Initial content",
  });
  todoId = create.json.data?.todoId;
  const v1 = create.json.data?.version;
  console.log("   todoId:", todoId, "| version:", v1);
  if (v1 !== 1) errors.push("Create: expected version=1, got " + v1);

  // 3. Get all todos
  const getAll = await call("GET /todos", "GET", "/todos");
  if (!getAll.passed) errors.push("GET /todos failed");

  // 4. Update v2
  const upd1 = await call("PUT /todos (v2)", "PUT", "/todos/" + todoId, {
    title: "Updated v2",
    content: "Content v2",
  });
  const v2 = upd1.json.data?.version;
  console.log("   version after 1st update:", v2);
  if (v2 !== 2) errors.push("Update1: expected version=2, got " + v2);

  // 5. Update v3
  const upd2 = await call("PUT /todos (v3)", "PUT", "/todos/" + todoId, {
    title: "Updated v3",
  });
  const v3 = upd2.json.data?.version;
  console.log("   version after 2nd update:", v3);
  if (v3 !== 3) errors.push("Update2: expected version=3, got " + v3);

  // 6. History
  const hist = await call("GET history", "GET", "/todos/" + todoId + "/history");
  const versions = hist.json.data?.map((d) => d.version);
  const latestFlags = hist.json.data?.map((d) => d.isLatest);
  console.log("   history versions:", JSON.stringify(versions));
  console.log("   isLatest flags:  ", JSON.stringify(latestFlags));
  const latestCount = latestFlags?.filter(Boolean).length;
  if (latestCount !== 1)
    errors.push("History: expected 1 isLatest=true, got " + latestCount);
  else console.log("[PASS] Exactly 1 isLatest=true in history");
  if (JSON.stringify(versions) !== JSON.stringify([1, 2, 3]))
    errors.push("History: versions not [1,2,3], got " + JSON.stringify(versions));
  else console.log("[PASS] Versions sequential 1,2,3");

  // 7. Snapshot v1
  const snap1 = await call("GET snapshot v1", "GET", "/todos/" + todoId + "/snapshot/1");
  if (snap1.json.data?.title !== "Test Todo")
    errors.push("Snapshot v1: wrong title: " + snap1.json.data?.title);
  else console.log("[PASS] Snapshot v1 title correct");

  // 8. Snapshot v2
  const snap2 = await call("GET snapshot v2", "GET", "/todos/" + todoId + "/snapshot/2");
  if (snap2.json.data?.title !== "Updated v2")
    errors.push("Snapshot v2: wrong title: " + snap2.json.data?.title);
  else console.log("[PASS] Snapshot v2 title correct");

  // 9. Snapshot v3
  const snap3 = await call("GET snapshot v3", "GET", "/todos/" + todoId + "/snapshot/3");
  if (snap3.json.data?.title !== "Updated v3")
    errors.push("Snapshot v3: wrong title: " + snap3.json.data?.title);
  else console.log("[PASS] Snapshot v3 title correct");

  // 10. Delete
  const del = await call("DELETE /todos", "DELETE", "/todos/" + todoId);
  const delData = del.json.data;
  console.log("   isDeleted:", delData?.isDeleted, "| version:", delData?.version);
  if (!delData?.isDeleted) errors.push("Delete: isDeleted should be true");
  else console.log("[PASS] isDeleted=true");
  if (delData?.version !== 4) errors.push("Delete: expected version=4, got " + delData?.version);
  else console.log("[PASS] Delete created version 4");

  // 11. Deleted todo NOT in GET /todos
  const afterDel = await call("GET /todos after delete", "GET", "/todos");
  const stillVisible = afterDel.json.data?.find((t) => t.todoId === todoId);
  if (stillVisible) errors.push("GET /todos: deleted todo still visible");
  else console.log("[PASS] Deleted todo hidden from GET /todos");

  // 12. Snapshot of deleted version
  const snapDel = await call("GET snapshot v4 (deleted)", "GET", "/todos/" + todoId + "/snapshot/4");
  if (!snapDel.json.data?.isDeleted)
    errors.push("Snapshot v4: isDeleted should be true");
  else console.log("[PASS] Snapshot v4 has isDeleted=true");

  // 13. Full history after delete (4 versions)
  const hist2 = await call("GET history after delete", "GET", "/todos/" + todoId + "/history");
  const versions2 = hist2.json.data?.map((d) => d.version);
  if (JSON.stringify(versions2) !== JSON.stringify([1, 2, 3, 4]))
    errors.push("History after delete: expected [1,2,3,4], got " + JSON.stringify(versions2));
  else console.log("[PASS] Full history [1,2,3,4] after delete");

  // --- Edge cases ---
  // 14. Invalid todoId on DELETE
  const e1 = await fetch(BASE + "/todos/INVALID-NONEXISTENT-ID", { method: "DELETE" });
  const e1j = await e1.json();
  console.log("[" + (e1.status === 404 ? "PASS" : "FAIL") + "] DELETE invalid todoId -> HTTP " + e1.status);

  // 15. Snapshot version=0
  const e2 = await fetch(BASE + "/todos/" + todoId + "/snapshot/0");
  console.log("[" + (e2.status === 400 ? "PASS" : "FAIL") + "] Snapshot version=0 -> HTTP " + e2.status);

  // 16. Snapshot version=-1
  const e3 = await fetch(BASE + "/todos/" + todoId + "/snapshot/-1");
  console.log("[" + (e3.status === 400 ? "PASS" : "FAIL") + "] Snapshot version=-1 -> HTTP " + e3.status);

  // 17. POST with empty title
  const e4 = await fetch(BASE + "/todos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "   " }),
  });
  console.log("[" + (e4.status === 400 ? "PASS" : "FAIL") + "] POST empty title -> HTTP " + e4.status);

  // 18. PUT with no fields
  const e5 = await fetch(BASE + "/todos/someid", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  console.log("[" + (e5.status === 400 ? "PASS" : "FAIL") + "] PUT no fields -> HTTP " + e5.status);

  // 19. Non-existent version snapshot
  const e6 = await fetch(BASE + "/todos/" + todoId + "/snapshot/999");
  console.log("[" + (e6.status === 404 ? "PASS" : "FAIL") + "] Snapshot nonexistent version -> HTTP " + e6.status);

  // 20. 404 for unknown route
  const e7 = await fetch(BASE + "/unknown-route");
  console.log("[" + (e7.status === 404 ? "PASS" : "FAIL") + "] GET unknown route -> HTTP " + e7.status);

  // Summary
  console.log("\n========== TEST SUMMARY ==========");
  if (errors.length === 0) {
    console.log("ALL TESTS PASSED ✅ - Backend is fully stable");
  } else {
    console.log("FAILURES (" + errors.length + "):");
    errors.forEach((e) => console.log("  ✗ " + e));
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("TEST RUNNER CRASHED:", err.message);
  process.exit(1);
});
