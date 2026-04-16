#!/usr/bin/env node

/**
 * MongoDB Database Cleanup for MVCC Todo Tests
 * Removes corrupted data and prepares fresh database for testing
 */

const mongoose = require("mongoose");

const mongoURL = process.env.MONGO_URI || "mongodb://localhost:27017/mvcc-todo";

const todoSchema = new mongoose.Schema({
  title: String,
  content: String,
  todoId: String,
  version: Number,
  isLatest: Boolean,
  isDeleted: Boolean,
  deletedAt: Date,
  createdAt: Date,
});

const Todo = mongoose.model("Todo", todoSchema);

async function cleanupDatabase() {
  try {
    console.log("🔧 Connecting to MongoDB...");
    await mongoose.connect(mongoURL);
    console.log("✅ Connected to MongoDB");

    console.log("\n📊 Database Cleanup Report:");
    console.log("═══════════════════════════════════════════");

    // Count total documents
    const totalDocs = await Todo.countDocuments();
    console.log(`Total documents in database: ${totalDocs}`);

    // Find todos with multiple isLatest=true
    const allTodos = await Todo.find({});
    const todoIdGroups = {};

    allTodos.forEach((doc) => {
      if (!todoIdGroups[doc.todoId]) {
        todoIdGroups[doc.todoId] = [];
      }
      todoIdGroups[doc.todoId].push(doc);
    });

    let duplicateLatestCount = 0;
    let corruptedTodoIds = [];

    for (const [todoId, versions] of Object.entries(todoIdGroups)) {
      const latestCount = versions.filter((v) => v.isLatest === true).length;
      if (latestCount > 1) {
        corruptedTodoIds.push(todoId);
        duplicateLatestCount += latestCount - 1;
      }
    }

    console.log(`Todos with multiple isLatest flags: ${corruptedTodoIds.length}`);
    console.log(`Total duplicate isLatest entries: ${duplicateLatestCount}`);

    if (corruptedTodoIds.length > 0) {
      console.log("\n🧹 Fixing Corrupted Data...");

      let fixed = 0;
      for (const todoId of corruptedTodoIds) {
        const versions = todoIdGroups[todoId];
        const maxVersion = Math.max(...versions.map((v) => v.version));

        // Mark only the highest version as latest
        for (const version of versions) {
          if (version.version !== maxVersion && version.isLatest === true) {
            await Todo.updateOne(
              { _id: version._id },
              { $set: { isLatest: false } }
            );
            fixed++;
          }
        }
      }

      console.log(`✅ Fixed ${fixed} duplicate isLatest entries`);
    }

    // Final verification
    const finalVerification = await Todo.countDocuments({ isLatest: true });
    const todoCount = Object.keys(todoIdGroups).length;

    console.log("\n✅ Final Verification:");
    console.log(`Total todos: ${todoCount}`);
    console.log(`Total isLatest=true entries: ${finalVerification}`);

    if (finalVerification === todoCount) {
      console.log("✅ Database is now consistent!");
    } else {
      console.log("⚠️  Warning: Inconsistency may remain");
    }

    console.log("\n═══════════════════════════════════════════");
    console.log("✅ Cleanup complete!");
    await mongoose.connection.close();
  } catch (err) {
    console.error("❌ Error during cleanup:", err);
    process.exit(1);
  }
}

cleanupDatabase();
