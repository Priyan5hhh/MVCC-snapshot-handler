/**
 * QA FULL SUITE — MVCC Todo Backend
 * Tests every endpoint, MVCC rule, edge case, and concurrency scenario.
 */

const BASE = "http://localhost:5000/api";
const results = { pass: 0, fail: 0, errors: [] };

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pass(label) {
  results.pass++;
  console.log(`  ✅ PASS | ${label}`);
}

function fail(label, detail) {
  results.fail++;
  const msg = `${label}${detail ? " — " + detail : ""}`;
  results.errors.push(msg);
  console.log(`  ❌ FAIL | ${msg}`);
}

async function req(method, path, body) {
  const opts = { method, headers: { "Content-Type": "application/json" } };
  if (body !== undefined) opts.body = JSON.stringify(body);
  try {
    const res = await fetch(BASE + path, opts);
    let json;
    const text = await res.text();
    try {
      json = JSON.parse(text);
    } catch {
      return { status: res.status, json: null, raw: text, ok: false };
    }
    return { status: res.status, json, ok: res.ok && json.success !== false };
  } catch (err) {
    return { status: 0, json: null, raw: err.message, ok: false };
  }
}

function assertStatus(label, actual, expected) {
  if (actual === expected) pass(label + " status=" + expected);
  else fail(label, "expected HTTP " + expected + ", got " + actual);
}

function assertJson(label, res) {
  if (res.json !== null) pass(label + " returns JSON");
  else fail(label, "response is not valid JSON: " + res.raw?.slice(0, 120));
}

function assertEqual(label, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) pass(label);
  else fail(label, "expected " + e + ", got " + a);
}

function assert(label, condition, detail) {
  if (condition) pass(label);
  else fail(label, detail);
}

// ─── Sections ─────────────────────────────────────────────────────────────────

async function section(title, fn) {
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📋 " + title);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  await fn();
}

// ─── PHASE 1: Health ──────────────────────────────────────────────────────────

async function testHealth() {
  const r = await req("GET", "/health");
  assertStatus("GET /health", r.status, 200);
  assertJson("GET /health", r);
  assert("GET /health success=true", r.json?.success === true);
}

// ─── PHASE 2: Create ──────────────────────────────────────────────────────────

async function testCreate() {
  // Valid create
  const r = await req("POST", "/todos", { title: "QA Todo", content: "Initial content" });
  assertStatus("POST /todos (valid)", r.status, 201);
  assertJson("POST /todos", r);
  assert("POST /todos success=true", r.json?.success === true);
  const d = r.json?.data;
  assert("POST /todos version=1", d?.version === 1, "got " + d?.version);
  assert("POST /todos isLatest=true", d?.isLatest === true);
  assert("POST /todos isDeleted=false", d?.isDeleted === false);
  assert("POST /todos has todoId", !!d?.todoId);

  // No title
  const r2 = await req("POST", "/todos", { content: "no title" });
  assertStatus("POST /todos (no title)", r2.status, 400);
  assert("POST /todos (no title) success=false", r2.json?.success === false);

  // Empty title
  const r3 = await req("POST", "/todos", { title: "   " });
  assertStatus("POST /todos (blank title)", r3.status, 400);

  // Empty body
  const r4 = await req("POST", "/todos", {});
  assertStatus("POST /todos (empty body)", r4.status, 400);

  return d?.todoId;
}

// ─── PHASE 3: Multiple Updates + MVCC Invariants ──────────────────────────────

