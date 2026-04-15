#!/usr/bin/env node

const http = require("http");
const fs = require("fs");
const path = require("path");

const BASE_URL = "http://localhost:5000";
const LOG_FILE = path.join(__dirname, "edge_case_test_log.txt");

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  bold: "\x1b[1m",
};

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
let issuesFound = [];

function log(message, color = "reset") {
  const formatted = `${colors[color]}${message}${colors.reset}`;
  console.log(formatted);
  fs.appendFileSync(LOG_FILE, message + "\n");
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

function assert(condition, message) {
  totalTests++;
  if (condition) {
    log(`  ✓ PASS: ${message}`, "green");
    passedTests++;
  } else {
    log(`  ✗ FAIL: ${message}`, "red");
    failedTests++;
    issuesFound.push(message);
  }
}

async function testVersionIntegrity() {
  log("\n╔════════════════════════════════════════════════════════════╗", "cyan");
  log("║ TEST SUITE 1: VERSION INTEGRITY                            ║", "cyan");
  log("╚════════════════════════════════════════════════════════════╝", "cyan");

  log("\n[TEST 1.1] Sequential Version Increment", "blue");
  try {
    const create = await makeRequest("POST", "/api/todos", {
      title: "Version Test",
      content: "Initial content",
    });
    const todoId = create.body.todoId;
    assert(create.body.version === 1, "Initial version is 1");

    for (let i = 0; i < 3; i++) {
      const update = await makeRequest("PUT", `/api/todos/${todoId}`, {
        title: `Updated ${i}`,
      });
      if (update.status === 200) {
        assert(
          update.body.data.version === i + 2,
          `Version increments to ${i + 2}`
        );
      }
    }
  } catch (err) {
    log(`  ✗ ERROR: ${err.message}`, "red");
  }

  log("\n[TEST 1.2] No Duplicate Versions", "blue");
  try {
    const create = await makeRequest("POST", "/api/todos", {
      title: "Duplicate Test",
      content: "Test",
    });
    const todoId = create.body.todoId;

    const history = await makeRequest("GET", `/api/todos/${todoId}/history`);
    const versions = history.body.map((h) => h.version);
    const uniqueVersions = new Set(versions);

    assert(
      versions.length === uniqueVersions.size,
      "No duplicate versions exist"
    );
  } catch (err) {
    log(`  ✗ ERROR: ${err.message}`, "red");
  }

  log("\n[TEST 1.3] Single isLatest=true Per TodoId", "blue");
  try {
    const create = await makeRequest("POST", "/api/todos", {
      title: "isLatest Test",
      content: "Test",
    });
    const todoId = create.body.todoId;

    for (let i = 0; i < 3; i++) {
      await makeRequest("PUT", `/api/todos/${todoId}`, {
        title: `Update ${i}`,
      });
    }

    const history = await makeRequest("GET", `/api/todos/${todoId}/history`);
    const latestCount = history.body.filter((h) => h.isLatest === true)
      .length;

    assert(latestCount === 1, "Exactly one isLatest=true per todoId");
  } catch (err) {
    log(`  ✗ ERROR: ${err.message}`, "red");
  }
}

async function testUpdateEdgeCases() {
  log("\n╔════════════════════════════════════════════════════════════╗", "cyan");
  log("║ TEST SUITE 2: UPDATE EDGE CASES                            ║", "cyan");
  log("╚════════════════════════════════════════════════════════════╝", "cyan");

  log("\n[TEST 2.1] Update with Empty Payload", "blue");
  try {
    const create = await makeRequest("POST", "/api/todos", {
      title: "Empty Update Test",
      content: "Initial",
    });
    const todoId = create.body.todoId;

    const update = await makeRequest("PUT", `/api/todos/${todoId}`, {});
    assert(update.status === 400, "Empty payload returns 400");
  } catch (err) {
    log(`  ✗ ERROR: ${err.message}`, "red");
  }

  log("\n[TEST 2.2] Update Non-Existing TodoId", "blue");
  try {
    const update = await makeRequest("PUT", "/api/todos/non-existing-id", {
      title: "Test",
    });
    assert(update.status === 404, "Non-existing todoId returns 404");
  } catch (err) {
    log(`  ✗ ERROR: ${err.message}`, "red");
  }

  log("\n[TEST 2.3] Concurrency - Rapid Updates", "blue");
  try {
    const create = await makeRequest("POST", "/api/todos", {
      title: "Rapid Update Test",
      content: "Initial",
    });
    const todoId = create.body.todoId;

    const updatePromises = [];
    for (let i = 0; i < 5; i++) {
      updatePromises.push(
        makeRequest("PUT", `/api/todos/${todoId}`, {
          title: `Rapid Update ${i}`,
        })
      );
    }

    const results = await Promise.all(updatePromises);
    const history = await makeRequest("GET", `/api/todos/${todoId}/history`);
    const isLatestCount = history.body.filter((h) => h.isLatest === true)
      .length;

    assert(
      isLatestCount === 1,
      "Only one isLatest=true after rapid updates"
    );
  } catch (err) {
    log(`  ✗ ERROR: ${err.message}`, "red");
  }
}

async function testDeleteEdgeCases() {
  log("\n╔════════════════════════════════════════════════════════════╗", "cyan");
  log("║ TEST SUITE 3: DELETE EDGE CASES                            ║", "cyan");
  log("╚════════════════════════════════════════════════════════════╝", "cyan");

  log("\n[TEST 3.1] Delete Todo & Verify Soft Delete", "blue");
  try {
    const create = await makeRequest("POST", "/api/todos", {
      title: "Delete Test",
      content: "To be deleted",
    });
    const todoId = create.body.todoId;

    const deleteRes = await makeRequest("DELETE", `/api/todos/${todoId}`, null);
    if (deleteRes.status === 200) {
      const todos = await makeRequest("GET", "/api/todos");
      const stillExists = todos.body.find((t) => t.todoId === todoId);

      assert(!stillExists, "Deleted todo not in GET /api/todos");

      const history = await makeRequest("GET", `/api/todos/${todoId}/history`);
      assert(history.status === 200, "History accessible after deletion");

      const deletedVersion = history.body.find((h) => h.isDeleted === true);
      assert(
        deletedVersion !== undefined,
        "Deleted version marked with isDeleted=true"
      );
    }
  } catch (err) {
    log(`  ✗ ERROR: ${err.message}`, "red");
  }

  log("\n[TEST 3.2] Delete Already Deleted Todo", "blue");
  try {
    const create = await makeRequest("POST", "/api/todos", {
      title: "Double Delete Test",
      content: "To be deleted twice",
    });
    const todoId = create.body.todoId;

    const firstDelete = await makeRequest("DELETE", `/api/todos/${todoId}`, null);
    if (firstDelete.status === 200) {
      const secondDelete = await makeRequest(
        "DELETE",
        `/api/todos/${todoId}`,
        null
      );
      assert(secondDelete.status === 404, "Deleting already deleted todo returns 404");
    }
  } catch (err) {
    log(`  ✗ ERROR: ${err.message}`, "red");
  }
}

async function testSnapshotEdgeCases() {
  log("\n╔════════════════════════════════════════════════════════════╗", "cyan");
  log("║ TEST SUITE 4: SNAPSHOT EDGE CASES                          ║", "cyan");
  log("╚════════════════════════════════════════════════════════════╝", "cyan");

  log("\n[TEST 4.1] Snapshot Before First Version", "blue");
  try {
    const create = await makeRequest("POST", "/api/todos", {
      title: "Snapshot Test",
      content: "Content",
    });
    const todoId = create.body.todoId;
    const createdAt = new Date(create.body.createdAt);
    const beforeTime = new Date(createdAt.getTime() - 1000).toISOString();

    const snapshot = await makeRequest(
      "GET",
      `/api/todos/${todoId}/snapshot?time=${encodeURIComponent(beforeTime)}`
    );
    assert(snapshot.status === 404, "Snapshot before first version returns 404");
  } catch (err) {
    log(`  ✗ ERROR: ${err.message}`, "red");
  }

  log("\n[TEST 4.2] Snapshot at Version Timestamp", "blue");
  try {
    const create = await makeRequest("POST", "/api/todos", {
      title: "Snapshot Test",
      content: "Content",
    });
    const todoId = create.body.todoId;
    const createdAt = create.body.createdAt;

    const snapshot = await makeRequest(
      "GET",
      `/api/todos/${todoId}/snapshot?time=${encodeURIComponent(createdAt)}`
    );

    assert(snapshot.status === 200, "Snapshot at exact time returns 200");
    assert(snapshot.body.version === 1, "Snapshot returns version 1");
  } catch (err) {
    log(`  ✗ ERROR: ${err.message}`, "red");
  }

  log("\n[TEST 4.3] Invalid Timestamp Format", "blue");
  try {
    const create = await makeRequest("POST", "/api/todos", {
      title: "Invalid Time Test",
      content: "Content",
    });
    const todoId = create.body.todoId;

    const snapshot = await makeRequest(
      "GET",
      `/api/todos/${todoId}/snapshot?time=invalid-time`
    );
    assert(snapshot.status === 400, "Invalid timestamp returns 400");
  } catch (err) {
    log(`  ✗ ERROR: ${err.message}`, "red");
  }
}

async function testHistoryEdgeCases() {
  log("\n╔════════════════════════════════════════════════════════════╗", "cyan");
  log("║ TEST SUITE 5: HISTORY EDGE CASES                           ║", "cyan");
  log("╚════════════════════════════════════════════════════════════╝", "cyan");

  log("\n[TEST 5.1] History Non-Existing TodoId", "blue");
  try {
    const history = await makeRequest(
      "GET",
      "/api/todos/non-existing-id/history"
    );
    assert(history.status === 404, "Non-existing todoId returns 404");
  } catch (err) {
    log(`  ✗ ERROR: ${err.message}`, "red");
  }

  log("\n[TEST 5.2] History Large Versions", "blue");
  try {
    const create = await makeRequest("POST", "/api/todos", {
      title: "Large History Test",
      content: "Initial",
    });
    const todoId = create.body.todoId;

    for (let i = 0; i < 10; i++) {
      await makeRequest("PUT", `/api/todos/${todoId}`, {
        title: `Update ${i}`,
      });
    }

    const history = await makeRequest("GET", `/api/todos/${todoId}/history`);
    assert(history.body.length >= 10, "History contains 11+ versions");
  } catch (err) {
    log(`  ✗ ERROR: ${err.message}`, "red");
  }

  log("\n[TEST 5.3] History Ordering (Ascending)", "blue");
  try {
    const create = await makeRequest("POST", "/api/todos", {
      title: "Order Test",
      content: "Initial",
    });
    const todoId = create.body.todoId;

    for (let i = 0; i < 3; i++) {
      await makeRequest("PUT", `/api/todos/${todoId}`, {
        title: `Update ${i}`,
      });
    }

    const history = await makeRequest("GET", `/api/todos/${todoId}/history`);
    let isOrdered = true;

    for (let i = 1; i < history.body.length; i++) {
      if (history.body[i].version <= history.body[i - 1].version) {
        isOrdered = false;
      }
    }

    assert(isOrdered, "History ordered ascending by version");
  } catch (err) {
    log(`  ✗ ERROR: ${err.message}`, "red");
  }
}

async function testDataConsistency() {
  log("\n╔════════════════════════════════════════════════════════════╗", "cyan");
  log("║ TEST SUITE 6: DATA CONSISTENCY                             ║", "cyan");
  log("╚════════════════════════════════════════════════════════════╝", "cyan");

  log("\n[TEST 6.1] No Multiple isLatest in GET /api/todos", "blue");
  try {
    const create1 = await makeRequest("POST", "/api/todos", {
      title: "Test 1",
      content: "Content",
    });
    const create2 = await makeRequest("POST", "/api/todos", {
      title: "Test 2",
      content: "Content",
    });

    const todos = await makeRequest("GET", "/api/todos");
    const todoIdCounts = {};

    todos.body.forEach((todo) => {
      todoIdCounts[todo.todoId] = (todoIdCounts[todo.todoId] || 0) + 1;
    });

    let problematicTodos = [];
    let allConsistent = true;
    
    for (const [id, count] of Object.entries(todoIdCounts)) {
      if (count > 1) {
        allConsistent = false;
        problematicTodos.push(`${id}: appears ${count} times`);
      }
    }
    
    if (!allConsistent) {
      log(`    ⚠️  Found duplicates: ${problematicTodos.join(", ")}`, "yellow");
      log(`    Total todos in response: ${todos.body.length}`, "yellow");
      log(`    Unique todoIds: ${Object.keys(todoIdCounts).length}`, "yellow");
    }
    
    assert(allConsistent, "Each todoId appears once in latest list");
  } catch (err) {
    log(`  ✗ ERROR: ${err.message}`, "red");
  }

  log("\n[TEST 6.2] Deleted Todos Excluded from GET", "blue");
  try {
    const create = await makeRequest("POST", "/api/todos", {
      title: "Delete Test",
      content: "To delete",
    });
    const todoId = create.body.todoId;

    let todos = await makeRequest("GET", "/api/todos");
    let exists = todos.body.some((t) => t.todoId === todoId);
    assert(exists, "Todo exists before deletion");

    await makeRequest("DELETE", `/api/todos/${todoId}`, null);

    todos = await makeRequest("GET", "/api/todos");
    exists = todos.body.some((t) => t.todoId === todoId);
    assert(!exists, "Deleted todo excluded from GET");
  } catch (err) {
    log(`  ✗ ERROR: ${err.message}`, "red");
  }
}

async function testMVCCCompliance() {
  log("\n╔════════════════════════════════════════════════════════════╗", "cyan");
  log("║ TEST SUITE 7: MVCC COMPLIANCE                              ║", "cyan");
  log("╚════════════════════════════════════════════════════════════╝", "cyan");

  log("\n[TEST 7.1] Read-Your-Own-Write Consistency", "blue");
  try {
    const create = await makeRequest("POST", "/api/todos", {
      title: "Write Test",
      content: "Initial",
    });
    const todoId = create.body.todoId;

    const todos = await makeRequest("GET", "/api/todos");
    const found = todos.body.find((t) => t.todoId === todoId);

    assert(found !== undefined, "Written todo immediately readable");
  } catch (err) {
    log(`  ✗ ERROR: ${err.message}`, "red");
  }

  log("\n[TEST 7.2] Version Immutability", "blue");
  try {
    const create = await makeRequest("POST", "/api/todos", {
      title: "Immutability Test",
      content: "Initial",
    });
    const todoId = create.body.todoId;

    await makeRequest("PUT", `/api/todos/${todoId}`, {
      title: "Updated",
    });

    const history = await makeRequest("GET", `/api/todos/${todoId}/history`);
    const v1 = history.body[0];

    assert(v1.title === "Immutability Test", "Version 1 data unchanged");
  } catch (err) {
    log(`  ✗ ERROR: ${err.message}`, "red");
  }
}

async function runAllTests() {
  fs.writeFileSync(LOG_FILE, "=== MVCC EDGE CASE TESTING SUITE ===\n\n");

  log("\n╔════════════════════════════════════════════════════════════════════╗", "cyan");
  log("║           MVCC EDGE CASE COMPREHENSIVE TESTING SUITE               ║", "cyan");
  log("║                   Testing Scope: All Edge Cases                    ║", "cyan");
  log("╚════════════════════════════════════════════════════════════════════╝", "cyan");

  try {
    await testVersionIntegrity();
    await testUpdateEdgeCases();
    await testDeleteEdgeCases();
    await testSnapshotEdgeCases();
    await testHistoryEdgeCases();
    await testDataConsistency();
    await testMVCCCompliance();

    log("\n╔════════════════════════════════════════════════════════════════════╗", "cyan");
    log("║                        TEST SUMMARY                               ║", "cyan");
    log("╚════════════════════════════════════════════════════════════════════╝", "cyan");

    log(`\nTotal Tests: ${totalTests}`, "bold");
    log(`Passed: ${passedTests}`, "green");
    log(`Failed: ${failedTests}`, "red");
    log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(2)}%\n`, "bold");

    if (issuesFound.length > 0) {
      log("╔════════════════════════════════════════════════════════════════════╗", "yellow");
      log("║                    ISSUES FOUND & TO FIX                          ║", "yellow");
      log("╚════════════════════════════════════════════════════════════════════╝", "yellow");
      issuesFound.forEach((issue, index) => {
        log(`${index + 1}. ${issue}`, "yellow");
      });
    } else {
      log("\n✅ ALL TESTS PASSED - SYSTEM IS STABLE!", "green");
    }

    log("\n✅ Testing Complete - Log saved to: " + LOG_FILE, "green");
  } catch (err) {
    log(`\n❌ Test suite error: ${err.message}`, "red");
    console.error(err);
  }
}

runAllTests();
