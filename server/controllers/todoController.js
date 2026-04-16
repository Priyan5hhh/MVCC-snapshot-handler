const { v4: uuidv4 } = require("uuid");
const Todo = require("../models/todoModel");

const sendSuccess = (res, statusCode, data) => {
  res.status(statusCode).json({ success: true, data });
};

const sendError = (res, statusCode, message) => {
  res.status(statusCode).json({ success: false, message });
};

exports.createTodo = async (req, res) => {
  try {
    const { title, content } = req.body;

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return sendError(res, 400, "Title is required");
    }

    const newTodo = new Todo({
      title: title.trim(),
      content,
      todoId: uuidv4(),
      version: 1,
      isLatest: true,
    });

    const savedTodo = await newTodo.save();

    console.log(`Todo Created: ${savedTodo.todoId} | version: ${savedTodo.version}`);

    return sendSuccess(res, 201, savedTodo);
  } catch (error) {
    console.error("Error creating todo:", error);
    return sendError(res, 500, "Server Error");
  }
};


exports.getTodos = async (req, res) => {
  try {
    // Only return latest versions that are not deleted
    const latestTodos = await Todo.find({ 
      isLatest: true,
      isDeleted: { $ne: true }
    }).sort({ createdAt: -1 });

    return sendSuccess(res, 200, latestTodos);
  } catch (error) {
    console.error("Error fetching todos:", error);
    return sendError(res, 500, "Server Error");
  }
};

exports.getTodoHistory = async (req, res) => {
  try {
    const todoId = (req.params.todoId || "").trim();

    if (!todoId) {
      return sendError(res, 400, "Invalid todoId");
    }

    const history = await Todo.find({ todoId }).sort({ version: 1 }).select("-__v");

    if (!history || history.length === 0) {
      console.warn(`History fetch: todoId=${todoId} | versions=0`);
      return sendError(res, 404, `No history found for todoId ${todoId}`);
    }

    console.log(`History fetch: todoId=${todoId} | versions=${history.length}`);

    return sendSuccess(res, 200, history);
  } catch (error) {
    console.error("Error fetching todo history:", error);
    return sendError(res, 500, "Server Error");
  }
};

exports.getTodoSnapshot = async (req, res) => {
  try {
    const todoId = (req.params.todoId || "").trim();
    const versionRaw = req.params.version;

    if (!todoId) {
      return sendError(res, 400, "Invalid todoId");
    }

    const version = Number.parseInt(versionRaw, 10);
    if (!Number.isInteger(version) || version <= 0) {
      return sendError(res, 400, "Invalid version. Use a positive integer.");
    }

    const snapshot = await Todo.findOne({
      todoId,
      version,
    })
      .select("-__v");

    if (!snapshot) {
      console.warn(`Snapshot fetch: todoId=${todoId} | version=${version} | found=false`);
      return sendError(res, 404, `No snapshot found for todoId ${todoId} at version ${version}`);
    }

    console.log(`Snapshot fetch: todoId=${todoId} | version=${version} | returnedVersion=${snapshot.version}`);

    return sendSuccess(res, 200, snapshot);
  } catch (error) {
    console.error("Error fetching todo snapshot:", error);
    return sendError(res, 500, "Server Error");
  }
};

exports.updateTodo = async (req, res) => {
  try {
    const todoId = (req.params.todoId || "").trim();
    const { title, content } = req.body;

    if (!todoId) {
      return sendError(res, 400, "Invalid todoId");
    }

    if (title === undefined && content === undefined) {
      return sendError(res, 400, "At least one field (title or content) is required");
    }

    if (title !== undefined && (typeof title !== "string" || title.trim().length === 0)) {
      return sendError(res, 400, "Title cannot be empty");
    }

    const currentLatest = await Todo.findOne({
      todoId,
      isLatest: true,
      isDeleted: { $ne: true },
    });

    if (!currentLatest) {
      return sendError(res, 404, "Todo not found");
    }

    const previousVersion = currentLatest.version;

    // Atomically mark old version as not latest
    const updateResult = await Todo.updateOne(
      {
        _id: currentLatest._id,
        todoId,
        version: previousVersion,
        isLatest: true,
      },
      { $set: { isLatest: false } }
    );

    if (updateResult.modifiedCount === 0) {
      console.warn(`Update conflict for todoId=${todoId}, retrying...`);
      return sendError(res, 409, "Concurrent update detected, please retry");
    }

    console.log(`Todo Updated: ${todoId} | marked version ${previousVersion} as not latest`);

    // Create new version
    const newVersion = new Todo({
      title: title !== undefined ? title.trim() : currentLatest.title,
      content: content !== undefined ? content : currentLatest.content,
      todoId,
      version: previousVersion + 1,
      isLatest: true,
      isDeleted: false,
    });

    let savedNewVersion;
    try {
      savedNewVersion = await newVersion.save();
    } catch (saveError) {
      await Todo.updateOne(
        { _id: currentLatest._id, isLatest: false },
        { $set: { isLatest: true } }
      );

      if (saveError && saveError.code === 11000) {
        return sendError(res, 409, "Concurrent update detected, please retry");
      }

      throw saveError;
    }

    console.log(
      `Todo Updated: ${todoId} | created version ${savedNewVersion.version}`
    );

    return sendSuccess(res, 200, savedNewVersion);
  } catch (error) {
    console.error("Error updating todo:", error);
    return sendError(res, 500, "Server Error");
  }
};

exports.deleteTodo = async (req, res) => {
  try {
    const todoId = (req.params.todoId || "").trim();

    if (!todoId) {
      return sendError(res, 400, "Invalid todoId");
    }

    const currentLatest = await Todo.findOne({
      todoId,
      isLatest: true,
      isDeleted: { $ne: true },
    });

    if (!currentLatest) {
      return sendError(res, 404, "Todo not found");
    }

    const previousVersion = currentLatest.version;

    // Atomically mark old version as not latest
    const updateResult = await Todo.updateOne(
      {
        _id: currentLatest._id,
        todoId,
        version: previousVersion,
        isLatest: true,
      },
      { $set: { isLatest: false } }
    );

    if (updateResult.modifiedCount === 0) {
      return sendError(res, 409, "Concurrent delete detected, please retry");
    }

    console.log(`Todo Deleted: ${todoId} | marked version ${previousVersion} as not latest`);

    // Create a new "deleted" version - soft delete via versioning
    const deletedVersion = new Todo({
      title: currentLatest.title,
      content: currentLatest.content,
      todoId,
      version: previousVersion + 1,
      isLatest: true,
      isDeleted: true,
      deletedAt: new Date(),
    });

    let savedDeletedVersion;
    try {
      savedDeletedVersion = await deletedVersion.save();
    } catch (saveError) {
      await Todo.updateOne(
        { _id: currentLatest._id, isLatest: false },
        { $set: { isLatest: true } }
      );

      if (saveError && saveError.code === 11000) {
        return sendError(res, 409, "Concurrent delete detected, please retry");
      }

      throw saveError;
    }

    console.log(
      `Todo Deleted: ${todoId} | created deletion version ${savedDeletedVersion.version}`
    );

    return sendSuccess(res, 200, savedDeletedVersion);
  } catch (error) {
    console.error("Error deleting todo:", error);
    return sendError(res, 500, "Server Error");
  }
};