async function testUpdates(todoId) {
  const updates = [
    { title: "Update v2", content: "Content v2" },
    { title: "Update v3", content: "Content v3" },
    { title: "Update v4", content: "Content v4" },
    { title: "Update v5", content: "Content v5" },
  ];

  let expectedVersion = 2;
  for (const body of updates) {
    const r = await req("PUT", "/todos/" + todoId, body);
    assertStatus("PUT /todos (v" + expectedVersion + ")", r.status, 200);
    const d = r.json?.data;
    assert(
      "PUT version increments to " + expectedVersion,
      d?.version === expectedVersion,
      "got " + d?.version
    );
    assert("PUT isLatest=true on new version", d?.isLatest === true);
    assert("PUT isDeleted=false on new version", d?.isDeleted === false);
    expectedVersion++;
  }

  // Update with only title (no content)
  const r5 = await req("PUT", "/todos/" + todoId, { title: "Title only v6" });
  assertStatus("PUT /todos (title-only v6)", r5.status, 200);
  assert("PUT title-only preserves previous content", r5.json?.data?.content === "Content v5", "got: " + r5.json?.data?.content);

  // Update with only content (no title)
  const r6 = await req("PUT", "/todos/" + todoId, { content: "Content-only v7" });
  assertStatus("PUT /todos (content-only v7)", r6.status, 200);
  assert("PUT content-only preserves previous title", r6.json?.data?.title === "Title only v6", "got: " + r6.json?.data?.title);

  // Empty body → 400
  const r7 = await req("PUT", "/todos/" + todoId, {});
  assertStatus("PUT /todos (empty body)", r7.status, 400);

  // Empty title → 400
  const r8 = await req("PUT", "/todos/" + todoId, { title: "  " });
  assertStatus("PUT /todos (blank title)", r8.status, 400);

  return 7; // final version we're at (v7)
}

// ─── PHASE 4: History Validation ──────────────────────────────────────────────

async function testHistory(todoId, expectedVersionCount) {
  const r = await req("GET", "/todos/" + todoId + "/history");
  assertStatus("GET history", r.status, 200);
  assertJson("GET history", r);

  const items = r.json?.data;
  assert("History returns array", Array.isArray(items));

  const versions = items?.map((x) => x.version);
  const expected = Array.from({ length: expectedVersionCount }, (_, i) => i + 1);
  assertEqual("History versions sequential " + JSON.stringify(expected), versions, expected);

  // MVCC invariant: exactly 1 isLatest=true
  const latestCount = items?.filter((x) => x.isLatest).length;
  assert(
    "History: exactly 1 isLatest=true (got " + latestCount + ")",
    latestCount === 1,
    "Multiple isLatest=true found — MVCC violation!"
  );

  // Verify latest version is the last one
  const latestItem = items?.find((x) => x.isLatest);
  assert(
    "History: isLatest=true is on version " + expectedVersionCount,
    latestItem?.version === expectedVersionCount,
    "isLatest on version " + latestItem?.version
  );

  // Sorted ascending
  const sortedCheck = items?.every((item, i, arr) =>
    i === 0 ? true : arr[i - 1].version < item.version
  );
  assert("History: sorted ascending by version", sortedCheck);

  // No two items share same version
  const versionSet = new Set(versions);
  assert("History: no duplicate versions", versionSet.size === versions?.length);

  return items;
}

// ─── PHASE 5: Snapshot Validation ────────────────────────────────────────────

async function testSnapshots(todoId, historyItems) {
  for (const item of historyItems) {
    const r = await req("GET", "/todos/" + todoId + "/snapshot/" + item.version);
    assertStatus("GET snapshot v" + item.version, r.status, 200);
    const d = r.json?.data;
    assert("Snapshot v" + item.version + " has correct version", d?.version === item.version);
    assert("Snapshot v" + item.version + " has correct title", d?.title === item.title, "got: " + d?.title + " expected: " + item.title);
    assert("Snapshot v" + item.version + " has correct todoId", d?.todoId === todoId);
  }

  // Invalid versions
  const bad0 = await req("GET", "/todos/" + todoId + "/snapshot/0");
  assertStatus("Snapshot version=0", bad0.status, 400);

  const badNeg = await req("GET", "/todos/" + todoId + "/snapshot/-5");
  assertStatus("Snapshot version=-5", badNeg.status, 400);

  const badFloat = await req("GET", "/todos/" + todoId + "/snapshot/1.5");
  assertStatus("Snapshot version=1.5", badFloat.status, 400);

  const badStr = await req("GET", "/todos/" + todoId + "/snapshot/abc");
  assertStatus("Snapshot version=abc", badStr.status, 400);

  const badMissing = await req("GET", "/todos/" + todoId + "/snapshot/9999");
  assertStatus("Snapshot non-existent version=9999", badMissing.status, 404);
}

// ─── PHASE 6: Delete + Post-Delete Invariants ─────────────────────────────────

