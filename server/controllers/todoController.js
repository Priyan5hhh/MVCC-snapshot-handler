const { v4: uuidv4 } = require("uuid");
const Todo = require("../models/todoModel");

exports.createTodo = async (req, res) => {
  try {
    const { title, content } = req.body;

    if (!title) {
      return res.status(400).json({
        message: "Title is required",
      });
    }

    const newTodo = new Todo({
      title,
      content,
      todoId: uuidv4(),
      version: 1,
      isLatest: true,
    });

    const savedTodo = await newTodo.save();

    console.log(`Todo Created: ${savedTodo.todoId} | version: ${savedTodo.version}`);

    res.status(201).json(savedTodo);
  } catch (error) {
    console.error("Error creating todo:", error);
    res.status(500).json({
      message: "Server Error",
      error: error.message,
    });
  }
};


exports.getTodos = async (req, res) => {
  try {
    // Only return latest versions that are not deleted
    const latestTodos = await Todo.find({ 
      isLatest: true,
      isDeleted: { $ne: true }
    });

    res.status(200).json(latestTodos);
  } catch (error) {
    console.error("Error fetching todos:", error);
    res.status(500).json({
      message: "Server Error",
      error: error.message,
    });
  }
};

exports.getTodoHistory = async (req, res) => {
  try {
    const { todoId } = req.params;

    if (!todoId || typeof todoId !== "string" || todoId.trim().length === 0) {
      return res.status(400).json({
        message: "Invalid todoId",
      });
    }

    const history = await Todo.find({ todoId: todoId }).sort({ version: 1 }).select(
      "title content version isLatest isDeleted deletedAt createdAt -_id"
    );

    if (!history || history.length === 0) {
      console.warn(`History fetch: todoId=${todoId} | versions=0`);
      return res.status(404).json({
        message: `No history found for todoId ${todoId}`,
      });
    }

    console.log(`History fetch: todoId=${todoId} | versions=${history.length}`);

    res.status(200).json(history);
  } catch (error) {
    console.error("Error fetching todo history:", error);
    res.status(500).json({
      message: "Server Error",
      error: error.message,
    });
  }
};

exports.getTodoSnapshot = async (req, res) => {
  try {
    const { todoId } = req.params;
    const { time } = req.query;

    if (!todoId || typeof todoId !== "string" || todoId.trim().length === 0) {
      return res.status(400).json({
        message: "Invalid todoId",
      });
    }

    if (!time || typeof time !== "string" || time.trim().length === 0) {
      return res.status(400).json({
        message: "Timestamp query parameter is required",
      });
    }

    const requestedTime = new Date(time);
    if (Number.isNaN(requestedTime.getTime())) {
      return res.status(400).json({
        message: "Invalid timestamp format. Use ISO format.",
      });
    }

    const snapshot = await Todo.findOne({
      todoId: todoId,
      createdAt: { $lte: requestedTime },
    })
      .sort({ version: -1 })
      .select("todoId title content version isLatest isDeleted deletedAt createdAt -_id");

    if (!snapshot) {
      console.warn(`Snapshot fetch: todoId=${todoId} | time=${requestedTime.toISOString()} | versions=0`);
      return res.status(404).json({
        message: `No snapshot found for todoId ${todoId} before ${requestedTime.toISOString()}`,
      });
    }

    console.log(
      `Snapshot fetch: todoId=${todoId} | time=${requestedTime.toISOString()} | returnedVersion=${snapshot.version}`
    );

    res.status(200).json(snapshot);
  } catch (error) {
    console.error("Error fetching todo snapshot:", error);
    res.status(500).json({
      message: "Server Error",
      error: error.message,
    });
  }
};

