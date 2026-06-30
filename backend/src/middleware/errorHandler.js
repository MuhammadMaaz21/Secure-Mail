/**
 * Centralized error handling middleware
 */

const errorHandler = (err, req, res, next) => {
  // Log error for debugging (sanitize sensitive data)
  console.error('[Error]', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method
  });

  // Default error
  let status = err.status || err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let error = err.error || 'ServerError';

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    status = 400;
    error = 'ValidationError';
    message = Object.values(err.errors).map(e => e.message).join(', ');
  }

  // Mongoose cast error (invalid ID)
  if (err.name === 'CastError') {
    status = 400;
    error = 'ValidationError';
    message = 'Invalid ID format';
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    status = 401;
    error = 'AuthenticationError';
    message = 'Invalid or expired token';
  }

  // Duplicate key error (MongoDB)
  if (err.code === 11000) {
    status = 409;
    error = 'ConflictError';
    message = 'Duplicate entry';
  }

  // Send error response
  res.status(status).json({
    success: false,
    error,
    message,
    ...(process.env.NODE_ENV === 'development' && { details: err.stack })
  });
};

module.exports = errorHandler;

