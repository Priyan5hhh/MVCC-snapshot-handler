const http = require("http");

const BASE_URL = "http://localhost:5000";

// Helper to make HTTP requests
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

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

// Test suite
async function runTests() {
  console.log("\n========== PHASE 2 TEST SUITE ==========\n");

  try {
    // Test 1: Health check
    console.log("TEST 1: Health Check");
    const healthRes = await makeRequest("GET", "/");
    console.log(`  Status: ${healthRes.status}`);
    console.log(`  Response: ${healthRes.body}`);
    console.log(healthRes.status === 200 ? "  ✓ PASS\n" : "  ✗ FAIL\n");

    // Test 2: Create first todo
    console.log("TEST 2: Create First Todo (Valid payload)");
    const todo1 = { title: "Learn MVCC", content: "Understand versioning" };
    const createRes1 = await makeRequest("POST", "/api/todos", todo1);
    console.log(`  Status: ${createRes1.status}`);
    console.log(`  Response:`, createRes1.body);
    const todo1Id = createRes1.body.todoId;
    console.log(createRes1.status === 201 && createRes1.body.version === 1 && createRes1.body.isLatest ? "  ✓ PASS\n" : "  ✗ FAIL\n");

    // Test 3: Create second todo
    console.log("TEST 3: Create Second Todo");
    const todo2 = { title: "Implement snapshot handler", content: "Build the snapshot system" };
    const createRes2 = await makeRequest("POST", "/api/todos", todo2);
    console.log(`  Status: ${createRes2.status}`);
    console.log(`  Response:`, createRes2.body);
    const todo2Id = createRes2.body.todoId;
    console.log(createRes2.status === 201 ? "  ✓ PASS\n" : "  ✗ FAIL\n");

    // Test 4: Create third todo
    console.log("TEST 4: Create Third Todo");
    const todo3 = { title: "Test the system", content: "Run comprehensive tests" };
    const createRes3 = await makeRequest("POST", "/api/todos", todo3);
    console.log(`  Status: ${createRes3.status}`);
    console.log(createRes3.status === 201 ? "  ✓ PASS\n" : "  ✗ FAIL\n");

    // Test 5: Get all todos
    console.log("TEST 5: Get All Todos (Latest versions only)");
    const getAllRes = await makeRequest("GET", "/api/todos");
    console.log(`  Status: ${getAllRes.status}`);
    console.log(`  Count: ${getAllRes.body.length}`);
    console.log(`  Todos:`, getAllRes.body.map((t) => ({ title: t.title, todoId: t.todoId, version: t.version, isLatest: t.isLatest })));
    const allValid = getAllRes.body.every((t) => t.isLatest === true && t.version === 1);
    console.log(getAllRes.status === 200 && getAllRes.body.length === 3 && allValid ? "  ✓ PASS\n" : "  ✗ FAIL\n");

    // Test 6: Missing title field
    console.log("TEST 6: Create Todo Without Title (Error handling)");
    const invalidTodo = { content: "Missing title" };
    const invalidRes = await makeRequest("POST", "/api/todos", invalidTodo);
    console.log(`  Status: ${invalidRes.status}`);
    console.log(`  Response:`, invalidRes.body);
    console.log(invalidRes.status === 400 ? "  ✓ PASS\n" : "  ✗ FAIL\n");

    // Test 7: Verify unique todoIds
    console.log("TEST 7: Verify Unique TodoIds");
    const allTodosRes = await makeRequest("GET", "/api/todos");
    const ids = allTodosRes.body.map((t) => t.todoId);
    const uniqueIds = new Set(ids);
    console.log(`  Total todos: ${ids.length}, Unique IDs: ${uniqueIds.size}`);
    console.log(ids.length === uniqueIds.size ? "  ✓ PASS\n" : "  ✗ FAIL\n");

    // Test 8: Verify fields
    console.log("TEST 8: Verify Required Fields in Response");
    const fieldCheckRes = await makeRequest("GET", "/api/todos");
    const requiredFields = ["title", "content", "todoId", "version", "isLatest", "createdAt"];
    const firstTodo = fieldCheckRes.body[0];
    const hasAllFields = requiredFields.every((field) => field in firstTodo);
    console.log(`  Sample todo fields:`, Object.keys(firstTodo));
    console.log(hasAllFields ? "  ✓ PASS\n" : "  ✗ FAIL\n");

    console.log("========== TEST SUITE COMPLETE ==========\n");
  } catch (error) {
    console.error("Test error:", error.message);
  }
}

// Wait for server to be ready, then run tests
setTimeout(runTests, 2000);
