const express = require("express");
const cors = require("cors");
require("dotenv").config();
const connectDB = require("./config/db");
const errorHandler = require("./middleware/errorHandler");

const app = express();

// Initialize database
connectDB();

// middleware
app.use(cors());
app.use(express.json());

// routes
const todoRoutes = require("./routes/todoRoutes");
app.use("/api", todoRoutes);

// test route
app.get("/", (req, res) => {
  res.send("Server is running 🚀");
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Endpoint not found",
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// server start
const PORT = process.env.PORT || 5000;


app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});