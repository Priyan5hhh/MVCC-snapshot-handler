# MVCC Delete - Debugging and Logic Flow Verification

## Purpose
Detailed logic flow verification to ensure delete operations maintain MVCC integrity.

---

## Delete Operation Logic Flow

### Phase 1: Input Validation
```
Function: deleteTodo(req, res)
├─ Extract: todoId from params
├─ Validate: Is todoId valid string?
│  ├─ YES → Continue to Phase 2
│  └─ NO → Return 400 "Invalid todoId"
```

**Code Path**: Lines 193-200
**Expected Behavior**: Rejects empty, null, or non-string IDs

---

### Phase 2: Current Version Lookup
```
├─ Query: Todo.findOne({ todoId: todoId, isLatest: true })
├─ Result: currentLatest = found document OR null
│  ├─ Found → Continue to Phase 3
│  └─ Not Found → Return 404 "Todo not found"
```

**Code Path**: Lines 202-211
**Expected Behavior**: 
- Only retrieves document with isLatest=true
- Returns 404 if no such document exists

**DB Query Trace**:
```
Collection: todos
Filter: { todoId: string, isLatest: true }
Result: Single document if exists, null if not
```

---

### Phase 3: Already Deleted Check
```
├─ Check: Is currentLatest.isDeleted === true?
│  ├─ YES → Return 400 "Todo is already deleted"
│  └─ NO → Continue to Phase 4
```

**Code Path**: Lines 213-217
**Expected Behavior**:
- Prevents duplicate deletion
- Alerts user that todo is already deleted
- Returns 400 (Bad Request)

---

### Phase 4: Previous Version Marking
```
├─ Operation: Mark previous version as not latest
│  ├─ Set: currentLatest.isLatest = false
│  ├─ Save: await currentLatest.save()
│  └─ Log: "marked version N as not latest"
```

**Code Path**: Lines 219-224
**Expected Behavior**:
- Modifies ONLY the isLatest field to false
- Saves single document (not wholesale replacement)
- Preserves all other fields unchanged
- Version number stays the same

**DB Change**:
```
Before: { todoId: X, version: 1, isLatest: true, isDeleted: false }
After:  { todoId: X, version: 1, isLatest: false, isDeleted: false }
```

---

### Phase 5: New Deleted Version Creation
```
├─ Create: New Todo document with properties:
│  ├─ title: copy from currentLatest.title
│  ├─ content: copy from currentLatest.content
│  ├─ todoId: SAME todoId (maintains version chain)
│  ├─ version: previousVersion + 1 (increment)
│  ├─ isLatest: true (this is now the latest)
│  └─ isDeleted: true (mark as deleted)
├─ Save: await deletedVersion.save()
└─ Result: New document created with _id ObjectId
```

**Code Path**: Lines 226-235
**Expected Behavior**:
- Creates NEW document (append-only)
- Increments version correctly
- Sets isDeleted=true (soft delete marker)
- Sets isLatest=true (this version is latest)
- Preserves content from previous version

**DB Change** (New Row):
```
INSERT: { 
  _id: NEW ObjectId,
  todoId: X (same),
  version: 2 (previous+1),
  isLatest: true (only true for this version),
  isDeleted: true (soft delete),
  title: copied,
  content: copied,
  createdAt: NEW timestamp
}
```

---

### Phase 6: Success Response
```
├─ Logging: "version N marked as deleted"
├─ Response:
│  ├─ Status: 200 (OK)
│  ├─ Message: "Todo deleted successfully"
│  └─ Data: savedDeletedVersion (full new document)
└─ End
```

**Code Path**: Lines 237-244
**Expected Behavior**:
- Returns the new deleted version document
- Client confirms delete by receiving new version with isDeleted=true

---

## Error Handling Paths

### Error Path 1: Invalid Input (400)
```
validateTodoId → INVALID
├─ Return: 400
├─ Message: "Invalid todoId"
└─ No database changes
```

### Error Path 2: Todo Not Found (404)
```
findOne(todoId, isLatest:true) → NULL
├─ Return: 404
├─ Message: "Todo not found"
└─ No database changes
```

### Error Path 3: Already Deleted (400)
```
isDeleted === true → TRUE
├─ Return: 400
├─ Message: "Todo is already deleted"
└─ No database changes
```

