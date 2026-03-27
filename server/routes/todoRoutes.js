const express = require("express");
const router = express.Router();
const { createTodo, getTodos } = require("../controllers/todoController");

router.post("/todos", createTodo);
router.get("/todos", getTodos);

module.exports = router;