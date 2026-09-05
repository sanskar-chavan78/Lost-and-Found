const express = require('express');
const router = express.Router();
const {
  postLostItem,
  postFoundItem,
  getAllItems,
  getUserItems,
  deleteItem,
  getMatchedItems,
  getItemStats,
  postItem,
  getItemById,
} = require('../controllers/itemController');
const { protect } = require('../middleware/authMiddleware');
const multer = require('multer');
const path = require('path');

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ storage });

// Public route
console.log('Registering public item routes');
router.get('/stats', getItemStats);
router.get('/', getAllItems);
router.get('/single/:id', getItemById);

// Protected routes
router.use(protect);

router.post('/', upload.single('image'), postItem);
router.post('/lost', upload.single('image'), postLostItem);
router.post('/found', upload.single('image'), postFoundItem);
router.get('/mine', getUserItems);
router.delete('/:id', deleteItem);
router.get('/match', getMatchedItems);

module.exports = router;
