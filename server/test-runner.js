#!/usr/bin/env node

/**
 * Phase 2 Backend - Comprehensive Test Runner
 * Tests both API functionality and database integrity
 */

const http = require("http");
const { exec } = require("child_process");
const util = require("util");

const execPromise = util.promisify(exec);
const BASE_URL = "http://localhost:5000";

// Color codes for terminal output
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function log(message, color = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        "Content-Type": "application/json",
      },
    };

    const req = http.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          const jsonBody = JSON.parse(body);
          resolve({ status: res.statusCode, body: jsonBody, headers: res.headers });
        } catch {
          resolve({ status: res.statusCode, body: body, headers: res.headers });
        }
      });
    });

    req.on("error", reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function runTests() {
  log("\n╔════════════════════════════════════════════════════════════════╗", "cyan");
  log("║         PHASE 2 BACKEND - COMPREHENSIVE TEST SUITE            ║", "cyan");
  log("╚════════════════════════════════════════════════════════════════╝", "cyan");

  let passCount = 0;
  let failCount = 0;
  const createdTodos = [];

  try {
    // TEST 1: Health Check
    log("\n[TEST 1] Health Check", "blue");
    try {
      const healthRes = await makeRequest("GET", "/");
      if (healthRes.status === 200) {
        log(`  ✓ Server is running on port 5000`, "green");
        passCount++;
      } else {
        log(`  ✗ Expected 200, got ${healthRes.status}`, "red");
        failCount++;
      }
    } catch (err) {
      log(`  ✗ Failed: ${err.message}`, "red");
      failCount++;
    }

    // TEST 2: Create First Todo
    log("\n[TEST 2] Create First Todo (Valid Payload)", "blue");
    try {
      const todo1 = { title: "Learn MVCC", content: "Understand versioning" };
      const createRes = await makeRequest("POST", "/api/todos", todo1);
      if (createRes.status === 201 && createRes.body.version === 1 && createRes.body.isLatest) {
        log(`  ✓ Status 201, version=1, isLatest=true`, "green");
        log(`    TodoId: ${createRes.body.todoId}`, "green");
        createdTodos.push(createRes.body);
        passCount++;
      } else {
        log(`  ✗ Invalid response: status=${createRes.status}`, "red");
        log(`    Body: ${JSON.stringify(createRes.body)}`, "red");
        failCount++;
      }
    } catch (err) {
      log(`  ✗ Failed: ${err.message}`, "red");
      failCount++;
    }

    // TEST 3: Create Second Todo
    log("\n[TEST 3] Create Second Todo", "blue");
    try {
      const todo2 = { title: "Implement Snapshot Handler", content: "Build system" };
      const createRes = await makeRequest("POST", "/api/todos", todo2);
      if (createRes.status === 201) {
        log(`  ✓ Status 201`, "green");
        createdTodos.push(createRes.body);
        passCount++;
      } else {
        log(`  ✗ Expected 201, got ${createRes.status}`, "red");
        failCount++;
      }
    } catch (err) {
      log(`  ✗ Failed: ${err.message}`, "red");
      failCount++;
    }

    // TEST 4: Create Third Todo
    log("\n[TEST 4] Create Third Todo", "blue");
    try {
      const todo3 = { title: "Run Tests", content: "Validate system" };
      const createRes = await makeRequest("POST", "/api/todos", todo3);
      if (createRes.status === 201) {
        log(`  ✓ Status 201`, "green");
        createdTodos.push(createRes.body);
        passCount++;
      } else {
        log(`  ✗ Expected 201, got ${createRes.status}`, "red");
        failCount++;
      }
    } catch (err) {
      log(`  ✗ Failed: ${err.message}`, "red");
      failCount++;
    }

    // TEST 5: Get All Todos
    log("\n[TEST 5] Get All Todos (Should be latest versions only)", "blue");
    try {
      const getAllRes = await makeRequest("GET", "/api/todos");
      if (getAllRes.status === 200 && Array.isArray(getAllRes.body)) {
        const count = getAllRes.body.length;
        const allLatest = getAllRes.body.every((t) => t.isLatest === true);
        log(`  ✓ Status 200, received ${count} todos`, "green");
        log(`    All marked as isLatest=true: ${allLatest}`, allLatest ? "green" : "red");
        if (count === 3 && allLatest) {
          passCount++;
        } else {
          failCount++;
        }
      } else {
        log(`  ✗ Expected 200 with array, got ${getAllRes.status}`, "red");
        failCount++;
      }
    } catch (err) {
      log(`  ✗ Failed: ${err.message}`, "red");
      failCount++;
    }

    // TEST 6: Missing Title (Error Handling)
    log("\n[TEST 6] Create Todo Without Title (Error Handling)", "blue");
    try {
      const invalidTodo = { content: "Missing title field" };
      const invalidRes = await makeRequest("POST", "/api/todos", invalidTodo);
      if (invalidRes.status === 400) {
        log(`  ✓ Correctly returned 400 for missing title`, "green");
        passCount++;
      } else {
        log(`  ✗ Expected 400, got ${invalidRes.status}`, "red");
        failCount++;
      }
    } catch (err) {
      log(`  ✗ Failed: ${err.message}`, "red");
      failCount++;
    }

    // TEST 7: Unique TodoIds
    log("\n[TEST 7] Verify Unique TodoIds", "blue");
    try {
      const allTodosRes = await makeRequest("GET", "/api/todos");
      const ids = allTodosRes.body.map((t) => t.todoId);
      const uniqueIds = new Set(ids);
      if (ids.length === uniqueIds.size) {
        log(`  ✓ All ${ids.length} todos have unique IDs`, "green");
        passCount++;
      } else {
        log(`  ✗ Duplicate IDs detected: ${ids.length} total, ${uniqueIds.size} unique`, "red");
        failCount++;
      }
    } catch (err) {
      log(`  ✗ Failed: ${err.message}`, "red");
      failCount++;
    }

    // TEST 8: Required Fields
    log("\n[TEST 8] Verify Required Fields in Response", "blue");
    try {
      const allTodosRes = await makeRequest("GET", "/api/todos");
      if (allTodosRes.body.length > 0) {
        const todo = allTodosRes.body[0];
        const requiredFields = ["title", "content", "todoId", "version", "isLatest", "createdAt"];
        const hasAllFields = requiredFields.every((f) => f in todo);
        const missingFields = requiredFields.filter((f) => !(f in todo));

        log(`  Fields present: ${Object.keys(todo).join(", ")}`, "green");
        if (hasAllFields) {
          log(`  ✓ All required fields present`, "green");
          passCount++;
        } else {
          log(`  ✗ Missing fields: ${missingFields.join(", ")}`, "red");
          failCount++;
        }
      }
    } catch (err) {
      log(`  ✗ Failed: ${err.message}`, "red");
      failCount++;
    }

    // TEST 9: Field Values Validation
    log("\n[TEST 9] Validate Field Values", "blue");
    try {
      const allTodosRes = await makeRequest("GET", "/api/todos");
      if (allTodosRes.body.length > 0) {
        const todo = allTodosRes.body[0];
        const checks = {
          "title is string": typeof todo.title === "string" && todo.title.length > 0,
          "version is 1": todo.version === 1,
          "isLatest is true": todo.isLatest === true,
          "todoId is string UUID": typeof todo.todoId === "string" && todo.todoId.length === 36,
          "createdAt is string": typeof todo.createdAt === "string",
        };

        let allValid = true;
        for (const [check, result] of Object.entries(checks)) {
          log(`    ${result ? "✓" : "✗"} ${check}`, result ? "green" : "red");
          if (!result) allValid = false;
        }
        if (allValid) passCount++;
        else failCount++;
      }
    } catch (err) {
      log(`  ✗ Failed: ${err.message}`, "red");
      failCount++;
    }

    // TEST 10: Empty GET before creating todos (implicit)
    log("\n[TEST 10] Database Persistence Validation", "blue");
    try {
      const allTodosRes = await makeRequest("GET", "/api/todos");
      const todoIds = allTodosRes.body.map((t) => t.todoId);
      const createdIds = createdTodos.map((t) => t.todoId);
      const allPersisted = createdIds.every((id) => todoIds.includes(id));

      if (allPersisted && allTodosRes.body.length >= 3) {
        log(`  ✓ All ${createdTodos.length} created todos persisted in database`, "green");
        passCount++;
      } else {
        log(`  ✗ Some todos not persisted correctly`, "red");
        failCount++;
      }
    } catch (err) {
      log(`  ✗ Failed: ${err.message}`, "red");
      failCount++;
    }

  } catch (error) {
    log(`\nFATAL ERROR: ${error.message}`, "red");
    failCount++;
  }

  // Summary
  log("\n╔════════════════════════════════════════════════════════════════╗", "cyan");
  log("║                       TEST SUMMARY                            ║", "cyan");
  log("╚════════════════════════════════════════════════════════════════╝", "cyan");
  log(`\nPassed: ${passCount}`, "green");
  log(`Failed: ${failCount}`, failCount === 0 ? "green" : "red");
  log(`Total:  ${passCount + failCount}`, "blue");

  if (failCount === 0) {
    log("\n✓ ALL TESTS PASSED - Backend is ready for Phase 2!", "green");
    process.exit(0);
  } else {
    log(
      `\n✗ ${failCount} TEST(S) FAILED - Debug required`,
      "red"
    );
    process.exit(1);
  }
}

// Run tests after a short delay
setTimeout(runTests, 2000);
