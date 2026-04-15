const express = require("express");
const router = express.Router();
const { createTodo, getTodos, getTodoHistory, getTodoSnapshot, updateTodo } = require("../controllers/todoController");

router.post("/todos", createTodo);
router.get("/todos", getTodos);
router.get("/todos/:todoId/history", getTodoHistory);
router.get("/todos/:todoId/snapshot", getTodoSnapshot);
router.put("/todos/:todoId", updateTodo);

module.exports = router;