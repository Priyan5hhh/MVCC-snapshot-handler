const express = require("express");
const router = express.Router();
const {
  createTodo,
  getTodos,
  getTodoHistory,
  getTodoSnapshot,
  updateTodo,
  deleteTodo,
} = require("../controllers/todoController");

router.post("/todos", createTodo);
router.get("/todos", getTodos);
router.get("/todos/:todoId/history", getTodoHistory);
router.get("/todos/:todoId/snapshot/:version", getTodoSnapshot);
router.put("/todos/:todoId", updateTodo);
router.delete("/todos/:todoId", deleteTodo);

module.exports = router;