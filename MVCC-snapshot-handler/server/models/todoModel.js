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

// Indexes for efficient MVCC reads and snapshot queries
todoSchema.index({ todoId: 1 });
todoSchema.index({ isLatest: 1 });
todoSchema.index({ createdAt: 1 });

todoSchema.index({ todoId: 1, version: 1 });
todoSchema.index({ todoId: 1, createdAt: -1, version: -1 });
todoSchema.index({ isLatest: 1, isDeleted: 1 });

module.exports = mongoose.model("Todo", todoSchema);