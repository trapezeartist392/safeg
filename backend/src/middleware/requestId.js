const { v4: uuid } = require('uuid');
exports.requestId = (req, res, next) => {
  req.requestId = req.headers['x-request-id'] || uuid();
  res.setHeader('X-Request-Id', req.requestId);
  next();
};
