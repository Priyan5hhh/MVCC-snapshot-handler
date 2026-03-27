const express = require("express");
const router = express.Router();
const { createTodo, getTodos, getTodoHistory, updateTodo } = require("../controllers/todoController");

router.post("/todos", createTodo);
router.get("/todos", getTodos);
router.get("/todos/:todoId/history", getTodoHistory);
router.put("/todos/:todoId", updateTodo);

module.exports = router;