exports.updateTodo = async (req, res) => {
  try {
    const { todoId } = req.params;
    const { title, content } = req.body;

    if (!title && content === undefined) {
      return res.status(400).json({
        message: "At least one field (title or content) is required",
      });
    }

    // ATOMIC OPERATION: Use updateOne with condition to ensure we only update if this is the latest
    // This prevents race conditions in concurrent updates
    const currentLatest = await Todo.findOne({
      todoId: todoId,
      isLatest: true,
      isDeleted: { $ne: true }, // Don't update deleted todos
    });

    if (!currentLatest) {
      return res.status(404).json({
        message: "Todo not found",
      });
    }

    const previousVersion = currentLatest.version;

    // Atomically mark old version as not latest
    const updateResult = await Todo.updateOne(
      {
        _id: currentLatest._id,
        todoId: todoId,
        version: previousVersion,
        isLatest: true, // ensure this is still the latest
      },
      { $set: { isLatest: false } }
    );

    if (updateResult.modifiedCount === 0) {
      // Another update may have changed the version, retry logic would go here
      console.warn(`Update conflict for todoId=${todoId}, retrying...`);
      // For now, we'll return an error indicating conflict
      return res.status(409).json({
        message: "Concurrent update detected, please retry",
      });
    }

    console.log(`Todo Updated: ${todoId} | marked version ${previousVersion} as not latest`);

    // Create new version
    const newVersion = new Todo({
      title: title !== undefined ? title : currentLatest.title,
      content: content !== undefined ? content : currentLatest.content,
      todoId: todoId,
      version: previousVersion + 1,
      isLatest: true,
      isDeleted: false,
    });

    const savedNewVersion = await newVersion.save();

    console.log(
      `Todo Updated: ${todoId} | created version ${savedNewVersion.version}`
    );

    res.status(200).json({
      message: "Todo updated successfully",
      data: savedNewVersion,
    });
  } catch (error) {
    console.error("Error updating todo:", error);
    res.status(500).json({
      message: "Server Error",
      error: error.message,
    });
  }
};

exports.deleteTodo = async (req, res) => {
  try {
    const { todoId } = req.params;

    if (!todoId || typeof todoId !== "string" || todoId.trim().length === 0) {
      return res.status(400).json({
        message: "Invalid todoId",
      });
    }

<<<<<<< HEAD
=======
    // MVCC Soft Delete: Create a new version with isDeleted flag instead of physical deletion
>>>>>>> prakant
    const currentLatest = await Todo.findOne({
      todoId: todoId,
      isLatest: true,
    });

    if (!currentLatest) {
      return res.status(404).json({
        message: "Todo not found",
      });
    }

<<<<<<< HEAD
    if (currentLatest.isDeleted) {
      return res.status(400).json({
=======
    // Don't allow deleting already deleted todos
    if (currentLatest.isDeleted === true) {
      return res.status(404).json({
>>>>>>> prakant
        message: "Todo is already deleted",
      });
    }

    const previousVersion = currentLatest.version;

<<<<<<< HEAD
    currentLatest.isLatest = false;
    await currentLatest.save();

    console.log(`Todo Deleted: ${todoId} | marked version ${previousVersion} as not latest`);

=======
    // Atomically mark old version as not latest
    await Todo.updateOne(
      {
        _id: currentLatest._id,
        version: previousVersion,
        isLatest: true,
      },
      { $set: { isLatest: false } }
    );

    console.log(`Todo Deleted: ${todoId} | marked version ${previousVersion} as not latest`);

    // Create a new "deleted" version - soft delete via versioning
>>>>>>> prakant
    const deletedVersion = new Todo({
      title: currentLatest.title,
      content: currentLatest.content,
      todoId: todoId,
      version: previousVersion + 1,
      isLatest: true,
      isDeleted: true,
<<<<<<< HEAD
=======
      deletedAt: new Date(),
>>>>>>> prakant
    });

    const savedDeletedVersion = await deletedVersion.save();

    console.log(
<<<<<<< HEAD
      `Todo Deleted: ${todoId} | version ${savedDeletedVersion.version} marked as deleted`
=======
      `Todo Deleted: ${todoId} | created deletion version ${savedDeletedVersion.version}`
>>>>>>> prakant
    );

    res.status(200).json({
      message: "Todo deleted successfully",
      data: savedDeletedVersion,
    });
  } catch (error) {
    console.error("Error deleting todo:", error);
    res.status(500).json({
      message: "Server Error",
      error: error.message,
    });
  }
};