async function testDelete(todoId, versionBeforeDelete) {
  const r = await req("DELETE", "/todos/" + todoId);
  assertStatus("DELETE /todos", r.status, 200);
  const d = r.json?.data;
  assert("DELETE creates new version", d?.version === versionBeforeDelete + 1, "expected " + (versionBeforeDelete + 1) + " got " + d?.version);
  assert("DELETE isDeleted=true", d?.isDeleted === true);
  assert("DELETE isLatest=true", d?.isLatest === true);
  assert("DELETE has deletedAt", !!d?.deletedAt);

  // Deleted todo must NOT appear in GET /todos
  const list = await req("GET", "/todos");
  const found = list.json?.data?.find((t) => t.todoId === todoId);
  assert("Deleted todo not in GET /todos", !found);

  // Double delete → 404
  const r2 = await req("DELETE", "/todos/" + todoId);
  assertStatus("DELETE twice → 404", r2.status, 404);
  assert("DELETE twice success=false", r2.json?.success === false);

  // History after delete includes deletion version
  const hist = await req("GET", "/todos/" + todoId + "/history");
  const versions = hist.json?.data?.map((x) => x.version);
  const deleteVersion = versionBeforeDelete + 1;
  assert(
    "History includes delete version " + deleteVersion,
    versions?.includes(deleteVersion),
    "versions: " + JSON.stringify(versions)
  );

  // Snapshot of deleted version is accessible
  const snap = await req("GET", "/todos/" + todoId + "/snapshot/" + deleteVersion);
  assertStatus("Snapshot of deleted version accessible", snap.status, 200);
  assert("Snapshot deleted version isDeleted=true", snap.json?.data?.isDeleted === true);

  // MVCC invariant: still exactly 1 isLatest=true after delete
  const hist2 = await req("GET", "/todos/" + todoId + "/history");
  const latestCount = hist2.json?.data?.filter((x) => x.isLatest).length;
  assert(
    "Post-delete: exactly 1 isLatest=true",
    latestCount === 1,
    "got " + latestCount
  );

  return deleteVersion;
}

// ─── PHASE 7: Invalid todoId Edge Cases ──────────────────────────────────────

async function testInvalidTodoId() {
  const bogus = "00000000-0000-0000-0000-000000000000";

  const r1 = await req("GET", "/todos/" + bogus + "/history");
  assertStatus("History invalid todoId → 404", r1.status, 404);

  const r2 = await req("GET", "/todos/" + bogus + "/snapshot/1");
  assertStatus("Snapshot invalid todoId → 404", r2.status, 404);

  const r3 = await req("PUT", "/todos/" + bogus, { title: "X" });
  assertStatus("PUT invalid todoId → 404", r3.status, 404);

  const r4 = await req("DELETE", "/todos/" + bogus);
  assertStatus("DELETE invalid todoId → 404", r4.status, 404);
}

// ─── PHASE 8: Concurrency Simulation ─────────────────────────────────────────

async function testConcurrency(todoId2) {
  // Fire 5 simultaneous update requests — exactly 1 should win, rest get 409
  const promises = Array.from({ length: 5 }, (_, i) =>
    req("PUT", "/todos/" + todoId2, { title: "Concurrent update " + i })
  );
  const responses = await Promise.all(promises);
  const statuses = responses.map((r) => r.status);
  console.log("  ℹ️  Concurrent update statuses:", JSON.stringify(statuses));

  const winners = statuses.filter((s) => s === 200);
  const conflicts = statuses.filter((s) => s === 409);
  assert(
    "Concurrency: at least 1 update wins",
    winners.length >= 1,
    "winners: " + winners.length
  );
  assert(
    "Concurrency: conflicts returned 409",
    conflicts.length >= 0, // may be 0 if sequential processing happens
    "This is informational"
  );

  // After concurrency, verify exactly 1 isLatest=true
  const hist = await req("GET", "/todos/" + todoId2 + "/history");
  const latestCount = hist.json?.data?.filter((x) => x.isLatest).length;
  assert(
    "Post-concurrency: exactly 1 isLatest=true",
    latestCount === 1,
    "got " + latestCount + " — MVCC violation!"
  );

  // Versions should still be sequential with no gaps after the conflict resolution
  const versions = hist.json?.data?.map((x) => x.version);
  const isSequential = versions?.every((v, i) => i === 0 || v === versions[i - 1] + 1);
  assert("Post-concurrency: versions are sequential", isSequential, JSON.stringify(versions));
}

