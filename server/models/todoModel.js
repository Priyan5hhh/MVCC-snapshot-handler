const mongoose = require("mongoose");

const todoSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  content: {
    type: String,
  },
  todoId: {
    type: String,
    required: true,
  },
  version: {
    type: Number,
    default: 1,
  },
  isLatest: {
    type: Boolean,
    default: true,
  },
  isDeleted: {
    type: Boolean,
    default: false,
  },
  deletedAt: {
    type: Date,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

todoSchema.index({ todoId: 1 });
todoSchema.index({ isLatest: 1 });
todoSchema.index({ createdAt: -1 });
todoSchema.index({ todoId: 1, version: 1 }, { unique: true });
todoSchema.index(
  { todoId: 1, isLatest: 1 },
  { unique: true, partialFilterExpression: { isLatest: true } }
);

module.exports = mongoose.model("Todo", todoSchema);