#!/usr/bin/env node

/**
 * MVCC Backend - API Validation with Error Handling
 * Tests standardized responses, input validation, and error handling
 */

const http = require("http");
const fs = require("fs");
const path = require("path");

const BASE_URL = "http://localhost:5000";
const LOG_FILE = path.join(__dirname, "api_validation_results.txt");

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
    stats.errors.push(description);
  }
}

async function testResponseFormats() {
  log("\n╔════════════════════════════════════════════════╗", "cyan");
  log("║ TEST 1: STANDARDIZED RESPONSE FORMATS          ║", "cyan");
  log("╚════════════════════════════════════════════════╝", "cyan");

  // Test success response format
  const createRes = await makeRequest("POST", "/api/todos", {
    title: "Test Todo",
    content: "Test content",
  });

  test(createRes.body.success === true, "Success response has success: true");
  test(createRes.body.data !== undefined, "Success response has data field");
  test(createRes.status === 201, "Create returns HTTP 201");

  // Test error response format
  const badRes = await makeRequest("POST", "/api/todos", {
    content: "No title provided",
  });

  test(badRes.body.success === false, "Error response has success: false");
  test(badRes.body.message !== undefined, "Error response has message field");
  test(badRes.status === 400, "Bad request returns HTTP 400");

  return createRes.body.data;
}

async function testInputValidation(todoId) {
  log("\n╔════════════════════════════════════════════════╗", "cyan");
  log("║ TEST 2: INPUT VALIDATION                       ║", "cyan");
  log("╚════════════════════════════════════════════════╝", "cyan");

  // Empty title test
  const emptyTitleRes = await makeRequest("POST", "/api/todos", {
    title: "",
  });
  test(emptyTitleRes.status === 400, "Empty title rejected with 400");
  test(
    emptyTitleRes.body.message.toLowerCase().includes("title"),
    "Empty title error mentions title"
  );

  // Null title test
  const nullTitleRes = await makeRequest("POST", "/api/todos", {
    title: null,
  });
  test(nullTitleRes.status === 400, "Null title rejected with 400");

  // Invalid todoId in history
  const badTodoIdRes = await makeRequest("GET", "/api/todos//history", null);
  test(badTodoIdRes.status === 400, "Empty todoId parameter rejected with 400");

  // Invalid timestamp format
  const badTimeRes = await makeRequest(
    "GET",
    `/api/todos/${todoId}/snapshot?time=invalid-date`,
    null
  );
  test(badTimeRes.status === 400, "Invalid timestamp rejected with 400");
  test(
    badTimeRes.body.message.toLowerCase().includes("timestamp"),
    "Invalid timestamp error mentions timestamp"
  );
}

async function testErrorHandling(todoId) {
  log("\n╔════════════════════════════════════════════════╗", "cyan");
  log("║ TEST 3: ERROR HANDLING                         ║", "cyan");
  log("╚════════════════════════════════════════════════╝", "cyan");

  // Non-existent todo history
  const nonExistentRes = await makeRequest(
    "GET",
    "/api/todos/non-existent-id/history",
    null
  );
  test(nonExistentRes.status === 404, "Non-existent todo returns 404");
  test(
    nonExistentRes.body.message.includes("No history found"),
    "Not found error has descriptive message"
  );

  // Update non-existent todo
  const updateNonExistRes = await makeRequest(
    "PUT",
    "/api/todos/non-existent-id",
    { title: "Updated" }
  );
  test(updateNonExistRes.status === 404, "Update non-existent returns 404");

  // Delete non-existent todo
  const deleteNonExistRes = await makeRequest(
    "DELETE",
    "/api/todos/non-existent-id",
    null
  );
  test(deleteNonExistRes.status === 404, "Delete non-existent returns 404");

  // Delete already deleted todo
  const deleteRes = await makeRequest("DELETE", `/api/todos/${todoId}`, null);
  test(deleteRes.status === 200, "Delete returns 200 on success");

  const deleteAgainRes = await makeRequest("DELETE", `/api/todos/${todoId}`, null);
  test(deleteAgainRes.status === 404, "Delete already deleted returns 404");
  test(
    deleteAgainRes.body.message.includes("already deleted"),
    "Already deleted error is descriptive"
  );
}

async function testStatusCodes() {
  log("\n╔════════════════════════════════════════════════╗", "cyan");
  log("║ TEST 4: HTTP STATUS CODES                      ║", "cyan");
  log("╚════════════════════════════════════════════════╝", "cyan");

  // 200 for GET
  const getTodosRes = await makeRequest("GET", "/api/todos", null);
  test(getTodosRes.status === 200, "GET /api/todos returns 200");

  // 201 for POST
  const createRes = await makeRequest("POST", "/api/todos", {
    title: "Status Code Test",
  });
  test(createRes.status === 201, "POST /api/todos returns 201");

  // 200 for PUT
  const updateRes = await makeRequest(
    "PUT",
    `/api/todos/${createRes.body.data.todoId}`,
    { title: "Updated" }
  );
  test(updateRes.status === 200, "PUT returns 200");

  // 200 for DELETE
  const deleteRes = await makeRequest(
    "DELETE",
    `/api/todos/${createRes.body.data.todoId}`,
    null
  );
  test(deleteRes.status === 200, "DELETE returns 200");

  // 404 for not found
  const notFoundRes = await makeRequest(
    "GET",
    "/api/todos/non-existent/history",
    null
  );
  test(notFoundRes.status === 404, "Not found returns 404");

  // 400 for bad request
  const badReqRes = await makeRequest("POST", "/api/todos", {});
  test(badReqRes.status === 400, "Bad request returns 400");
}

