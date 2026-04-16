const express = require("express");
const cors = require("cors");
require("dotenv").config();
const connectDB = require("./config/db");

const app = express();

// Connect to database
connectDB();

// Middleware
app.use(cors({ origin: "*" }));
app.use(express.json());

// Health check
app.get("/api/health", (req, res) => {
  res.status(200).json({ success: true, message: "Server is running" });
});

// API routes
const todoRoutes = require("./routes/todoRoutes");
app.use("/api", todoRoutes);

// Root route
app.get("/", (req, res) => {
  res.json({ success: true, message: "MVCC Todo API is running 🚀" });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});