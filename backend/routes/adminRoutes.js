const express = require('express');
const ctrl = require('../controllers/adminController');
const { authenticate, requireAdmin } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { customerListRules } = require('../middleware/validators');

const router = express.Router();
router.use(authenticate, requireAdmin); // EVERY route below is admin-only

router.get('/stats', ctrl.stats);
router.get('/customers', customerListRules, validate, ctrl.listCustomers);

module.exports = router;