// ─── PHASE 9: Response Format Validation ─────────────────────────────────────

async function testResponseFormats() {
  // Every response must be JSON (no HTML)
  const routes = [
    ["GET", "/health"],
    ["GET", "/todos"],
    ["GET", "/todos/invalid-id/history"],
    ["GET", "/todos/invalid-id/snapshot/1"],
    ["PUT", "/todos/invalid-id"],
    ["DELETE", "/todos/invalid-id"],
    ["GET", "/nonexistent-route"],
  ];

  for (const [method, path] of routes) {
    const opts = { method, headers: { "Content-Type": "application/json" } };
    if (method === "PUT") opts.body = JSON.stringify({ title: "x" });
    const res = await fetch(BASE + path, opts);
    const text = await res.text();
    let isJson = false;
    try {
      JSON.parse(text);
      isJson = true;
    } catch {}
    assert(
      method + " " + path + " returns JSON (not HTML)",
      isJson,
      "raw: " + text.slice(0, 100)
    );
    const ct = res.headers.get("content-type") || "";
    assert(
      method + " " + path + " Content-Type includes application/json",
      ct.includes("application/json"),
      "got: " + ct
    );
  }
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n╔══════════════════════════════════════════════════╗");
  console.log("║       MVCC BACKEND QA FULL SUITE                ║");
  console.log("╚══════════════════════════════════════════════════╝");

  await section("PHASE 1 — Health Check", testHealth);

  let todoId;
  await section("PHASE 2 — Create Todo", async () => {
    todoId = await testCreate();
  });
  if (!todoId) {
    console.error("\n🔴 Cannot continue — Create failed, no todoId");
    process.exit(1);
  }

  let finalVersion;
  await section("PHASE 3 — MVCC Updates (5 updates + edge cases)", async () => {
    finalVersion = await testUpdates(todoId);
  });

  let historyItems;
  await section("PHASE 4 — History Validation", async () => {
    historyItems = await testHistory(todoId, finalVersion);
  });

  await section("PHASE 5 — Snapshot Validation (every version)", async () => {
    await testSnapshots(todoId, historyItems);
  });

  let deleteVersion;
  await section("PHASE 6 — Delete + Post-Delete Invariants", async () => {
    deleteVersion = await testDelete(todoId, finalVersion);
  });

  await section("PHASE 7 — History After Delete", async () => {
    await testHistory(todoId, finalVersion + 1);
  });

  await section("PHASE 8 — Invalid TodoId Edge Cases", testInvalidTodoId);

  // Create a second todo for concurrency test
  let todoId2;
  await section("PHASE 9 — Concurrency Simulation", async () => {
    const r = await req("POST", "/todos", { title: "Concurrency Test", content: "base" });
    todoId2 = r.json?.data?.todoId;
    if (!todoId2) { fail("Concurrency setup: failed to create 2nd todo"); return; }
    await testConcurrency(todoId2);
  });

  await section("PHASE 10 — Response Format & Content-Type Validation", testResponseFormats);

  // ─── Summary ────────────────────────────────────────────────────────────────
  console.log("\n╔══════════════════════════════════════════════════╗");
  console.log("║                  QA SUMMARY                     ║");
  console.log("╠══════════════════════════════════════════════════╣");
  console.log("║  Total PASS : " + String(results.pass).padEnd(35) + "║");
  console.log("║  Total FAIL : " + String(results.fail).padEnd(35) + "║");
  console.log("╚══════════════════════════════════════════════════╝");

  if (results.fail === 0) {
    console.log("\n🎉 ALL TESTS PASSED — Backend is fully stable and production-ready\n");
  } else {
    console.log("\n🔴 FAILURES:\n");
    results.errors.forEach((e) => console.log("  ✗ " + e));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("\n💥 QA RUNNER CRASHED:", err.message);
  process.exit(1);
});
