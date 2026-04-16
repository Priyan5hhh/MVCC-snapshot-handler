# MVCC Delete - Manual QA Test Scenarios

## Purpose
Comprehensive manual testing guide to verify delete functionality without automated test runner.

---

## Test Environment Setup

### Prerequisites
- Node.js running on your machine
- MongoDB running locally on `mongodb://localhost:27017/mvcc-todo`
- Server on `http://localhost:5000`

### Setup Steps
```bash
# Terminal 1: Start server
cd D:\mvcPractice\server
npm start

# Terminal 2: Use curl or Postman for API calls
```

---

## Scenario 1: Basic Create and Delete

### Step 1.1: Create a Todo
```bash
curl -X POST http://localhost:5000/api/todos \
  -H "Content-Type: application/json" \
  -d '{"title":"Manual Test 1","content":"Testing delete"}'
```

**Expected Response (201):**
```json
{
  "_id": "ObjectId(...)",
  "todoId": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Manual Test 1",
  "content": "Testing delete",
  "version": 1,
  "isLatest": true,
  "isDeleted": false,
  "createdAt": "2026-04-15T09:18:15.000Z"
}
```

**Save**: `todoId` for next steps

### Step 1.2: Delete the Todo
```bash
curl -X DELETE http://localhost:5000/api/todos/550e8400-e29b-41d4-a716-446655440000
```

**Expected Response (200):**
```json
{
  "message": "Todo deleted successfully",
  "data": {
    "_id": "ObjectId(...)",
    "todoId": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Manual Test 1",
    "content": "Testing delete",
    "version": 2,
    "isLatest": true,
    "isDeleted": true,
    "createdAt": "2026-04-15T09:18:16.000Z"
  }
}
```

**Verify:**
- ✅ status: 200
- ✅ version incremented to 2
- ✅ isLatest: true
- ✅ isDeleted: true

---

## Scenario 2: Verify Deleted NOT in List

### Step 2.1: Get All Todos
```bash
curl http://localhost:5000/api/todos
```

**Expected Response (200):**
```json
[]
```
or
```json
[
  // Other todos, but NOT the deleted one
]
```

**Verify:**
- ✅ Deleted todo with todoId from Scenario 1 NOT in list
- ✅ isDeleted: false filter working

---

## Scenario 3: History Preservation

### Step 3.1: Get History
```bash
curl http://localhost:5000/api/todos/550e8400-e29b-41d4-a716-446655440000/history
```

**Expected Response (200):**
```json
[
  {
    "title": "Manual Test 1",
    "content": "Testing delete",
    "version": 1,
    "isLatest": false,
    "createdAt": "2026-04-15T09:18:15.000Z"
  },
  {
    "title": "Manual Test 1",
    "content": "Testing delete",
    "version": 2,
    "isLatest": true,
    "createdAt": "2026-04-15T09:18:16.000Z"
  }
]
```

**Verify:**
- ✅ version 1 present (original)
- ✅ version 2 present (deleted)
- ✅ version 1: isLatest: false
- ✅ version 2: isLatest: true
- ✅ No version 1 isDeleted field OR isDeleted: false
- ✅ version 2 isDeleted: true

---

## Scenario 4: Snapshot Before Deletion

### Step 4.1: Get Snapshot at Original Time
```bash
# Use timestamp from Step 1.1 (e.g., 2026-04-15T09:18:15.000Z)
curl "http://localhost:5000/api/todos/550e8400-e29b-41d4-a716-446655440000/snapshot?time=2026-04-15T09:18:15.500Z"
```

**Expected Response (200):**
```json
{
  "title": "Manual Test 1",
  "content": "Testing delete",
  "version": 1,
  "isLatest": false,
  "createdAt": "2026-04-15T09:18:15.000Z"
}
```

**Verify:**
- ✅ version: 1 (original)
- ✅ isDeleted: false
- ✅ isLatest: false (because time is before deletion but other versions may exist)

---

## Scenario 5: Snapshot After Deletion

### Step 5.1: Get Snapshot After Delete Time
```bash
# Use timestamp after deletion (e.g., 2026-04-15T09:18:20.000Z)
curl "http://localhost:5000/api/todos/550e8400-e29b-41d4-a716-446655440000/snapshot?time=2026-04-15T09:18:20.000Z"
```

**Expected Response (200):**
```json
{
  "title": "Manual Test 1",
  "content": "Testing delete",
  "version": 2,
  "isLatest": true,
  "createdAt": "2026-04-15T09:18:16.000Z"
}
```

