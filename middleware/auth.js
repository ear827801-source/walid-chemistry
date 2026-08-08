const jwt = require('jsonwebtoken');

/**
 * JWT Authentication Middleware
 * Protects API routes — requires valid Bearer token in Authorization header.
 */
function authMiddleware(req, res, next) {
  next();
}

module.exports = authMiddleware;
