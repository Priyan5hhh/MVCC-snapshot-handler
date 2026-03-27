const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

dotenv.config();

const app = express();

connectDB();

app.use(express.json());
app.use(cors());

app.get('/api/health', (req, res) => {
  try {
    console.log('Health check API called');
    res.json({ status: 'Server is running' });
  } catch (error) {
    console.error('Error in health check:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server started and running on port ${PORT}`);
});