### Error Path 4: Database Error (500)
```
Any operation throws exception
├─ Catch error
├─ Log: console.error("Error deleting todo:", error)
├─ Return: 500
├─ Message: "Server Error"
└─ Details: error.message included
```

---

## MVCC Constraint Verification

### Constraint 1: One isLatest=true Per TodoId

**Before Delete**:
```
Version 1: { todoId: X, version: 1, isLatest: true }
           → isLatest count for X = 1 ✓
```

**After Delete**:
```
Version 1: { todoId: X, version: 1, isLatest: false }
Version 2: { todoId: X, version: 2, isLatest: true }
           → isLatest count for X = 1 ✓ (still one!)
```

**Query Verification**:
```javascript
db.todos.find({todoId: "X", isLatest: true}).count() === 1 // Always true
```

---

### Constraint 2: Append-Only Storage

**Physical Changes**:
```
Operation 1: INSERT version 1 (create)
Operation 2: UPDATE version 1 (set isLatest=false only)
Operation 3: INSERT version 2 (delete)
             └─ NOTE: No physical DELETE from table
```

**Database Result**:
```
Rows in table: 2 (increased from 1)
Deleted rows: 0 (none physically deleted)
All history: Accessible
```

---

### Constraint 3: Version Increment

**Version Sequence**:
```
Create:  version = 1
Update:  version = 2
Update:  version = 3
Delete:  version = 4
         └─ Always previousVersion + 1
```

**Invariant Check**:
```
For any todoId:
  versions = [1, 2, 3, ...]
  Each version appears exactly once
  No gaps in sequence
```

---

### Constraint 4: Immutability of Old Versions

**Version 1 After Delete**:
```
Initial:  { version: 1, isLatest: true, isDeleted: false, title: "X" }
After:    { version: 1, isLatest: false, isDeleted: false, title: "X" }
Changes:  ONLY isLatest modified
Preserved: version, title, content, createdAt, isDeleted
```

**Fields Never Modified After Creation**:
- version (always original value)
- title (always original value)
- content (always original value)
- createdAt (always original timestamp)
- isDeleted (never changes after creation)

---

## GET /api/todos Filter Verification

### Filter Logic
```javascript
const latestTodos = await Todo.find({ 
  isLatest: true,      // Only latest versions
  isDeleted: false     // Exclude soft-deleted
});
```

### Filter Result
```
Create todo v1: { isLatest: true, isDeleted: false } → SHOWN ✓
Create todo v2: { isLatest: true, isDeleted: false } → SHOWN ✓
Delete todo v1→v2: 
  v1: { isLatest: false, isDeleted: false } → HIDDEN (isLatest=false)
  v2: { isLatest: true, isDeleted: true } → HIDDEN (isDeleted=true)
```

**Outcome**: Deleted todos NOT returned ✓

---

## History Endpoint Verification

### Query
```javascript
const history = await Todo.find({ todoId: todoId })
  .sort({ version: 1 });
```

### Result
```
Returns ALL versions for todoId, sorted by version
v1: { version: 1, isLatest: false, isDeleted: false }
v2: { version: 2, isLatest: true, isDeleted: true }
v3: { version: 3, isLatest: false, isDeleted: false }
     ...
```

**Outcome**: Complete audit trail ✓

---

## Snapshot Endpoint Verification

### Query Logic
```javascript
const snapshot = await Todo.findOne({
  todoId: todoId,
  createdAt: { $lte: requestedTime }
})
.sort({ version: -1 });
```

### Scenarios

**Snapshot Before Delete**:
- Query: time = "2026-04-15T09:00:00Z" (before v2 created)
- Match: v1 (createdAt before time)
- Result: v1 (not deleted) ✓

**Snapshot After Delete**:
- Query: time = "2026-04-15T09:30:00Z" (after v2 created)
- Match: v1, v2 (both createdAt before time)
- Sort: v2 > v1 (highest version first)
- Result: v2 (deleted) ✓

**Outcome**: Correct state at any point in time ✓

---

## State Transition Diagram

