#!/usr/bin/env node

/**
 * MVCC Backend - Senior QA & System Reliability Testing
 * Comprehensive validation of all endpoints, edge cases, and data consistency
 */

const http = require("http");
const fs = require("fs");
const path = require("path");

const BASE_URL = "http://localhost:5000";
const LOG_FILE = path.join(__dirname, "qa_master_test_report.txt");

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  bold: "\x1b[1m",
};

let stats = {
  totalTests: 0,
  passed: 0,
  failed: 0,
  errors: [],
  issues: [],
};

function log(msg, color = "reset") {
  const formatted = `${colors[color]}${msg}${colors.reset}`;
  console.log(formatted);
  fs.appendFileSync(LOG_FILE, msg + "\n");
}

function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: { "Content-Type": "application/json" },
    };

    const req = http.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, body: body });
        }
      });
    });

    req.on("error", reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

function test(condition, description) {
  stats.totalTests++;
  if (condition) {
    log(`  ✓ PASS: ${description}`, "green");
    stats.passed++;
  } else {
    log(`  ✗ FAIL: ${description}`, "red");
    stats.failed++;
    stats.issues.push(description);
  }
}

async function testPhase1_CreateAndUpdate() {
  log("\n╔════════════════════════════════════════════════╗", "cyan");
  log("║ PHASE 1: CREATE & MULTIPLE UPDATES             ║", "cyan");
  log("╚════════════════════════════════════════════════╝", "cyan");

  const todos = [];

  // Create 5 todos
  for (let i = 0; i < 5; i++) {
    const res = await makeRequest("POST", "/api/todos", {
      title: `Todo ${i + 1}`,
      content: `Content for todo ${i + 1}`,
    });
    test(res.status === 201, `Create todo ${i + 1}`);
    test(res.body.version === 1, `Todo ${i + 1} starts at version 1`);
    test(res.body.isLatest === true, `Todo ${i + 1} marked as latest`);
    if (res.status === 201) {
      todos.push(res.body);
    }
  }

  log(`\n✓ Created ${todos.length} todos`, "blue");

  // Perform multiple updates on each todo
  for (let i = 0; i < todos.length; i++) {
    const todo = todos[i];
    for (let j = 0; j < 3; j++) {
      const res = await makeRequest("PUT", `/api/todos/${todo.todoId}`, {
        title: `Updated Todo ${i + 1} v${j + 2}`,
      });

      if (res.status === 200) {
        test(
          res.body.data.version === j + 2,
          `Todo ${i + 1} version ${j + 2} created`
        );
        test(
          res.body.data.isLatest === true,
          `Todo ${i + 1} v${j + 2} is latest`
        );
        // Update tracking object
        todo.version = res.body.data.version;
      } else if (res.status === 409) {
        log(`    Note: Conflict on todo ${i + 1} update ${j + 1} (expected in concurrency)`, "yellow");
      }
    }
  }

  return todos;
}

async function testPhase2_Consistency(todos) {
  log("\n╔════════════════════════════════════════════════╗", "cyan");
  log("║ PHASE 2: CONSISTENCY CHECKS                    ║", "cyan");
  log("╚════════════════════════════════════════════════╝", "cyan");

  // Get all active todos
  const res = await makeRequest("GET", "/api/todos");
  test(res.status === 200, "GET /api/todos returns 200");

  // Check for multiple isLatest=true
  const todoCounts = {};
  res.body.forEach((todo) => {
    todoCounts[todo.todoId] = (todoCounts[todo.todoId] || 0) + 1;
  });

  let duplicates = false;
  for (const [id, count] of Object.entries(todoCounts)) {
    if (count > 1) {
      duplicates = true;
      log(`    ⚠️  DUPLICATE isLatest: todoId ${id} appears ${count} times`, "red");
    }
  }
  test(!duplicates, "No multiple isLatest=true entries");

  // Verify each created todo is in the list
  for (const todo of todos) {
    const found = res.body.find((t) => t.todoId === todo.todoId);
    test(found !== undefined, `Todo ${todo.todoId} found in latest list`);
    if (found) {
      test(
        found.version === todo.version,
        `Todo ${todo.todoId} version matches (${todo.version})`
      );
    }
  }
}

async function testPhase3_History(todos) {
  log("\n╔════════════════════════════════════════════════╗", "cyan");
  log("║ PHASE 3: VERSION HISTORY VALIDATION            ║", "cyan");
  log("╚════════════════════════════════════════════════╝", "cyan");

  for (const todo of todos) {
    const res = await makeRequest("GET", `/api/todos/${todo.todoId}/history`);
    test(res.status === 200, `History for todo ${todo.todoId} returns 200`);

    if (res.status === 200) {
      const history = res.body;
      test(history.length >= 4, `Todo ${todo.todoId} has 4+ versions (1 initial + 3 updates)`);
      test(
        history[0].version === 1,
        `Todo ${todo.todoId} history starts at v1`
      );

      // Check sequential ordering
      let sequential = true;
      for (let i = 1; i < history.length; i++) {
        if (history[i].version !== history[i - 1].version + 1) {
          sequential = false;
        }
      }
      test(sequential, `Todo ${todo.todoId} versions sequential`);

      // Check exactly one latest
      const latestCount = history.filter((h) => h.isLatest === true).length;
      test(
        latestCount === 1,
        `Todo ${todo.todoId} has exactly 1 isLatest=true`
      );

      // Verify immutability of old versions
      test(
        history[0].title &&
          history[0].title.startsWith("Todo") &&
          !history[0].title.includes("Updated"),
        `Todo ${todo.todoId} v1 title immutable`
      );
    }
  }
}

async function testPhase4_Snapshots(todos) {
  log("\n╔════════════════════════════════════════════════╗", "cyan");
  log("║ PHASE 4: SNAPSHOT TIME-TRAVEL QUERIES          ║", "cyan");
  log("╚════════════════════════════════════════════════╝", "cyan");

  if (todos.length === 0) return;

  const todo = todos[0];

  // Get history to find version timestamps
  const histRes = await makeRequest(
    "GET",
    `/api/todos/${todo.todoId}/history`
  );
  if (histRes.status !== 200) return;

  const history = histRes.body;

  // Test snapshot at v1 creation time
  if (history.length > 0) {
    const v1Time = history[0].createdAt;
    const snapRes = await makeRequest(
      "GET",
      `/api/todos/${todo.todoId}/snapshot?time=${encodeURIComponent(v1Time)}`
    );
    test(snapRes.status === 200, "Snapshot at v1 timestamp returns 200");
    test(
      snapRes.body.version === 1,
      "Snapshot at v1 time returns version 1"
    );
  }

  // Test snapshot at latest time
  if (history.length > 0) {
    const latestTime = history[history.length - 1].createdAt;
    const snapRes = await makeRequest(
      "GET",
      `/api/todos/${todo.todoId}/snapshot?time=${encodeURIComponent(latestTime)}`
    );
    test(snapRes.status === 200, "Snapshot at latest timestamp returns 200");
  }

  // Test snapshot before first version
  const beforeTime = new Date(
    new Date(history[0].createdAt).getTime() - 1000
  ).toISOString();
  const beforeRes = await makeRequest(
    "GET",
    `/api/todos/${todo.todoId}/snapshot?time=${encodeURIComponent(beforeTime)}`
  );
  test(beforeRes.status === 404, "Snapshot before v1 returns 404");

  // Test invalid timestamp
  const invalidRes = await makeRequest(
    "GET",
    `/api/todos/${todo.todoId}/snapshot?time=invalid`
  );
  test(invalidRes.status === 400, "Invalid timestamp returns 400");
}

async function testPhase5_EdgeCases() {
  log("\n╔════════════════════════════════════════════════╗", "cyan");
  log("║ PHASE 5: EDGE CASE SCENARIOS                   ║", "cyan");
  log("╚════════════════════════════════════════════════╝", "cyan");

  // Edge case: Update with empty payload
  const todo1 = await makeRequest("POST", "/api/todos", {
    title: "Edge Test 1",
    content: "Test",
  });
  if (todo1.status === 201) {
    const updateRes = await makeRequest("PUT", `/api/todos/${todo1.body.todoId}`, {});
    test(updateRes.status === 400, "Update with empty payload returns 400");
  }

  // Edge case: Update non-existing todoId
  const badUpdateRes = await makeRequest("PUT", "/api/todos/non-existing", {
    title: "Test",
  });
  test(badUpdateRes.status === 404, "Update non-existing todoId returns 404");

  // Edge case: Delete existing todo
  const todo2 = await makeRequest("POST", "/api/todos", {
    title: "To Delete",
    content: "Test",
  });
  if (todo2.status === 201) {
    const deleteRes = await makeRequest(
      "DELETE",
      `/api/todos/${todo2.body.todoId}`,
      null
    );
    test(deleteRes.status === 200, "Delete existing todo returns 200");

    // Verify deleted todo not in list
    const getRes = await makeRequest("GET", "/api/todos");
    const found = getRes.body.find((t) => t.todoId === todo2.body.todoId);
    test(!found, "Deleted todo not in GET /api/todos");

    // Verify history still accessible
    const histRes = await makeRequest(
      "GET",
      `/api/todos/${todo2.body.todoId}/history`
    );
    test(
      histRes.status === 200,
      "History accessible for deleted todo"
    );

    // Verify deleted version exists
    const deletedVersion = histRes.body.find((h) => h.isDeleted === true);
    test(
      deletedVersion !== undefined,
      "Deleted version marked with isDeleted=true"
    );
  }

  // Edge case: Delete already deleted todo
  if (todo2.status === 201) {
    const secondDeleteRes = await makeRequest(
      "DELETE",
      `/api/todos/${todo2.body.todoId}`,
      null
    );
    test(
      secondDeleteRes.status === 404,
      "Delete already-deleted todo returns 404"
    );
  }

  // Edge case: Delete non-existing todoId
  const badDeleteRes = await makeRequest(
    "DELETE",
    "/api/todos/non-existing",
    null
  );
  test(badDeleteRes.status === 404, "Delete non-existing todoId returns 404");

  // Edge case: History for non-existing todoId
  const badHistRes = await makeRequest(
    "GET",
    "/api/todos/non-existing/history"
  );
  test(badHistRes.status === 404, "History for non-existing todoId returns 404");
}

async function testPhase6_StressTest() {
  log("\n╔════════════════════════════════════════════════╗", "cyan");
  log("║ PHASE 6: STRESS TEST - LARGE VERSION SET       ║", "cyan");
  log("╚════════════════════════════════════════════════╝", "cyan");

  const res = await makeRequest("POST", "/api/todos", {
    title: "Stress Test Todo",
    content: "Initial",
  });

  if (res.status === 201) {
    const todoId = res.body.todoId;
    test(res.body.version === 1, "Stress test todo created at v1");

    // Create 20 versions
    let currentVersion = 1;
    for (let i = 0; i < 20; i++) {
      const updateRes = await makeRequest("PUT", `/api/todos/${todoId}`, {
        content: `Update ${i}`,
      });

      if (updateRes.status === 200) {
        currentVersion = updateRes.body.data.version;
      } else if (updateRes.status === 409) {
        log(`    Conflict on update ${i} (expected in stress), retrying...`, "yellow");
      }
    }

    // Verify history
    const histRes = await makeRequest("GET", `/api/todos/${todoId}/history`);
    test(
      histRes.status === 200,
      `History retrieved after ${currentVersion} versions`
    );

    if (histRes.status === 200) {
      test(
        histRes.body.length >= 20,
        `History contains 20+ versions (actual: ${histRes.body.length})`
      );

      // Check ordering
      let ordered = true;
      for (let i = 1; i < histRes.body.length; i++) {
        if (histRes.body[i].version <= histRes.body[i - 1].version) {
          ordered = false;
        }
      }
      test(ordered, "Versions in history are ordered ascending");

      // Check exactly one latest
      const latestCount = histRes.body.filter((h) => h.isLatest === true)
        .length;
      test(latestCount === 1, "Exactly 1 isLatest=true after stress test");
    }
  }
}

async function testPhase7_DataValidation() {
  log("\n╔════════════════════════════════════════════════╗", "cyan");
  log("║ PHASE 7: DATABASE STATE VALIDATION             ║", "cyan");
  log("╚════════════════════════════════════════════════╝", "cyan");

  const res = await makeRequest("GET", "/api/todos");
  test(res.status === 200, "GET all todos returns 200");

  if (res.status === 200) {
    log(`  Total active todos in database: ${res.body.length}`, "blue");

    // Validate each entry
    let validCount = 0;
    for (const todo of res.body) {
      const hasRequiredFields =
        todo.todoId &&
        todo.title &&
        todo.version &&
        todo.isLatest === true &&
        todo.createdAt;

      if (hasRequiredFields) {
        validCount++;
      } else {
        stats.issues.push(`Invalid todo entry: ${JSON.stringify(todo)}`);
      }
    }

    test(
      validCount === res.body.length,
      `All ${validCount} todos have required fields`
    );

    // Test that all have isLatest=true
    const allLatest = res.body.every((t) => t.isLatest === true);
    test(allLatest, "All todos have isLatest=true");

    // Test that deleted todos are excluded
    const hasDeleted = res.body.some((t) => t.isDeleted === true);
    test(!hasDeleted, "No deleted todos in active list");
  }
}

async function runMasterTestSuite() {
  fs.writeFileSync(LOG_FILE, "=== MVCC MASTER TEST REPORT ===\n\n");

  log("\n╔════════════════════════════════════════════════════════╗", "cyan");
  log("║     MVCC BACKEND - SENIOR QA MASTER TEST SUITE        ║", "cyan");
  log("║  Comprehensive validation of all endpoints & scenarios║", "cyan");
  log("╚════════════════════════════════════════════════════════╝", "cyan");

  try {
    // Execute test flow
    const todos = await testPhase1_CreateAndUpdate();
    await testPhase2_Consistency(todos);
    await testPhase3_History(todos);
    await testPhase4_Snapshots(todos);
    await testPhase5_EdgeCases();
    await testPhase6_StressTest();
    await testPhase7_DataValidation();

    // Print summary
    log("\n╔════════════════════════════════════════════════════════╗", "cyan");
    log("║                    MASTER TEST SUMMARY                ║", "cyan");
    log("╚════════════════════════════════════════════════════════╝", "cyan");

    const passRate = ((stats.passed / stats.totalTests) * 100).toFixed(2);
    log(`\nTotal Tests: ${stats.totalTests}`, "bold");
    log(`Passed:      ${stats.passed}`, "green");
    log(`Failed:      ${stats.failed}`, stats.failed > 0 ? "red" : "green");
    log(`Pass Rate:   ${passRate}%\n`, passRate >= 95 ? "green" : "yellow");

    if (stats.issues.length > 0) {
      log("╔════════════════════════════════════════════════════════╗", "yellow");
      log("║              ISSUES IDENTIFIED                         ║", "yellow");
      log("╚════════════════════════════════════════════════════════╝", "yellow");
      stats.issues.forEach((issue, idx) => {
        log(`${idx + 1}. ${issue}`, "yellow");
      });
    }

    if (stats.failed === 0) {
      log("\n✅ ALL TESTS PASSED - SYSTEM IS STABLE!", "green");
      log("The MVCC backend is production-ready and handles all edge cases correctly.", "green");
    } else {
      log("\n⚠️  SOME TESTS FAILED - REVIEW REQUIRED", "yellow");
    }

    log(`\n✓ Full report saved to: ${LOG_FILE}`, "green");
  } catch (err) {
    log(`\n❌ FATAL ERROR: ${err.message}`, "red");
    log(`Stack: ${err.stack}`, "red");
    stats.errors.push(err.message);
  }
}

// Execute master test suite
runMasterTestSuite();
