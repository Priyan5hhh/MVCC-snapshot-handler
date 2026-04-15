const mongoose = require('mongoose');

mongoose.set('autoIndex', true);

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/mvcc-todo');
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('MongoDB connection failed, but continuing...:', error.message);
    // process.exit(1); // Commented out to allow server to start without MongoDB
  }
};

module.exports = connectDB;