```
                    [Todo Created]
                          ↓
                  v1: isLatest=true
                  isDeleted=false
                          ↓
                    [Optional Updates]
                          ↓
    v1→v2→v3 (each update):
    Old: isLatest=false
    New: isLatest=true
    Both: isDeleted=false
                          ↓
                    [Delete Operation]
                          ↓
    v2→v3 (delete):
    Old: isLatest=false
    New: isLatest=true
         isDeleted=true
                          ↓
              [History Preserved]
```

---

## Data Integrity Checklist

### During Delete Operation

- [ ] Previous version isLatest changed from true to false
- [ ] New version created with unique _id
- [ ] New version has same todoId
- [ ] New version has version = previous + 1
- [ ] New version has isLatest = true
- [ ] New version has isDeleted = true
- [ ] New version has new createdAt timestamp
- [ ] New version has title and content from previous
- [ ] Previous version all other fields unchanged
- [ ] No documents physically deleted from database

### After Delete Operation

- [ ] Exactly one document with (todoId, isLatest=true)
- [ ] That document has isDeleted=true
- [ ] GET /todos returns empty or doesn't include deleted
- [ ] GET /history returns all versions including deleted
- [ ] GET /snapshot works before and after delete time
- [ ] Logging shows both version marking and deletion
- [ ] No duplicate isLatest records
- [ ] No orphaned versions

---

## Common Issues & Fixes

### Issue 1: Deleted todo still in GET list
**Cause**: getTodos filter missing isDeleted: false
**Fix**: Verify line 39 has both filters: `{ isLatest: true, isDeleted: false }`
**Test**: Run `curl http://localhost:5000/api/todos` and verify deleted absent

### Issue 2: Multiple isLatest=true for same todoId
**Cause**: Failed to update previous version to isLatest=false
**Fix**: Verify lines 221-222 save the old version with isLatest=false
**Test**: Query MongoDB: `db.todos.find({todoId: X, isLatest: true}).count()` should be 1

### Issue 3: Version doesn't increment
**Cause**: Line 230 not adding 1 to previousVersion
**Fix**: Verify: `version: previousVersion + 1`
**Test**: Delete a todo, check response.data.version === previous + 1

### Issue 4: Previous version modified
**Cause**: Accidentally updating other fields when setting isLatest=false
**Fix**: Verify only isLatest is modified: `currentLatest.isLatest = false`
**Test**: Query old version, verify all fields (title, content) unchanged

### Issue 5: 404 on valid todoId
**Cause**: Query looking for wrong conditions or database empty
**Fix**: Verify todoId is from response.body.todoId, not response.data.todoId
**Test**: Store exact todoId, use in delete within seconds

### Issue 6: isDeleted field missing
**Cause**: Schema not updated or MongoDB cache
**Fix**: Verify schema has `isDeleted: { type: Boolean, default: false }`
**Fix**: Restart server and MongoDB

---

## Success Indicators

### Response Level
```
✓ POST /todos: Returns 201 with version 1
✓ DELETE /todos: Returns 200 with version 2, isDeleted=true
✓ GET /todos: Returns only non-deleted todos
✓ GET /history: Returns all versions
✓ GET /snapshot: Returns correct version at time
```

### Database Level
```
✓ No documents physically deleted
✓ All versions preserved
✓ Exactly one isLatest=true per todoId
✓ Version sequence unbroken (1,2,3...)
✓ Soft delete marked with isDeleted=true
```

### Logic Level
```
✓ Previous version marked as not latest
✓ New version created with incremented version
✓ MVCC constraints maintained
✓ History accessible
✓ Time-based queries work
```

---

## Final Validation

Before declaring delete functionality production-ready:

1. **Manual Test All Scenarios** (See MANUAL_QA_TEST.md)
   - Create and delete
   - Verify not in list
   - Check history
   - Test snapshots
   - Test errors

2. **Database Integrity Check**
   - Run MongoDB queries to verify constraints
   - Check for orphaned versions
   - Verify no physical deletes

3. **Error Scenarios**
   - Test double delete (400)
   - Test non-existent (404)
   - Test invalid input (400)

4. **Performance Check**
   - Single delete: <100ms
   - History query: <50ms
   - Snapshot query: <50ms

5. **Logging Verification**
   - All deletes logged
   - Version operations logged
   - Errors logged with details

---

**When all checks pass → PRODUCTION READY ✅**
