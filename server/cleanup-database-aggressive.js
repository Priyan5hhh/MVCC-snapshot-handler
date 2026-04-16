#!/usr/bin/env node

/**
 * Aggressive Database Cleanup for MVCC Todo Tests
 * Aggressively removes all duplicate isLatest entries and corrupted data
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

async function aggressiveCleanup() {
  try {
    console.log("🔧 Connecting to MongoDB...");
    await mongoose.connect(mongoURL);
    console.log("✅ Connected to MongoDB\n");

    // Step 1: Find all duplicates
    console.log("📋 Step 1: Scanning for duplicate isLatest entries...");
    const allTodos = await Todo.find({});
    console.log(`Total documents found: ${allTodos.length}\n`);

    const todoIdMap = {};
    allTodos.forEach((doc) => {
      if (!todoIdMap[doc.todoId]) {
        todoIdMap[doc.todoId] = [];
      }
      todoIdMap[doc.todoId].push(doc);
    });

    let corruptedCount = 0;
    const fixOperations = [];

    for (const [todoId, versions] of Object.entries(todoIdMap)) {
      const latestVersions = versions.filter((v) => v.isLatest === true);
      if (latestVersions.length > 1) {
        corruptedCount++;
        console.log(
          `⚠️  Corrupted todoId: ${todoId} (${latestVersions.length} isLatest=true entries)`
        );

        // Sort by version to find the true latest
        const maxVersion = Math.max(...versions.map((v) => v.version));
        const trueLatest = versions.find((v) => v.version === maxVersion);

        // Mark all others as not latest
        for (const version of latestVersions) {
          if (version._id !== trueLatest._id) {
            fixOperations.push({
              _id: version._id,
              currentIsLatest: version.isLatest,
            });
          }
        }
      }
    }

    console.log(
      `\nFound ${corruptedCount} corrupted todos with duplicate isLatest entries`
    );

    // Step 2: Execute all fixes
    if (fixOperations.length > 0) {
      console.log(`\n🧹 Step 2: Fixing ${fixOperations.length} corrupted entries...`);

      let fixed = 0;
      for (const op of fixOperations) {
        const result = await Todo.updateOne(
          { _id: op._id },
          { $set: { isLatest: false } }
        );
        if (result.modifiedCount > 0) {
          fixed++;
          console.log(`✓ Fixed entry ${fixed}/${fixOperations.length}`);
        }
      }

      console.log(`\n✅ Successfully fixed ${fixed} entries\n`);
    } else {
      console.log("✅ No corrupted entries found\n");
    }

    // Step 3: Final verification
    console.log("✅ Step 3: Final Verification");
    const verification = await Todo.find({});
    const verifyMap = {};

    verification.forEach((doc) => {
      if (!verifyMap[doc.todoId]) {
        verifyMap[doc.todoId] = { total: 0, latest: 0 };
      }
      verifyMap[doc.todoId].total++;
      if (doc.isLatest === true) {
        verifyMap[doc.todoId].latest++;
      }
    });

    let stillCorrupted = 0;
    for (const [todoId, counts] of Object.entries(verifyMap)) {
      if (counts.latest !== 1) {
        console.log(
          `✗ STILL CORRUPTED: todoId ${todoId} has ${counts.latest} isLatest=true`
        );
        stillCorrupted++;
      }
    }

    console.log(`\n════════════════════════════════════════`);
    console.log(`Total todos in database: ${Object.keys(verifyMap).length}`);
    console.log(`Total documents: ${verification.length}`);
    console.log(`Todos with correct isLatest: ${Object.keys(verifyMap).length - stillCorrupted}`);
    console.log(`Todos still corrupted: ${stillCorrupted}`);

    if (stillCorrupted === 0) {
      console.log(
        `\n✅ DATABASE CLEANUP COMPLETE - All duplicates resolved!`
      );
    } else {
      console.log(`\n⚠️ WARNING: ${stillCorrupted} corrupted entries still exist`);
    }

    console.log(`════════════════════════════════════════\n`);

    await mongoose.connection.close();
  } catch (error) {
    console.error("❌ Error during cleanup:", error);
    process.exit(1);
  }
}

aggressiveCleanup();
