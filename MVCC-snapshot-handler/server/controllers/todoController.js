const { v4: uuidv4 } = require("uuid");
const Todo = require("../models/todoModel");
const { sendSuccess, sendError } = require("../utils/response");
const {
  ValidationError,
  validateTodoId,
  validateTitle,
  validateTimestamp,
  validateUpdatePayload,
} = require("../utils/validation");

const logQueryTime = (label, start) => {
  const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
  console.log(`📊 ${label} query executed in ${durationMs.toFixed(2)}ms`);
};

/**
 * POST /api/todos
 * Create a new todo
 */
exports.createTodo = async (req, res, next) => {
  try {
    const { title, content } = req.body;

    // Validate input
    const validatedTitle = validateTitle(title);

    const newTodo = new Todo({
      title: validatedTitle,
      content: content || null,
      todoId: uuidv4(),
      version: 1,
      isLatest: true,
    });

    const savedTodo = await newTodo.save();

    console.log(
      `✅ Todo Created: ${savedTodo.todoId} | version: ${savedTodo.version}`
    );

    sendSuccess(res, savedTodo, 201);
  } catch (error) {
    if (error instanceof ValidationError) {
      return sendError(res, error.message, error.statusCode);
    }
    console.error("❌ Error creating todo:", error);
    next(error);
  }
};

/**
 * GET /api/todos
 * Get all active todos (latest non-deleted versions only)
 */
exports.getTodos = async (req, res, next) => {
  try {
    const queryStart = process.hrtime.bigint();

    const latestTodos = await Todo.find({
      isLatest: true,
      isDeleted: false,
    }).lean();

    logQueryTime("FetchAll Latest Todos", queryStart);

    console.log(
      `✅ Fetched ${latestTodos.length} active todos`
    );

    sendSuccess(res, latestTodos, 200);
  } catch (error) {
    console.error("❌ Error fetching todos:", error);
    next(error);
  }
};

/**
 * GET /api/todos/:todoId/history
 * Get complete version history for a todo
 */
exports.getTodoHistory = async (req, res, next) => {
  try {
    const { todoId } = req.params;

    // Validate input
    const validatedTodoId = validateTodoId(todoId);

    const queryStart = process.hrtime.bigint();

    const history = await Todo.find({ todoId: validatedTodoId })
      .sort({ version: 1 })
      .select("title content version isLatest isDeleted deletedAt createdAt -_id")
      .lean();

    logQueryTime(`History for ${validatedTodoId}`, queryStart);

    if (!history || history.length === 0) {
      console.warn(`⚠️  History fetch: todoId=${validatedTodoId} | versions=0`);
      return sendError(
        res,
        `No history found for todoId ${validatedTodoId}`,
        404
      );
    }

    console.log(
      `✅ History fetch: todoId=${validatedTodoId} | versions=${history.length}`
    );

    sendSuccess(res, history, 200);
  } catch (error) {
    if (error instanceof ValidationError) {
      return sendError(res, error.message, error.statusCode);
    }
    console.error("❌ Error fetching todo history:", error);
    next(error);
  }
};

/**
 * GET /api/todos/:todoId/snapshot
 * Get the state of a todo at a specific point in time
 */
exports.getTodoSnapshot = async (req, res, next) => {
  try {
    const { todoId } = req.params;
    const { time } = req.query;

    // Validate inputs
    const validatedTodoId = validateTodoId(todoId);
    const requestedTime = validateTimestamp(time);

    const queryStart = process.hrtime.bigint();

    const snapshot = await Todo.findOne({
      todoId: validatedTodoId,
      createdAt: { $lte: requestedTime },
    })
      .sort({ version: -1 })
      .select(
        "todoId title content version isLatest isDeleted deletedAt createdAt -_id"
      )
      .lean();

    logQueryTime(`Snapshot for ${validatedTodoId}`, queryStart);

    if (!snapshot) {
      console.warn(
        `⚠️  Snapshot fetch: todoId=${validatedTodoId} | time=${requestedTime.toISOString()} | versions=0`
      );
      return sendError(
        res,
        `No snapshot found for todoId ${validatedTodoId} before ${requestedTime.toISOString()}`,
        404
      );
    }

    console.log(
      `✅ Snapshot fetch: todoId=${validatedTodoId} | time=${requestedTime.toISOString()} | returnedVersion=${snapshot.version}`
    );

    sendSuccess(res, snapshot, 200);
  } catch (error) {
    if (error instanceof ValidationError) {
      return sendError(res, error.message, error.statusCode);
    }
    console.error("❌ Error fetching todo snapshot:", error);
    next(error);
  }
};

