const { createLogger, format, transports } = require('winston');

// Basic structured logger configuration
const logger = createLogger({
  level: 'error',
  format: format.combine(
    format.timestamp(),
    format.json()
  ),
  transports: [new transports.Console()]
});

/**
 * Express error-handling middleware for consistent API responses.
 * Logs errors using winston and sends a JSON response.
 */
const errorHandler = (err, req, res, next) => {
  logger.error({
    message: err.message,
    stack: err.stack,
    route: req.originalUrl
  });

  let status = err.status || err.statusCode;
  if (!status) {
    if (err.code === '23505') status = 409; // PostgreSQL unique_violation
    else if (err.code === '23503') status = 400; // foreign_key_violation
    else status = 500;
  }
  const isProduction = process.env.NODE_ENV === 'production';
  const message = status === 500 && isProduction ? 'Internal server error' : err.message;

  res.status(status).json({ error: message });
};

module.exports = errorHandler;
module.exports.logger = logger;

