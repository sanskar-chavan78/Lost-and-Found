const express = require('express');
const router = express.Router();
const {
  getAllItemsAdmin,
  getDashboardStats,
  approveItem,
  deleteItemAdmin,
  getUsers,
  deleteUserAdmin,
} = require('../controllers/adminController');
const { protect } = require('../middleware/authMiddleware');
const { admin } = require('../middleware/adminMiddleware');

// All admin routes are protected
router.use(protect);
router.use(admin);

router.get('/stats', getDashboardStats);
router.get('/items', getAllItemsAdmin);
router.patch('/items/:id/approve', approveItem);
router.delete('/items/:id', deleteItemAdmin);
router.get('/users', getUsers);
router.delete('/users/:id', deleteUserAdmin);

module.exports = router;
