const express = require("express");
const router = express.Router();
const { createTodo, getTodos, updateTodo } = require("../controllers/todoController");

router.post("/todos", createTodo);
router.get("/todos", getTodos);
router.put("/todos/:todoId", updateTodo);

module.exports = router;