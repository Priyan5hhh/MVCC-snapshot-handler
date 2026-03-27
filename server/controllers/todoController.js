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
    const latestTodos = await Todo.find({ isLatest: true });

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
      "title content version isLatest createdAt -_id"
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


exports.updateTodo = async (req, res) => {
  try {
    const { todoId } = req.params;
    const { title, content } = req.body;

    if (!title && content === undefined) {
      return res.status(400).json({
        message: "At least one field (title or content) is required",
      });
    }

    const currentLatest = await Todo.findOne({
      todoId: todoId,
      isLatest: true,
    });

    if (!currentLatest) {
      return res.status(404).json({
        message: "Todo not found",
      });
    }

    const previousVersion = currentLatest.version;

    currentLatest.isLatest = false;
    await currentLatest.save();

    console.log(`Todo Updated: ${todoId} | marked version ${previousVersion} as not latest`);

    const newVersion = new Todo({
      title: title !== undefined ? title : currentLatest.title,
      content: content !== undefined ? content : currentLatest.content,
      todoId: todoId,
      version: previousVersion + 1,
      isLatest: true,
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