const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
  const { name, email, password, role } = req.body;

  try {
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Please add all fields' });
    }

    // Check if user exists
    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    // Create user
    const user = await User.create({
      name,
      email,
      password,
      phone: req.body.phone || '',
      role: role || 'user',
    });

    if (user) {
      // Notify via socket.io
      const io = req.app.get('socketio');
      if (io) {
        io.emit('userCreated', {
          _id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          createdAt: user.createdAt,
        });
        io.emit('statsUpdated');
      }

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: {
          _id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          createdAt: user.createdAt,
          token: generateToken(user._id),
        },
      });
    } else {
      res.status(400).json({ success: false, message: 'Invalid user data' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Authenticate a user
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    // Check for user email
    const user = await User.findOne({ email });

    if (user && (await user.matchPassword(password))) {
      res.json({
        success: true,
        message: 'Login successful',
        data: {
          _id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          createdAt: user.createdAt,
          token: generateToken(user._id),
        },
      });
    } else {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get user profile
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json({
      success: true,
      data: {
        _id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update user profile details (Name & Phone)
// @route   PUT /api/auth/me
// @access  Private (Requires authentication token)
const updateProfile = async (req, res) => {
  try {
    // Retrieve the user document by ID (req.user.id is populated by protect middleware)
    const user = await User.findById(req.user.id);

    if (user) {
      // Update name and phone fields if provided, otherwise keep existing values
      user.name = req.body.name || user.name;
      user.phone = req.body.phone !== undefined ? req.body.phone : user.phone;

      // Save user document (triggers User pre-save hook for password hash check)
      const updatedUser = await user.save();

      // Return the updated profile information to the client
      res.json({
        success: true,
        data: {
          _id: updatedUser.id,
          name: updatedUser.name,
          email: updatedUser.email,
          role: updatedUser.role,
          phone: updatedUser.phone,
          createdAt: updatedUser.createdAt,
        },
      });
    } else {
      res.status(404).json({ success: false, message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update user password securely
// @route   PUT /api/auth/password
// @access  Private (Requires authentication token)
const updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Validate that both current and new password fields are provided
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Please enter all required fields' });
    }

    // Retrieve the user document (by default, password field is selected)
    const user = await User.findById(req.user.id);

    // Validate current password using bcrypt matchPassword instance method
    if (user && (await user.matchPassword(currentPassword))) {
      user.password = newPassword; // Hashed automatically by pre-save hook in User model on save()
      await user.save();
      res.json({ success: true, message: 'Password updated successfully' });
    } else {
      res.status(401).json({ success: false, message: 'Invalid current password' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  registerUser,
  loginUser,
  getMe,
  updateProfile,
  updatePassword,
};