/**
 * PUT /api/todos/:todoId
 * Update a todo (creates a new version in MVCC)
 */
exports.updateTodo = async (req, res, next) => {
  try {
    const { todoId } = req.params;
    const { title, content } = req.body;

    // Validate inputs
    const validatedTodoId = validateTodoId(todoId);
    const validatedPayload = validateUpdatePayload(title, content);

    // Get current latest version (only if not deleted)
    const currentLatest = await Todo.findOne({
      todoId: validatedTodoId,
      isLatest: true,
      isDeleted: { $ne: true },
    });

    if (!currentLatest) {
      return sendError(res, `Todo ${validatedTodoId} not found`, 404);
    }

    const previousVersion = currentLatest.version;

    // Atomically mark old version as not latest
    const updateResult = await Todo.updateOne(
      {
        _id: currentLatest._id,
        todoId: validatedTodoId,
        version: previousVersion,
        isLatest: true,
      },
      { $set: { isLatest: false } }
    );

    if (updateResult.modifiedCount === 0) {
      console.warn(`⚠️  Update conflict for todoId=${validatedTodoId}`);
      return sendError(
        res,
        "Concurrent update detected, please retry",
        409
      );
    }

    console.log(
      `📝 Todo Updated: ${validatedTodoId} | marked version ${previousVersion} as not latest`
    );

    // Create new version
    const newVersion = new Todo({
      title:
        validatedPayload.title !== undefined
          ? validatedPayload.title
          : currentLatest.title,
      content:
        validatedPayload.content !== undefined
          ? validatedPayload.content
          : currentLatest.content,
      todoId: validatedTodoId,
      version: previousVersion + 1,
      isLatest: true,
      isDeleted: false,
    });

    const savedNewVersion = await newVersion.save();

    console.log(
      `✅ Todo Updated: ${validatedTodoId} | created version ${savedNewVersion.version}`
    );

    sendSuccess(res, savedNewVersion, 200);
  } catch (error) {
    if (error instanceof ValidationError) {
      return sendError(res, error.message, error.statusCode);
    }
    console.error("❌ Error updating todo:", error);
    next(error);
  }
};

/**
 * DELETE /api/todos/:todoId
 * Soft-delete a todo (creates a new version marked as deleted)
 */
exports.deleteTodo = async (req, res, next) => {
  try {
    const { todoId } = req.params;

    // Validate input
    const validatedTodoId = validateTodoId(todoId);

    // Get current latest version
    const currentLatest = await Todo.findOne({
      todoId: validatedTodoId,
      isLatest: true,
    });

    if (!currentLatest) {
      return sendError(res, `Todo ${validatedTodoId} not found`, 404);
    }

    if (currentLatest.isDeleted === true) {
      return sendError(res, `Todo ${validatedTodoId} is already deleted`, 404);
    }

    const previousVersion = currentLatest.version;

    // Atomically mark old version as not latest
    await Todo.updateOne(
      {
        _id: currentLatest._id,
        version: previousVersion,
        isLatest: true,
      },
      { $set: { isLatest: false } }
    );

    console.log(
      `🗑️  Todo Deleted: ${validatedTodoId} | marked version ${previousVersion} as not latest`
    );

    // Create deletion version (soft delete via MVCC)
    const deletedVersion = new Todo({
      title: currentLatest.title,
      content: currentLatest.content,
      todoId: validatedTodoId,
      version: previousVersion + 1,
      isLatest: true,
      isDeleted: true,
      deletedAt: new Date(),
    });

    const savedDeletedVersion = await deletedVersion.save();

    console.log(
      `✅ Todo Deleted: ${validatedTodoId} | created deletion version ${savedDeletedVersion.version}`
    );

    sendSuccess(res, savedDeletedVersion, 200);
  } catch (error) {
    if (error instanceof ValidationError) {
      return sendError(res, error.message, error.statusCode);
    }
    console.error("❌ Error deleting todo:", error);
    next(error);
  }
};