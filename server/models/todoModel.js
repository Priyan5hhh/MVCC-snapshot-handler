const mongoose = require("mongoose");

const todoSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, "Title is required"],
    trim: true,
  },
  content: {
    type: String,
    default: "",
  },
  todoId: {
    type: String,
    required: true,
    index: true,
  },
  version: {
    type: Number,
    required: true,
    default: 1,
  },
  isLatest: {
    type: Boolean,
    required: true,
    default: true,
    index: true,
  },
  isDeleted: {
    type: Boolean,
    required: true,
    default: false,
  },
  deletedAt: {
    type: Date,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

// Compound unique index: one document per (todoId, version)
todoSchema.index({ todoId: 1, version: 1 }, { unique: true });

// Partial unique index: only one isLatest=true per todoId
todoSchema.index(
  { todoId: 1, isLatest: 1 },
  { unique: true, partialFilterExpression: { isLatest: true } }
);

module.exports = mongoose.model("Todo", todoSchema);