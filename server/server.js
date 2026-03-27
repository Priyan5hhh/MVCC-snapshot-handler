// const express = require('express');
// const cors = require('cors');
// const dotenv = require('dotenv');
// const connectDB = require('./config/db');

// dotenv.config();

// const app = express();

// connectDB();

// app.use(express.json());
// app.use(cors());

// app.get('/api/health', (req, res) => {
//   try {
//     console.log('Health check API called');
//     res.json({ status: 'Server is running' });
//   } catch (error) {
//     console.error('Error in health check:', error);
//     res.status(500).json({ error: 'Internal server error' });
//   }
// });

// const PORT = process.env.PORT || 5000;

// app.listen(PORT, () => {
//   console.log(`Server started and running on port ${PORT}`);
// });
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();

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