# Snapshot API - Quick Reference Guide

## Endpoint

```
GET /api/todos/:todoId/snapshot?time=<ISO-8601-timestamp>
```

## Parameters

| Parameter | Type | Required | Format | Example |
|-----------|------|----------|--------|---------|
| `todoId` | String (UUID) | Yes | Path parameter | `767381ee-1411-4802-a0f4-3d534088b4c9` |
| `time` | String (ISO-8601) | Yes | Query parameter | `2026-04-15T07:08:34.822Z` |

## Response Codes

| Code | Scenario |
|------|----------|
| `200` | Snapshot found and returned |
| `400` | Invalid timestamp format or missing parameter |
| `404` | No version exists before the requested timestamp |
| `500` | Server error |

## Response Body (200 OK)

```json
{
  "todoId": "767381ee-1411-4802-a0f4-3d534088b4c9",
  "title": "Todo Title",
  "content": "Todo content",
  "version": 2,
  "isLatest": false,
  "createdAt": "2026-04-15T07:08:34.901Z"
}
```

## Error Response (400 Bad Request)

```json
{
  "message": "Invalid timestamp format. Use ISO format."
}
```

## Error Response (404 Not Found)

```json
{
  "message": "No snapshot found for todoId 767381ee-1411-4802-a0f4-3d534088b4c9 before 2026-04-15T07:08:34.822Z"
}
```

---

## Usage Examples

### Example 1: Get version as it existed at creation time

```bash
# First, create a todo (returns with createdAt timestamp)
curl -X POST http://localhost:5000/api/todos \
  -H "Content-Type: application/json" \
  -d '{"title": "My Task", "content": "Do something"}'

# Response includes: "createdAt": "2026-04-15T07:08:34.822Z", "version": 1

# Now retrieve the snapshot at that exact time
curl "http://localhost:5000/api/todos/767381ee-1411-4802-a0f4-3d534088b4c9/snapshot?time=2026-04-15T07:08:34.822Z"

# Returns current state of v1 as it was at that moment
```

### Example 2: Get version at specific update time

```bash
# After updating the todo (version becomes 2)
# Update response includes: "createdAt": "2026-04-15T07:08:34.901Z", "version": 2

# Retrieve the state at v2's creation
curl "http://localhost:5000/api/todos/767381ee-1411-4802-a0f4-3d534088b4c9/snapshot?time=2026-04-15T07:08:34.901Z"

# Returns v2 (updated version)
```

### Example 3: Get version between two updates

```bash
# Version 1 created: 2026-04-15T07:08:34.822Z
# Version 2 created: 2026-04-15T07:08:34.901Z

# Query time between them
curl "http://localhost:5000/api/todos/767381ee-1411-4802-a0f4-3d534088b4c9/snapshot?time=2026-04-15T07:08:34.860Z"

# Returns v1 (latest before that time)
```

### Example 4: Error - Invalid timestamp

```bash
curl "http://localhost:5000/api/todos/767381ee-1411-4802-a0f4-3d534088b4c9/snapshot?time=invalid-date"

# Returns 400 Bad Request:
# {"message": "Invalid timestamp format. Use ISO format."}
```

### Example 5: Error - No version before time

```bash
curl "http://localhost:5000/api/todos/767381ee-1411-4802-a0f4-3d534088b4c9/snapshot?time=2000-01-01T00:00:00Z"

# Returns 404 Not Found:
# {"message": "No snapshot found for todoId 767381ee-1411-4802-a0f4-3d534088b4c9 before 2000-01-01T00:00:00Z"}
```

---

## JavaScript/Node.js Example

```javascript
// Function to get snapshot of a todo at a specific time
async function getSnapshotAt(todoId, timestamp) {
  try {
    const response = await fetch(
      `/api/todos/${todoId}/snapshot?time=${encodeURIComponent(timestamp)}`
    );
    
    if (!response.ok) {
      const error = await response.json();
      console.error(`Error: ${error.message}`);
      return null;
    }
    
    const snapshot = await response.json();
    console.log(`Retrieved v${snapshot.version} as it was at ${timestamp}`);
    return snapshot;
  } catch (err) {
    console.error('Request failed:', err);
    return null;
  }
}

// Usage
const todoId = '767381ee-1411-4802-a0f4-3d534088b4c9';
const timestamp = '2026-04-15T07:08:34.901Z';

await getSnapshotAt(todoId, timestamp);
// Output: Retrieved v2 as it was at 2026-04-15T07:08:34.901Z
```

---

## Python Example

