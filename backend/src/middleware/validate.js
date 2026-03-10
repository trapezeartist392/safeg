const { validationResult } = require('express-validator');
const AppError = require('../utils/AppError');
module.exports = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const err = new AppError('Validation failed', 422);
    err.errors = errors.array().map(e => ({ field: e.path, message: e.msg }));
    return next(err);
  }
  next();
};
