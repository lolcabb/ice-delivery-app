const { validationResult } = require('express-validator');

module.exports = validations => async (req, res, next) => {
  for (const validation of validations) {
    await validation.run(req);
  }

  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return next();
  }
  res.status(400).json({ errors: errors.array() });
};
