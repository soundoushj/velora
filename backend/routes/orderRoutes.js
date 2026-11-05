const express = require('express');
const ctrl = require('../controllers/orderController');
const { authenticate, requireAdmin } = require('../middleware/auth');
const validate = require('../middleware/validate');
const v = require('../middleware/orderValidators');

module.exports = (limiters) => {
  const router = express.Router();

  // Public (guest checkout), with its own stricter rate limit
  router.post('/', limiters.orderLimiter, v.createOrderRules, validate, ctrl.create);

  // Admin only: valid JWT (authenticate) AND administrator role (requireAdmin)
  router.get('/', authenticate, requireAdmin, v.orderListRules, validate, ctrl.list);
  router.get('/:id', authenticate, requireAdmin, v.orderIdParam, validate, ctrl.getOne);
  router.patch('/:id/status', authenticate, requireAdmin, v.orderIdParam, v.orderStatusRules, validate, ctrl.updateStatus);

  return router;
};