**Verify:**
- ✅ version: 2 (deleted)
- ✅ isDeleted: true
- ✅ isLatest: true
- ✅ createdAt is after the original (shows it's the delete version)

---

## Scenario 6: Error - Delete Already Deleted

### Step 6.1: Try to Delete Again
```bash
curl -X DELETE http://localhost:5000/api/todos/550e8400-e29b-41d4-a716-446655440000
```

**Expected Response (400):**
```json
{
  "message": "Todo is already deleted"
}
```

**Verify:**
- ✅ status: 400
- ✅ message indicates already deleted

---

## Scenario 7: Error - Delete Non-Existent

### Step 7.1: Delete with Fake ID
```bash
curl -X DELETE http://localhost:5000/api/todos/00000000-0000-0000-0000-000000000000
```

**Expected Response (404):**
```json
{
  "message": "Todo not found"
}
```

**Verify:**
- ✅ status: 404
- ✅ message indicates not found

---

## Scenario 8: Complex Flow - Create, Update, Delete

### Step 8.1: Create
```bash
curl -X POST http://localhost:5000/api/todos \
  -H "Content-Type: application/json" \
  -d '{"title":"Complex Test","content":"v1"}'
```
**Save**: todoId and record: `response.body.todoId`

### Step 8.2: Update
```bash
curl -X PUT http://localhost:5000/api/todos/{todoId} \
  -H "Content-Type: application/json" \
  -d '{"title":"Complex Test","content":"v2"}'
```

**Expected Response (200):**
- version: 2
- isLatest: true

### Step 8.3: Delete
```bash
curl -X DELETE http://localhost:5000/api/todos/{todoId}
```

**Expected Response (200):**
- version: 3
- isLatest: true
- isDeleted: true

### Step 8.4: Verify History
```bash
curl http://localhost:5000/api/todos/{todoId}/history
```

**Expected Response (200):**
```json
[
  {
    "version": 1,
    "isLatest": false,
    "isDeleted": false,
    "title": "Complex Test",
    "content": "v1"
  },
  {
    "version": 2,
    "isLatest": false,
    "isDeleted": false,
    "title": "Complex Test",
    "content": "v2"
  },
  {
    "version": 3,
    "isLatest": true,
    "isDeleted": true,
    "title": "Complex Test",
    "content": "v2"
  }
]
```

**Verify:**
- ✅ v1: isLatest=false, isDeleted=false
- ✅ v2: isLatest=false, isDeleted=false
- ✅ v3: isLatest=true, isDeleted=true
- ✅ Exactly ONE isLatest=true across all versions

---

## Scenario 9: Error - Invalid TodoId

### Step 9.1: Delete with Empty String
```bash
curl -X DELETE "http://localhost:5000/api/todos/   "
```

**Expected Response (400):**
```json
{
  "message": "Invalid todoId"
}
```

### Step 9.2: Or via path that doesn't match
```bash
curl -X DELETE "http://localhost:5000/api/todos/"
```

**Expected Response**: 404 or 400 (route mismatch)

---

## Scenario 10: Verify Server Logging

### Step 10.1: Check Server Output

When you delete a todo, you should see in the server terminal:

```
Todo Deleted: 550e8400-e29b-41d4-a716-446655440000 | marked version 1 as not latest
Todo Deleted: 550e8400-e29b-41d4-a716-446655440000 | version 2 marked as deleted
```

**Verify:**
- ✅ Two log lines per delete operation
- ✅ todoId is visible
- ✅ version numbers shown

---

## Database Verification (MongoDB)

### Check 1: Document Count
```javascript
// In mongosh
use mvcc-todo
db.todos.count()
// Should show increasing count (no documents deleted physically)
```

### Check 2: View Documents by TodoId
```javascript
use mvcc-todo
db.todos.find({todoId: "550e8400-e29b-41d4-a716-446655440000"}).pretty()
```

**Should show:**
```javascript
[
  {
    "_id": ObjectId(...),
    "todoId": "550e8400-e29b-41d4-a716-446655440000",
    "version": 1,
    "isLatest": false,
    "isDeleted": false,
    "createdAt": ISODate(...)
  },
  {
    "_id": ObjectId(...),
    "todoId": "550e8400-e29b-41d4-a716-446655440000",
    "version": 2,
    "isLatest": true,
    "isDeleted": true,
    "createdAt": ISODate(...)
  }
]
```

### Check 3: Verify isLatest Uniqueness
```javascript
// All docs per todoId should have exactly ONE isLatest=true
db.todos.find({todoId: "550e8400-e29b-41d4-a716-446655440000", isLatest: true}).count()
// Should return: 1
```

---

## Success Criteria Checklist

- [ ] Scenario 1: Basic delete returns 200 with v2, isDeleted=true
- [ ] Scenario 2: Deleted todo NOT in GET /todos list
- [ ] Scenario 3: History shows all versions, v2 is deleted
- [ ] Scenario 4: Snapshot before delete shows v1, not deleted
- [ ] Scenario 5: Snapshot after delete shows v2, deleted
- [ ] Scenario 6: Double delete returns 400
- [ ] Scenario 7: Non-existent delete returns 404
- [ ] Scenario 8: Complex flow creates 3 versions correctly
- [ ] Scenario 9: Invalid ID returns 400
- [ ] Scenario 10: Logging shows both operations
- [ ] Database: All versions preserved
- [ ] Database: Exactly one isLatest=true per todoId

---

## Troubleshooting

### Issue: DELETE returns 404 (todo not found)
- Verify todoId is correct (copy-paste from POST response)
- Verify server is running
- Verify MongoDB is connected
- Check server logs for errors

### Issue: Deleted todo still appears in GET list
- Verify getTodos() filter includes isDeleted: false
- Restart server
- Check MongoDB for isDeleted field

### Issue: History missing deleted version
- Verify new version was created (check POST response status)
- Verify getTodoHistory works for other todos
- Check MongoDB directly for all versions

### Issue: Server crashes on delete
- Check server logs for error stack
- Verify MongoDB connection
- Verify schema has isDeleted field
- Review deleteTodo() error handling

### Issue: Snapshot returns wrong version
- Verify timestamp format (ISO 8601)
- Verify timestamp is between version createdAt times
- Check server logs for snapshot query details

---

## Performance Notes

- First delete: Slightly slower (creates new document)
- Subsequent queries: Very fast (indexed by isLatest)
- History retrieval: Fast (sorts by version)
- Snapshots: Fast with indexed createdAt

---

## Expected Behavior Summary

| Operation | Creates | Marks | Returns | Status |
|-----------|---------|-------|---------|--------|
| DELETE existing | New version | Old as not latest | New version | 200 |
| DELETE deleted | None | N/A | Error | 400 |
| DELETE non-existent | None | N/A | Error | 404 |
| GET /todos | None | N/A | Filtered list | 200 |
| GET /history | None | N/A | All versions | 200 |
| GET /snapshot | None | N/A | Version at time | 200 |

---

**All scenarios must pass for production readiness ✅**
