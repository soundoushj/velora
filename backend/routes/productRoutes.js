const express = require('express');
const ctrl = require('../controllers/productController');
const { authenticate, requireAdmin } = require('../middleware/auth');
const validate = require('../middleware/validate');
const v = require('../middleware/validators');

const router = express.Router();

// Public
router.get('/', v.productListRules, validate, ctrl.list);
router.get('/:id', v.idOrSlugParam, validate, ctrl.getOne);

// Protected: valid JWT (authenticate) AND administrator role (requireAdmin), checked on the server.
router.post('/', authenticate, requireAdmin, v.createProductRules, validate, ctrl.create);
router.put('/:id', authenticate, requireAdmin, v.mongoIdParam, v.updateProductRules, validate, ctrl.update);
router.patch('/:id/stock', authenticate, requireAdmin, v.mongoIdParam, v.stockRules, validate, ctrl.updateStock);
router.delete('/:id', authenticate, requireAdmin, v.mongoIdParam, validate, ctrl.remove);

module.exports = router;
