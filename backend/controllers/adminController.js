const Item = require('../models/Item');
const User = require('../models/User');

// @desc    Get all items (both pending and approved)
// @route   GET /api/admin/items
// @access  Private/Admin
const getAllItemsAdmin = async (req, res) => {
  try {
    const items = await Item.find({}).sort({ createdAt: -1 });
    res.json({ success: true, items: items });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get dashboard stats
// @route   GET /api/admin/stats
// @access  Private/Admin
const getDashboardStats = async (req, res) => {
  try {
    // Calculate the date boundary for weekly activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Parallelize all database aggregation and query lookups to minimize DB roundtrip latency
    const [
      totalItems,
      pendingReview,
      approvedItems,
      totalUsers,
      lostLastWeek,
      foundLastWeek,
      lostItems,
      foundItems
    ] = await Promise.all([
      Item.countDocuments({}), // Total items in DB
      Item.countDocuments({ status: 'pending' }), // Items awaiting admin review
      Item.countDocuments({ status: 'approved' }), // Approved active items
      User.countDocuments({}), // Total registered user count
      Item.countDocuments({ type: 'lost', createdAt: { $gte: sevenDaysAgo } }), // Lost items reported last week
      Item.countDocuments({ type: 'found', createdAt: { $gte: sevenDaysAgo } }), // Found items reported last week
      Item.find({ type: 'lost', status: 'approved' }), // Fetch all active lost items for matching
      Item.find({ type: 'found', status: 'approved' }) // Fetch all active found items for matching
    ]);
    let matchCount = 0;
    lostItems.forEach((lost) => {
      foundItems.forEach((found) => {
        if (
          lost.category.toLowerCase() === found.category.toLowerCase() &&
          lost.location.toLowerCase() === found.location.toLowerCase()
        ) {
          matchCount++;
        }
      });
    });

    // Category Breakdown
    const categories = ['Electronics', 'Bags', 'Accessories', 'Documents', 'Vehicles', 'Clothing', 'Keys', 'Others'];
    const categoryBreakdown = await Promise.all(categories.map(async (cat) => {
      const count = await Item.countDocuments({ category: cat });
      return { category: cat, count };
    }));

    res.json({
      success: true,
      data: {
        totalItems,
        pendingReview,
        approvedItems,
        totalUsers,
        weeklyActivity: {
          lost: lostLastWeek,
          found: foundLastWeek,
          matches: matchCount
        },
        categoryBreakdown
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Approve an item
// @route   PUT /api/admin/items/:id/approve
// @access  Private/Admin
const approveItem = async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);

    if (item) {
      item.status = 'approved';
      const updatedItem = await item.save();

      // Notify via socket.io
      const io = req.app.get('socketio');
      if (io) {
        io.emit('itemUpdated', { type: 'approved', item: updatedItem });
        io.emit('statsUpdated');
      }

      res.json({ success: true, message: 'Item approved', data: updatedItem });
    } else {
      res.status(404).json({ success: false, message: 'Item not found' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete item (admin power)
// @route   DELETE /api/admin/items/:id
// @access  Private/Admin
const deleteItemAdmin = async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);

    if (item) {
      await item.deleteOne();

      // Notify via socket.io
      const io = req.app.get('socketio');
      if (io) {
        io.emit('itemUpdated', { type: 'deleted', itemId: req.params.id });
        io.emit('statsUpdated');
      }

      res.json({ success: true, message: 'Item removed' });
    } else {
      res.status(404).json({ success: false, message: 'Item not found' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all users
// @route   GET /api/admin/users
// @access  Private/Admin
const getUsers = async (req, res) => {
  try {
    const users = await User.find({}).select('-password');
    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete user
// @route   DELETE /api/admin/users/:id
// @access  Private/Admin
const deleteUserAdmin = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (user) {
      if (user.role === 'admin') {
        return res.status(400).json({ success: false, message: 'Cannot delete admin user' });
      }
      await user.deleteOne();
      
      // Also delete items posted by this user? 
      // await Item.deleteMany({ user: req.params.id });

      const io = req.app.get('socketio');
      if (io) {
        io.emit('userDeleted', req.params.id);
        io.emit('statsUpdated');
      }

      res.json({ success: true, message: 'User removed' });
    } else {
      res.status(404).json({ success: false, message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getAllItemsAdmin,
  getDashboardStats,
  approveItem,
  deleteItemAdmin,
  getUsers,
  deleteUserAdmin,
};
