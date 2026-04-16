const { v4: uuidv4 } = require("uuid");
const Todo = require("../models/todoModel");

// ─── Response helpers ────────────────────────────────────────────────────────

const ok = (res, statusCode, data) =>
  res.status(statusCode).json({ success: true, data });

const fail = (res, statusCode, message) =>
  res.status(statusCode).json({ success: false, message });

// ─── Create ──────────────────────────────────────────────────────────────────

exports.createTodo = async (req, res) => {
  try {
    const { title, content } = req.body;

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return fail(res, 400, "Title is required and cannot be empty");
    }

    const todo = await Todo.create({
      title: title.trim(),
      content: content !== undefined ? String(content) : "",
      todoId: uuidv4(),
      version: 1,
      isLatest: true,
      isDeleted: false,
    });

    return ok(res, 201, todo);
  } catch (error) {
    console.error("[createTodo]", error.message);
    return fail(res, 500, "Internal server error");
  }
};

// ─── Get all (latest, non-deleted) ───────────────────────────────────────────

exports.getTodos = async (req, res) => {
  try {
    const todos = await Todo.find({ isLatest: true, isDeleted: false })
      .sort({ createdAt: -1 })
      .select("-__v");

    return ok(res, 200, todos);
  } catch (error) {
    console.error("[getTodos]", error.message);
    return fail(res, 500, "Internal server error");
  }
};

// ─── Get full version history ─────────────────────────────────────────────────

exports.getTodoHistory = async (req, res) => {
  try {
    const { todoId } = req.params;

    if (!todoId || !todoId.trim()) {
      return fail(res, 400, "Invalid todoId");
    }

    const history = await Todo.find({ todoId: todoId.trim() })
      .sort({ version: 1 })
      .select("-__v");

    if (history.length === 0) {
      return fail(res, 404, `No history found for todoId: ${todoId}`);
    }

    return ok(res, 200, history);
  } catch (error) {
    console.error("[getTodoHistory]", error.message);
    return fail(res, 500, "Internal server error");
  }
};

// ─── Get exact snapshot by version ───────────────────────────────────────────

exports.getTodoSnapshot = async (req, res) => {
  try {
    const { todoId, version: versionParam } = req.params;

    if (!todoId || !todoId.trim()) {
      return fail(res, 400, "Invalid todoId");
    }

    // Reject floats like "1.5" — parseInt("1.5") = 1 which would pass silently
    if (!/^\d+$/.test(versionParam)) {
      return fail(res, 400, "Version must be a positive integer");
    }
    const version = Number.parseInt(versionParam, 10);
    if (!Number.isInteger(version) || version <= 0) {
      return fail(res, 400, "Version must be a positive integer");
    }

    const snapshot = await Todo.findOne({ todoId: todoId.trim(), version }).select("-__v");

    if (!snapshot) {
      return fail(
        res,
        404,
        `No snapshot found for todoId: ${todoId} at version: ${version}`
      );
    }

    return ok(res, 200, snapshot);
  } catch (error) {
    console.error("[getTodoSnapshot]", error.message);
    return fail(res, 500, "Internal server error");
  }
};

// ─── Update (MVCC: append new version) ───────────────────────────────────────

exports.updateTodo = async (req, res) => {
  try {
    const { todoId } = req.params;
    const { title, content } = req.body;

    if (!todoId || !todoId.trim()) {
      return fail(res, 400, "Invalid todoId");
    }

    if (title === undefined && content === undefined) {
      return fail(res, 400, "At least one field (title or content) must be provided");
    }

    if (title !== undefined && (typeof title !== "string" || title.trim().length === 0)) {
      return fail(res, 400, "Title cannot be empty");
    }

    // Fetch the current latest non-deleted version
    const current = await Todo.findOne({
      todoId: todoId.trim(),
      isLatest: true,
      isDeleted: false,
    });

    if (!current) {
      return fail(res, 404, "Todo not found or already deleted");
    }

    // Atomically mark the current version as not latest
    const flagResult = await Todo.updateOne(
      {
        _id: current._id,
        todoId: current.todoId,
        version: current.version,
        isLatest: true,
      },
      { $set: { isLatest: false } }
    );

    if (flagResult.modifiedCount === 0) {
      return fail(res, 409, "Concurrent update detected — please retry");
    }

    // Create the new version document
    let newDoc;
    try {
      newDoc = await Todo.create({
        title: title !== undefined ? title.trim() : current.title,
        content: content !== undefined ? String(content) : current.content,
        todoId: current.todoId,
        version: current.version + 1,
        isLatest: true,
        isDeleted: false,
      });
    } catch (saveError) {
      // Rollback: restore isLatest on the previous version
      await Todo.updateOne({ _id: current._id }, { $set: { isLatest: true } });

      if (saveError.code === 11000) {
        return fail(res, 409, "Concurrent update detected — please retry");
      }
      throw saveError;
    }

    return ok(res, 200, newDoc);
  } catch (error) {
    console.error("[updateTodo]", error.message);
    return fail(res, 500, "Internal server error");
  }
};

// ─── Delete (MVCC: soft delete via new version) ───────────────────────────────

exports.deleteTodo = async (req, res) => {
  try {
    const { todoId } = req.params;

    if (!todoId || !todoId.trim()) {
      return fail(res, 400, "Invalid todoId");
    }

    // Fetch the current latest non-deleted version
    const current = await Todo.findOne({
      todoId: todoId.trim(),
      isLatest: true,
      isDeleted: false,
    });

    if (!current) {
      return fail(res, 404, "Todo not found or already deleted");
    }

    // Atomically mark the current version as not latest
    const flagResult = await Todo.updateOne(
      {
        _id: current._id,
        todoId: current.todoId,
        version: current.version,
        isLatest: true,
      },
      { $set: { isLatest: false } }
    );

    if (flagResult.modifiedCount === 0) {
      return fail(res, 409, "Concurrent delete detected — please retry");
    }

    // Create a new version that marks the todo as deleted
    let deletedDoc;
    try {
      deletedDoc = await Todo.create({
        title: current.title,
        content: current.content,
        todoId: current.todoId,
        version: current.version + 1,
        isLatest: true,
        isDeleted: true,
        deletedAt: new Date(),
      });
    } catch (saveError) {
      // Rollback: restore isLatest on the previous version
      await Todo.updateOne({ _id: current._id }, { $set: { isLatest: true } });

      if (saveError.code === 11000) {
        return fail(res, 409, "Concurrent delete detected — please retry");
      }
      throw saveError;
    }

    return ok(res, 200, deletedDoc);
  } catch (error) {
    console.error("[deleteTodo]", error.message);
    return fail(res, 500, "Internal server error");
  }
};