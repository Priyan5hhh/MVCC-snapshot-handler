/**
 * Centralized Error Handling Middleware
 * Catches unhandled errors and provides consistent error responses
 */

const errorHandler = (err, req, res, next) => {
  console.error("❌ Error:", {
    message: err.message,
    statusCode: err.statusCode || 500,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString(),
  });

  const statusCode = err.statusCode || 500;
  const message =
    err.message || "Internal Server Error";

  res.status(statusCode).json({
    success: false,
    message: message,
    ...(process.env.NODE_ENV === "development" && { error: err.stack }),
  });
};

module.exports = errorHandler;
