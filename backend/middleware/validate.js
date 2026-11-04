const { validationResult } = require('express-validator');
const ApiError = require('../utils/ApiError');

/** Turns express-validator results into a clean 400 response (never echoes submitted values). */
module.exports = (req, _res, next) => {
  const result = validationResult(req);
  if (result.isEmpty()) return next();
  const errors = result.array({ onlyFirstError: true }).map((e) => ({ field: e.path, message: e.msg }));
  next(new ApiError(400, 'Validation failed.', errors));
};
