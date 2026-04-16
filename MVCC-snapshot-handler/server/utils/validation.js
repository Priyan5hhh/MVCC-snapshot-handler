/**
 * Input Validation Utilities
 * Provides validation helpers for standard checks
 */

class ValidationError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
    this.name = "ValidationError";
  }
}

const validateTodoId = (todoId) => {
  if (!todoId || typeof todoId !== "string" || todoId.trim().length === 0) {
    throw new ValidationError("Invalid or missing todoId");
  }
  return todoId.trim();
};

const validateTitle = (title) => {
  if (!title || typeof title !== "string" || title.trim().length === 0) {
    throw new ValidationError("Title is required and must be a non-empty string");
  }
  return title.trim();
};

const validateTimestamp = (time) => {
  if (!time || typeof time !== "string" || time.trim().length === 0) {
    throw new ValidationError("Timestamp (time) parameter is required");
  }

  const parsedTime = new Date(time);
  if (Number.isNaN(parsedTime.getTime())) {
    throw new ValidationError("Invalid timestamp format. Use ISO 8601 format (e.g., 2026-04-15T10:30:00Z)");
  }

  return parsedTime;
};

const validateUpdatePayload = (title, content) => {
  if (title === undefined && content === undefined) {
    throw new ValidationError("At least one field (title or content) must be provided");
  }

  if (title !== undefined && (typeof title !== "string" || title.trim().length === 0)) {
    throw new ValidationError("Title must be a non-empty string");
  }

  if (content !== undefined && typeof content !== "string") {
    throw new ValidationError("Content must be a string");
  }

  return {
    title: title !== undefined ? title.trim() : undefined,
    content: content !== undefined ? content : undefined,
  };
};

module.exports = {
  ValidationError,
  validateTodoId,
  validateTitle,
  validateTimestamp,
  validateUpdatePayload,
};