async function testUpdateValidation() {
  log("\n╔════════════════════════════════════════════════╗", "cyan");
  log("║ TEST 5: UPDATE VALIDATION                      ║", "cyan");
  log("╚════════════════════════════════════════════════╝", "cyan");

  const createRes = await makeRequest("POST", "/api/todos", {
    title: "Original Title",
    content: "Original Content",
  });
  const todoId = createRes.body.data.todoId;

  // Update with neither title nor content
  const emptyUpdateRes = await makeRequest(
    "PUT",
    `/api/todos/${todoId}`,
    {}
  );
  test(emptyUpdateRes.status === 400, "Update with no fields rejected");
  test(
    emptyUpdateRes.body.message.toLowerCase().includes("at least one"),
    "Empty update error mentions required fields"
  );

  // Valid update with title only
  const titleUpdateRes = await makeRequest(
    "PUT",
    `/api/todos/${todoId}`,
    { title: "New Title" }
  );
  test(titleUpdateRes.status === 200, "Update title only succeeds");
  test(titleUpdateRes.body.data.title === "New Title", "Title was updated");

  // Valid update with content only
  const contentUpdateRes = await makeRequest(
    "PUT",
    `/api/todos/${todoId}`,
    { content: "New Content" }
  );
  test(contentUpdateRes.status === 200, "Update content only succeeds");
  test(
    contentUpdateRes.body.data.content === "New Content",
    "Content was updated"
  );

  // Clean up
  await makeRequest("DELETE", `/api/todos/${todoId}`, null);
}

async function testSnapshot() {
  log("\n╔════════════════════════════════════════════════╗", "cyan");
  log("║ TEST 6: SNAPSHOT WITH TIMESTAMPS               ║", "cyan");
  log("╚════════════════════════════════════════════════╝", "cyan");

  // Create a todo
  const createRes = await makeRequest("POST", "/api/todos", {
    title: "Snapshot Test",
  });
  const todoId = createRes.body.data.todoId;
  const createdTime = new Date();

  // Wait a moment
  await new Promise((r) => setTimeout(r, 100));

  // Get snapshot at current time
  const snapshotRes = await makeRequest(
    "GET",
    `/api/todos/${todoId}/snapshot?time=${createdTime.toISOString()}`,
    null
  );
  test(snapshotRes.status === 200, "Snapshot with valid timestamp returns 200");
  test(snapshotRes.body.data.todoId === todoId, "Snapshot returns correct todo");

  // Get snapshot at future time
  const futureTime = new Date(Date.now() + 10000).toISOString();
  const futureRes = await makeRequest(
    "GET",
    `/api/todos/${todoId}/snapshot?time=${futureTime}`,
    null
  );
  test(futureRes.status === 200, "Snapshot at future time still returns data");

  // Missing time parameter
  const noTimeRes = await makeRequest(
    "GET",
    `/api/todos/${todoId}/snapshot`,
    null
  );
  test(noTimeRes.status === 400, "Snapshot without time parameter fails");

  // Clean up
  await makeRequest("DELETE", `/api/todos/${todoId}`, null);
}

async function runAllTests() {
  log(
    "\n╔════════════════════════════════════════════════════════╗",
    "bold"
  );
  log("║   MVCC BACKEND - API VALIDATION WITH ERROR HANDLING   ║", "bold");
  log("║          Standardized Responses & Robust Errors       ║", "bold");
  log("╚════════════════════════════════════════════════════════╝", "bold");

  // Clear log file
  fs.writeFileSync(LOG_FILE, "");

  try {
    const todoData = await testResponseFormats();
    await testInputValidation(todoData.todoId);
    await testErrorHandling(todoData.todoId);
    await testStatusCodes();
    await testUpdateValidation();
    await testSnapshot();

    log("\n" + "=".repeat(50), "bold");
    log(`RESULTS: ${stats.passed}/${stats.totalTests} tests passed`, "bold");
    log("=".repeat(50), "bold");

    if (stats.failed > 0) {
      log(`\n❌ ${stats.failed} test(s) failed:`, "red");
      stats.errors.forEach((err) => log(`  - ${err}`, "red"));
    } else {
      log("\n✅ All tests passed!", "green");
    }

    log(`\n📝 Results saved to: ${LOG_FILE}`, "blue");
  } catch (err) {
    log(`\n❌ Fatal error: ${err.message}`, "red");
    console.error(err);
  }
}

runAllTests();
