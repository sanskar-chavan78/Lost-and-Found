const Item = require('../models/Item');

// @desc    Post a lost item
// @route   POST /api/items/lost
// @access  Private
const postLostItem = async (req, res) => {
  const { title, name, category, location, date, description, contact } = req.body;
  let image = req.body.image;

  if (req.file) {
    image = `http://localhost:5000/uploads/${req.file.filename}`;
  }

  try {
    const item = await Item.create({
      type: 'lost',
      name: name || title,
      category,
      location,
      date,
      description,
      contact,
      image,
      userId: req.user.id,
    });

    // Check for matches and notify via socket.io
    const io = req.app.get('socketio');
    await checkForMatches(item, io);

    if (io) {
      io.emit('itemCreated', item);
      io.emit('statsUpdated');
    }

    res.status(201).json({ success: true, message: 'Lost item posted', data: item });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Post a found item
// @route   POST /api/items/found
// @access  Private
const postFoundItem = async (req, res) => {
  const { title, name, category, location, date, description, contact } = req.body;
  let image = req.body.image;

  if (req.file) {
    image = `http://localhost:5000/uploads/${req.file.filename}`;
  }

  try {
    const item = await Item.create({
      type: 'found',
      name: name || title,
      category,
      location,
      date,
      description,
      contact,
      image,
      userId: req.user.id,
    });

    // Check for matches and notify via socket.io
    const io = req.app.get('socketio');
    await checkForMatches(item, io);

    if (io) {
      io.emit('itemCreated', item);
      io.emit('statsUpdated');
    }

    res.status(201).json({ success: true, message: 'Found item posted', data: item });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all approved items
// @route   GET /api/items
// @access  Public
const getAllItems = async (req, res) => {
  try {
    const { category, location, type, search, page = 1, limit = 10 } = req.query;
    let query = { status: 'approved' };

    if (category) query.category = category;
    if (location) query.location = { $regex: location, $options: 'i' };
    if (type) query.type = type;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } },
      ];
    }

    const count = await Item.countDocuments(query);
    const items = await Item.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    res.json({
      success: true,
      items: items,
      pagination: {
        total: count,
        pages: Math.ceil(count / limit),
        currentPage: Number(page),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get user's items
// @route   GET /api/items/mine
// @access  Private
const getUserItems = async (req, res) => {
  try {
    const items = await Item.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json({ success: true, items: items });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete item
// @route   DELETE /api/items/:id
// @access  Private
const deleteItem = async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);

    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    // Check if user is owner of item or admin
    if (item.userId.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }

    await item.deleteOne();

    // Notify via socket.io
    const io = req.app.get('socketio');
    if (io) {
      io.emit('itemUpdated', { type: 'deleted', itemId: req.params.id });
      io.emit('statsUpdated');
    }

    res.json({ success: true, message: 'Item deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const calculateMatchScore = (lost, found) => {
  let score = 0;

  // 1. Category match (Highest weight)
  if (lost.category.toLowerCase() === found.category.toLowerCase()) {
    score += 40;
  }

  // 2. Location similarity
  const lostLoc = lost.location.toLowerCase();
  const foundLoc = found.location.toLowerCase();
  if (lostLoc === foundLoc) {
    score += 30;
  } else if (lostLoc.includes(foundLoc) || foundLoc.includes(lostLoc)) {
    score += 15;
  }

  // 3. Name/Title similarity
  const lostName = lost.name.toLowerCase();
  const foundName = found.name.toLowerCase();
  if (lostName === foundName) {
    score += 20;
  } else {
    // Basic word overlap for name
    const lostWords = lostName.split(/\s+/);
    const foundWords = foundName.split(/\s+/);
    const commonWords = lostWords.filter((w) => w.length > 2 && foundWords.includes(w));
    if (commonWords.length > 0) score += 10;
  }

  // 4. Description overlap (Bonus)
  const lostDesc = lost.description.toLowerCase();
  const foundDesc = found.description.toLowerCase();
  const descWords = lostDesc.split(/\s+/).filter(w => w.length > 3);
  const commonDesc = descWords.filter(w => foundDesc.includes(w));
  if (commonDesc.length > 3) score += 10;
  else if (commonDesc.length > 0) score += 5;

  // 5. Date similarity (Bonus)
  const dateDiff = Math.abs(new Date(lost.date) - new Date(found.date));
  const dayDiff = dateDiff / (1000 * 60 * 60 * 24);
  if (dayDiff <= 1) score += 10;
  else if (dayDiff <= 3) score += 5;

  return Math.min(score, 100);
};

// @desc    Match lost and found items
// @route   GET /api/items/match
// @access  Private
const getMatchedItems = async (req, res) => {
  try {
    const userId = req.user.id;
    const myItems = await Item.find({ userId, status: 'approved' });

    if (myItems.length === 0) {
      return res.json({ success: true, items: [] });
    }

    let matches = [];
    const allItems = await Item.find({ status: 'approved' });

    myItems.forEach((myItem) => {
      const otherType = myItem.type === 'lost' ? 'found' : 'lost';
      const potentialMatches = allItems.filter(item => item.type === otherType);

      potentialMatches.forEach((other) => {
        const lost = myItem.type === 'lost' ? myItem : other;
        const found = myItem.type === 'found' ? myItem : other;
        const score = calculateMatchScore(lost, found);
        
        if (score >= 40) { // Threshold for a potential match
          // Ensure we don't add duplicate pairs
          const pairExists = matches.some(m => 
            (m.lost._id.toString() === lost._id.toString()) && 
            (m.found._id.toString() === found._id.toString())
          );
          if (!pairExists) {
            matches.push({ lost, found, score });
          }
        }
      });
    });

    // Sort by score descending
    matches.sort((a, b) => b.score - a.score);

    res.json({ success: true, items: matches });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get public counts for lost, found, reunited and suggested match items
// @route   GET /api/items/stats
// @access  Public
const getItemStats = async (req, res) => {
  try {
    // Parallelize count documents and matching calculations queries to return fast response
    const [lostCount, foundCount, reunitedCount, matchCount] = await Promise.all([
      Item.countDocuments({ type: 'lost', status: 'approved' }), // Approved lost items
      Item.countDocuments({ type: 'found', status: 'approved' }), // Approved found items
      Item.countDocuments({ status: 'reunited' }), // Items reunited with owners
      getMatchCountInternal() // Calculate matching items count
    ]);

    res.json({
      success: true,
      lostCount,
      foundCount,
      reunitedCount,
      matchCount
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Helper function to calculate active match count across all approved lost & found items
const getMatchCountInternal = async () => {
  // Query both sets of items in parallel
  const [lostItems, foundItems] = await Promise.all([
    Item.find({ type: 'lost', status: 'approved' }),
    Item.find({ type: 'found', status: 'approved' })
  ]);
  let count = 0;
  // Calculate cross-matching score for all lost & found combinations
  lostItems.forEach((lost) => {
    foundItems.forEach((found) => {
      const score = calculateMatchScore(lost, found);
      if (score >= 50) { // Threshold for active matches count display
        count++;
      }
    });
  });
  return count;
};

const checkForMatches = async (newItem, io) => {
  try {
    const otherType = newItem.type === 'lost' ? 'found' : 'lost';
    const others = await Item.find({ type: otherType, status: 'approved' });

    if (others.length > 0 && io) {
      others.forEach((other) => {
        const lost = newItem.type === 'lost' ? newItem : other;
        const found = newItem.type === 'found' ? newItem : other;
        const score = calculateMatchScore(lost, found);

        if (score >= 50) {
          io.emit('newMatch', {
            newItem,
            matchedWith: other,
            matchPercent: score,
          });
        }
      });
    }
  } catch (error) {
    console.error('Error checking for matches:', error);
  }
};

// @desc    Post an item (lost or found)
// @route   POST /api/items
// @access  Private
const postItem = async (req, res) => {
  const { type, title, name, category, location, date, description, contact } = req.body;
  let image = req.body.image;

  if (req.file) {
    image = `http://localhost:5000/uploads/${req.file.filename}`;
  }

  if (!type || !['lost', 'found'].includes(type)) {
    return res.status(400).json({ success: false, message: 'Valid type (lost or found) is required' });
  }

  try {
    const item = await Item.create({
      type,
      name: name || title,
      category,
      location,
      date,
      description,
      contact,
      image,
      userId: req.user.id,
    });

    // Check for matches and notify via socket.io
    const io = req.app.get('socketio');
    await checkForMatches(item, io);

    if (io) {
      io.emit('itemCreated', item);
      io.emit('statsUpdated');
    }

    res.status(201).json({ success: true, message: `${type.charAt(0).toUpperCase() + type.slice(1)} item posted`, data: item });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single item
// @route   GET /api/items/single/:id
// @access  Public
const getItemById = async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }
    res.json({ success: true, data: item });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  postItem,
  postLostItem,
  postFoundItem,
  getAllItems,
  getUserItems,
  deleteItem,
  getMatchedItems,
  getItemStats,
  getItemById,
};