```python
import requests
from urllib.parse import urlencode

def get_snapshot(todo_id, timestamp):
    """Get snapshot of todo at specific time"""
    params = {'time': timestamp}
    url = f'http://localhost:5000/api/todos/{todo_id}/snapshot'
    
    response = requests.get(url, params=params)
    
    if response.status_code == 200:
        snapshot = response.json()
        print(f"Retrieved v{snapshot['version']} at {timestamp}")
        return snapshot
    elif response.status_code == 400:
        print(f"Invalid request: {response.json()['message']}")
    elif response.status_code == 404:
        print(f"Not found: {response.json()['message']}")
    else:
        print(f"Error: {response.status_code}")
    
    return None

# Usage
todo_id = '767381ee-1411-4802-a0f4-3d534088b4c9'
timestamp = '2026-04-15T07:08:34.901Z'

snapshot = get_snapshot(todo_id, timestamp)
```

---

## Valid ISO 8601 Timestamp Formats

✅ **Accepted:**
- `2026-04-15T07:08:34.822Z` (with milliseconds)
- `2026-04-15T07:08:34Z` (without milliseconds)
- `2026-04-15T07:08:34+00:00` (with timezone offset)
- `2026-04-15T07:08:34-05:00` (with timezone offset)

❌ **Not Accepted:**
- `2026-04-15 07:08:34` (missing T)
- `2026-04-15` (date only)
- `07:08:34` (time only)
- `not-a-date` (invalid format)

---

## Related Endpoints

### Get Latest Version
```
GET /api/todos/:todoId
```
Returns the latest version (isLatest=true)

### Get All Versions
```
GET /api/todos/:todoId/history
```
Returns all versions in order (v1, v2, v3, ...)

### Create Todo
```
POST /api/todos
```
Creates v1 with createdAt timestamp

### Update Todo
```
PUT /api/todos/:todoId
```
Creates new version with updated createdAt timestamp

---

## Database Query Details

The snapshot endpoint uses this MongoDB query:

```javascript
db.todos.findOne(
  {
    todoId: "<id>",
    createdAt: { $lte: new Date("<timestamp>") }
  },
  {},
  { sort: { version: -1 } }
)
```

**Query characteristics:**
- Single document returned (O(1) for indexes)
- Indexed on `todoId` and `createdAt`
- Less than 50ms typical execution
- Sorted by version descending to get latest

---

## Common Use Cases

### 1. Audit Trail
```bash
# Get whole history of a todo
curl http://localhost:5000/api/todos/TODOID/history

# Then for each version, optionally verify with snapshot
curl "http://localhost:5000/api/todos/TODOID/snapshot?time=TIMESTAMP"
```

### 2. Time Travel Debugging
```bash
# Find the state of a todo at when user reported issue
curl "http://localhost:5000/api/todos/TODOID/snapshot?time=2026-04-15T06:30:00Z"
```

### 3. Data Recovery
```bash
# Get the last known good state before corruption
curl "http://localhost:5000/api/todos/TODOID/snapshot?time=2026-04-15T05:00:00Z"
```

### 4. Compliance Reporting
```bash
# Get todo state at specific compliance checkpoint
curl "http://localhost:5000/api/todos/TODOID/snapshot?time=2026-03-31T23:59:59Z"
```

---

## Performance Tips

1. **Use exact createdAt times** from history API for precise snapshots
2. **Avoid unnecessary snapshot queries** - use history API when you need all versions
3. **Cache timestamps** from initial todo creation for repeated access
4. **Batch snapshot queries** - server handles multiple requests efficiently
5. **Use Future timestamps** safely - returns latest available version

---

## Troubleshooting

### Issue: Getting 400 Bad Request
**Solution:** Verify ISO 8601 format. Use `new Date().toISOString()` in JavaScript.

### Issue: Getting 404 for valid todo
**Solution:** Check if timestamp is before todo creation. Use history API first.

### Issue: Snapshot returns different version than expected
**Solution:** Verify the timestamp is after the version you want's createdAt time.

### Issue: Slow response times
**Solution:** Ensures MongoDB has index on `todoId` and `createdAt` fields.

---

## Support & Documentation

- **Full Implementation Details:** [SNAPSHOT_IMPLEMENTATION.md](SNAPSHOT_IMPLEMENTATION.md)
- **QA Report:** [QA_REPORT.md](QA_REPORT.md)
- **README:** [mvcc_readme.md](mvcc_readme.md)

---

**Last Updated:** April 15, 2026  
**Status:** Production Ready ✅
