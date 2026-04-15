const express = require("express");
const cors = require("cors");
require("dotenv").config();
const connectDB = require("./config/db");

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

// server start
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});