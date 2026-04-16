/**
 * Standardized Response Helpers
 * Provides consistent response format across all endpoints
 */

const sendSuccess = (res, data, statusCode = 200) => {
  res.status(statusCode).json({
    success: true,
    data: data,
  });
};

const sendError = (res, message, statusCode = 400) => {
  res.status(statusCode).json({
    success: false,
    message: message,
  });
};

module.exports = {
  sendSuccess,
  sendError,
};
