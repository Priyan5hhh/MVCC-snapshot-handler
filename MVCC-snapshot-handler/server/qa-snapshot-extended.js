#!/usr/bin/env node

/**
 * Extended Snapshot API QA - Edge Case & Data Integrity Testing
 * Tests advanced snapshot scenarios and verifies no data mutations
 */

const http = require("http");

const BASE_URL = "http://localhost:5000";

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
  bold: "\x1b[1m",
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

async function runExtendedTests() {
  log("\n╔══════════════════════════════════════════════════════════════════╗", "cyan");
  log("║     EXTENDED SNAPSHOT API QA - EDGE CASES & DATA INTEGRITY      ║", "cyan");
  log("║     Advanced Testing & Comprehensive Validation                  ║", "cyan");
  log("╚══════════════════════════════════════════════════════════════════╝", "cyan");

  let passCount = 0;
  let failCount = 0;

  try {
    // Test 1: Timestamp Precision
    log("\n═══════════════════════════════════════════════════════════════════", "cyan");
    log("TEST 1: TIMESTAMP PRECISION AND MILLISECOND HANDLING", "cyan");
    log("═══════════════════════════════════════════════════════════════════", "cyan");

    log("\n[TS PRECISION] Create todo and capture exact ISO timestamp", "blue");
    try {
      const createRes1 = await makeRequest("POST", "/api/todos", {
        title: "Precision Test Todo",
        content: "Testing timestamp handling",
      });

      if (createRes1.status === 201) {
        const todoId = createRes1.body.todoId;
        const createdAtStr = createRes1.body.createdAt;
        const createdAtDate = new Date(createdAtStr);

        log(`  ✓ Created todo with precise ISO timestamp`, "green");
        log(`    Timestamp: ${createdAtStr}`, "green");
        log(`    Milliseconds: ${createdAtDate.getMilliseconds()}`, "green");

        // Try snapshot at exact creation time
        const snapRes = await makeRequest("GET", `/api/todos/${todoId}/snapshot?time=${encodeURIComponent(createdAtStr)}`);
        if (snapRes.status === 200 && snapRes.body.version === 1) {
          log(`  ✓ Snapshot at exact creation time returns version 1`, "green");
          passCount++;
        } else {
          log(`  ✗ Failed to get snapshot at creation time`, "red");
          failCount++;
        }

        // Try snapshot 1ms after creation time
        const futureTime = new Date(createdAtDate.getTime() + 1).toISOString();
        const futureSnapRes = await makeRequest("GET", `/api/todos/${todoId}/snapshot?time=${encodeURIComponent(futureTime)}`);
        if (futureSnapRes.status === 200 && futureSnapRes.body.version === 1) {
          log(`  ✓ Snapshot 1ms after creation returns version 1`, "green");
          passCount++;
        } else {
          log(`  ✗ Failed to get snapshot 1ms after creation`, "red");
          failCount++;
        }
      } else {
        log(`  ✗ Failed to create test todo`, "red");
        failCount += 2;
      }
    } catch (err) {
      log(`  ✗ Error: ${err.message}`, "red");
      failCount += 2;
    }

    // Test 2: Multiple Snapshots on Same Todo
    log("\n═══════════════════════════════════════════════════════════════════", "cyan");
    log("TEST 2: MULTIPLE SNAPSHOTS WITH SEQUENTIAL UPDATES", "cyan");
    log("═══════════════════════════════════════════════════════════════════", "cyan");

    log("\n[MULTI SNAP] Create and update todo, then query multiple snapshots", "blue");
    try {
      const create2 = await makeRequest("POST", "/api/todos", {
        title: "Multi-Snapshot Test",
        content: "Initial content",
      });

      if (create2.status === 201) {
        const todoId = create2.body.todoId;
        const time1 = create2.body.createdAt;

        // Small delay and update
        await new Promise(resolve => setTimeout(resolve, 50));
        const update1 = await makeRequest("PUT", `/api/todos/${todoId}`, {
          title: "Updated Title v2",
        });
        const time2 = update1.body.data.createdAt;

        await new Promise(resolve => setTimeout(resolve, 50));
        const update2 = await makeRequest("PUT", `/api/todos/${todoId}`, {
          content: "Updated content v3",
        });
        const time3 = update2.body.data.createdAt;

        // Query snapshots at each timestamp
        const snap1 = await makeRequest("GET", `/api/todos/${todoId}/snapshot?time=${encodeURIComponent(time1)}`);
        const snap2 = await makeRequest("GET", `/api/todos/${todoId}/snapshot?time=${encodeURIComponent(time2)}`);
        const snap3 = await makeRequest("GET", `/api/todos/${todoId}/snapshot?time=${encodeURIComponent(time3)}`);

        if (snap1.body.version === 1 && snap2.body.version === 2 && snap3.body.version === 3) {
          log(`  ✓ All three snapshots returned correct versions: v1, v2, v3`, "green");
          passCount++;
        } else {
          log(`  ✗ Snapshot versions incorrect: ${snap1.body.version}, ${snap2.body.version}, ${snap3.body.version}`, "red");
          failCount++;
        }
      } else {
        log(`  ✗ Failed to create multi-snapshot test todo`, "red");
        failCount++;
      }
    } catch (err) {
      log(`  ✗ Error: ${err.message}`, "red");
      failCount++;
    }

    // Test 3: Data Integrity - Snapshots Don't Mutate
    log("\n═══════════════════════════════════════════════════════════════════", "cyan");
    log("TEST 3: DATA INTEGRITY - VERIFY NO MUTATIONS FROM SNAPSHOTS", "cyan");
    log("═══════════════════════════════════════════════════════════════════", "cyan");

    log("\n[INTEGRITY] Create, capture version counts, query snapshots, verify counts unchanged", "blue");
    try {
      const create3 = await makeRequest("POST", "/api/todos", {
        title: "Integrity Test",
        content: "Verify no mutations",
      });

      if (create3.status === 201) {
        const todoId = create3.body.todoId;

        // Get history before snapshots
        const historyBefore = await makeRequest("GET", `/api/todos/${todoId}/history`);
        const countBefore = historyBefore.body.length;

        log(`  Initial version count: ${countBefore}`, "green");

        // Execute multiple snapshot queries
        for (let i = 0; i < 5; i++) {
          await makeRequest("GET", `/api/todos/${todoId}/snapshot?time=${encodeURIComponent(new Date().toISOString())}`);
        }

        // Get history after snapshots
        const historyAfter = await makeRequest("GET", `/api/todos/${todoId}/history`);
        const countAfter = historyAfter.body.length;

        log(`  Version count after 5 snapshot queries: ${countAfter}`, "green");

        if (countBefore === countAfter) {
          log(`  ✓ No new documents created by snapshot queries (count unchanged)`, "green");
          passCount++;
        } else {
          log(`  ✗ Document count changed: ${countBefore} → ${countAfter}`, "red");
          failCount++;
        }

        // Verify fields unchanged
        const snap = await makeRequest("GET", `/api/todos/${todoId}/snapshot?time=${encodeURIComponent(new Date().toISOString())}`);
        if (snap.body.title === "Integrity Test" && snap.body.version === 1) {
          log(`  ✓ Snapshot data unchanged after queries`, "green");
          passCount++;
        } else {
          log(`  ✗ Snapshot data corrupted`, "red");
          failCount++;
        }
      } else {
        log(`  ✗ Failed to create integrity test todo`, "red");
        failCount += 2;
      }
    } catch (err) {
      log(`  ✗ Error: ${err.message}`, "red");
      failCount += 2;
    }

    // Test 4: Far Future Timestamp
    log("\n═══════════════════════════════════════════════════════════════════", "cyan");
    log("TEST 4: FAR FUTURE TIMESTAMP BOUNDARY", "cyan");
    log("═══════════════════════════════════════════════════════════════════", "cyan");

    log("\n[FAR FUTURE] Query snapshot with timestamp far in the future", "blue");
    try {
      const create4 = await makeRequest("POST", "/api/todos", {
        title: "Future Test",
        content: "Testing far future timestamp",
      });

      if (create4.status === 201) {
        const todoId = create4.body.todoId;
        const farFuture = new Date("2099-12-31T23:59:59Z").toISOString();

        const futureSnap = await makeRequest("GET", `/api/todos/${todoId}/snapshot?time=${encodeURIComponent(farFuture)}`);
        if (futureSnap.status === 200 && futureSnap.body.version === 1) {
          log(`  ✓ Future timestamp correctly returns latest available version`, "green");
          passCount++;
        } else {
          log(`  ✗ Future timestamp query failed`, "red");
          failCount++;
        }
      } else {
        log(`  ✗ Failed to create future test todo`, "red");
        failCount++;
      }
    } catch (err) {
      log(`  ✗ Error: ${err.message}`, "red");
      failCount++;
    }

    // Test 5: Ver Oldest Timestamp
    log("\n═══════════════════════════════════════════════════════════════════", "cyan");
    log("TEST 5: OLD TIMESTAMP BOUNDARY", "cyan");
    log("═══════════════════════════════════════════════════════════════════", "cyan");

    log("\n[OLD TIMESTAMP] Query snapshot with timestamp from 1970", "blue");
    try {
      const create5 = await makeRequest("POST", "/api/todos", {
        title: "Old Timestamp Test",
        content: "Testing old timestamp",
      });

      if (create5.status === 201) {
        const todoId = create5.body.todoId;
        const oldTime = new Date("1970-01-01T00:00:00Z").toISOString();

        const oldSnap = await makeRequest("GET", `/api/todos/${todoId}/snapshot?time=${encodeURIComponent(oldTime)}`);
        if (oldSnap.status === 404) {
          log(`  ✓ Old timestamp correctly returns 404 (no versions before 1970)`, "green");
          passCount++;
        } else {
          log(`  ✗ Old timestamp query should return 404`, "red");
          failCount++;
        }
      } else {
        log(`  ✗ Failed to create old timestamp test todo`, "red");
        failCount++;
      }
    } catch (err) {
      log(`  ✗ Error: ${err.message}`, "red");
      failCount++;
    }

    // Test 6: Invalid TodoId with Valid Timestamp
    log("\n═══════════════════════════════════════════════════════════════════", "cyan");
    log("TEST 6: INVALID TODOID WITH VALID TIMESTAMP", "cyan");
    log("═══════════════════════════════════════════════════════════════════", "cyan");

    log("\n[INVALID TODOID] Query snapshot with non-existent todo", "blue");
    try {
      const fakeId = "00000000-0000-0000-0000-000000000000";
      const now = new Date().toISOString();

      const invalidSnap = await makeRequest("GET", `/api/todos/${fakeId}/snapshot?time=${encodeURIComponent(now)}`);
      if (invalidSnap.status === 404) {
        log(`  ✓ Non-existent todo correctly returns 404`, "green");
        passCount++;
      } else {
        log(`  ✗ Expected 404 for non-existent todo`, "red");
        failCount++;
      }
    } catch (err) {
      log(`  ✗ Error: ${err.message}`, "red");
      failCount++;
    }

    // Test 7: Empty Query String
    log("\n═══════════════════════════════════════════════════════════════════", "cyan");
    log("TEST 7: MISSING TIMESTAMP QUERY PARAMETER", "cyan");
    log("═══════════════════════════════════════════════════════════════════", "cyan");

    log("\n[MISSING QUERY] Query snapshot without time parameter", "blue");
    try {
      const create7 = await makeRequest("POST", "/api/todos", {
        title: "Missing Query Test",
        content: "Testing missing query param",
      });

      if (create7.status === 201) {
        const todoId = create7.body.todoId;

        const missingSnap = await makeRequest("GET", `/api/todos/${todoId}/snapshot`);
        if (missingSnap.status === 400) {
          log(`  ✓ Missing timestamp parameter correctly returns 400`, "green");
          passCount++;
        } else {
          log(`  ✗ Expected 400 for missing timestamp`, "red");
          failCount++;
        }
      } else {
        log(`  ✗ Failed to create test todo`, "red");
        failCount++;
      }
    } catch (err) {
      log(`  ✗ Error: ${err.message}`, "red");
      failCount++;
    }

    // Test 8: Response Structure Validation
    log("\n═══════════════════════════════════════════════════════════════════", "cyan");
    log("TEST 8: RESPONSE STRUCTURE AND FIELD VALIDATION", "cyan");
    log("═══════════════════════════════════════════════════════════════════", "cyan");

    log("\n[RESPONSE] Verify snapshot response contains all required fields", "blue");
    try {
      const create8 = await makeRequest("POST", "/api/todos", {
        title: "Response Test",
        content: "Validate response structure",
      });

      if (create8.status === 201) {
        const todoId = create8.body.todoId;
        const currentTime = new Date().toISOString();

        const snapRes = await makeRequest("GET", `/api/todos/${todoId}/snapshot?time=${encodeURIComponent(currentTime)}`);
        if (snapRes.status === 200) {
          const snapshot = snapRes.body;
          const hasRequiredFields = snapshot.todoId && snapshot.title && snapshot.version && snapshot.createdAt;

          if (hasRequiredFields) {
            log(`  ✓ Response contains all required fields:`, "green");
            log(`    - todoId: ${snapshot.todoId ? "✓" : "✗"}`, "green");
            log(`    - title: ${snapshot.title ? "✓" : "✗"}`, "green");
            log(`    - version: ${snapshot.version ? "✓" : "✗"}`, "green");
            log(`    - createdAt: ${snapshot.createdAt ? "✓" : "✗"}`, "green");
            passCount++;
          } else {
            log(`  ✗ Missing required fields in response`, "red");
            failCount++;
          }
        } else {
          log(`  ✗ Failed to get snapshot`, "red");
          failCount++;
        }
      } else {
        log(`  ✗ Failed to create test todo`, "red");
        failCount++;
      }
    } catch (err) {
      log(`  ✗ Error: ${err.message}`, "red");
      failCount++;
    }

    // Summary
    log("\n═══════════════════════════════════════════════════════════════════", "cyan");
    log("EXTENDED TEST SUMMARY", "cyan");
    log("═══════════════════════════════════════════════════════════════════", "cyan");

    log("\n╔════════════════════════════════════════════════════════════════╗", "cyan");
    log("║              EXTENDED QA TEST RESULTS                         ║", "cyan");
    log("╚════════════════════════════════════════════════════════════════╝", "cyan");

    log(`\nTotal Extended Tests: ${passCount + failCount}`, "bold");
    log(`Passed: ${passCount}`, passCount > failCount ? "green" : "red");
    log(`Failed: ${failCount}`, failCount === 0 ? "green" : "red");
    log(`Success Rate: ${Math.round((passCount / (passCount + failCount)) * 100)}%`, "blue");

    if (failCount === 0) {
      log("\n✅ ALL EXTENDED TESTS PASSED - SNAPSHOT API IS PRODUCTION READY", "green");
      log("\n✓ Edge Case Coverage:", "green");
      log("  1. ✓ Timestamp precision and milliseconds", "green");
      log("  2. ✓ Multiple sequential snapshots", "green");
      log("  3. ✓ Data integrity (no mutations from reads)", "green");
      log("  4. ✓ Far future timestamp handling", "green");
      log("  5. ✓ Old/historical timestamp handling", "green");
      log("  6. ✓ Invalid todo ID error handling", "green");
      log("  7. ✓ Missing query parameter error handling", "green");
      log("  8. ✓ Response structure validation", "green");
      log("\nCertification: PRODUCTION READY ✅ (All Edge Cases Covered)", "green");
    } else {
      log(`\n❌ ${failCount} TEST(S) FAILED - REQUIRES INVESTIGATION`, "red");
    }

  } catch (error) {
    log(`\n❌ CRITICAL ERROR: ${error.message}`, "red");
    console.error(error);
    failCount++;
  }

  process.exit(failCount === 0 ? 0 : 1);
}

// Run tests
setTimeout(runExtendedTests, 1000);
