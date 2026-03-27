const { v4: uuidv4 } = require("uuid");

// 👉 temporary DB
let todos = [];

// ✅ Create Todo
exports.createTodo = (req, res) => {
  try {
    const { title, content } = req.body;

    if (!title) {
      return res.status(400).json({
        message: "Title is required",
      });
    }

    const newTodo = {
      title,
      content,
      todoId: uuidv4(),
      version: 1,
      isLatest: true,
      createdAt: new Date(),
    };

    todos.push(newTodo);

    console.log(`Todo Created: ${newTodo.todoId} | version: ${newTodo.version}`);

    res.status(201).json(newTodo);
  } catch (error) {
    res.status(500).json({
      message: "Server Error",
      error: error.message,
    });
  }
};

// ✅ Get Todos (only latest)
exports.getTodos = (req, res) => {
  try {
    const latestTodos = todos.filter(todo => todo.isLatest === true);

    res.status(200).json(latestTodos);
  } catch (error) {
    res.status(500).json({
      message: "Server Error",
      error: error.message,
    });
  }
};