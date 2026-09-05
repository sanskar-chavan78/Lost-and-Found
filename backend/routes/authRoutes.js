const express = require('express');
const router = express.Router();
const { registerUser, loginUser, getMe, updateProfile, updatePassword } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/me', protect, getMe);
router.get('/profile', protect, getMe);
router.put('/me', protect, updateProfile);
router.put('/password', protect, updatePassword);

module.exports = router;
