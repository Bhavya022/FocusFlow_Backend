const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const auth = require('../middleware/auth');

// Register user
router.post(
  '/register',
  [
    body('username').trim().isLength({ min: 3 }).withMessage('Username must be at least 3 characters long'),
    body('email').isEmail().normalizeEmail().withMessage('Invalid email format'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.log('Validation Errors:', errors.array());
        return res.status(400).json({ errors: errors.array() });
      }

      const { username, email, password } = req.body;
      console.log('Register API payload:', req.body);

      // Check if user already exists
      const existingUser = await User.findOne({
        $or: [{ email }, { username }]
      });

      if (existingUser) {
        return res.status(400).json({ message: 'User with this email or username already exists' });
      }

      // Create and save new user
      const user = new User({ username, email, password });
      await user.save();

      // Generate JWT token
      const token = jwt.sign(
        { userId: user._id },
        process.env.JWT_SECRET || 'misogiai', // fallback for local dev
        { expiresIn: process.env.JWT_EXPIRE || '1d' }
      );

      res.status(201).json({
        token,
        user: {
          id: user._id,
          username: user.username,
          email: user.email
        }
      });
    } catch (error) {
      console.error('Register API Error:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// Login user
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Please enter a valid email').normalizeEmail(),
    body('password').exists().withMessage('Password is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.log('Validation Errors:', errors.array());
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password } = req.body;
      console.log('Login API Payload:', { email });

      // Find user by email
      const user = await User.findOne({ email });
      if (!user) {
        console.log('User not found for email:', email);
        return res.status(400).json({ message: 'Invalid credentials' });
      }

      // Compare password
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        console.log('Password mismatch for email:', email);
        return res.status(400).json({ message: 'Invalid credentials' });
      }

      // Generate JWT token
      const token = jwt.sign(
        { userId: user._id },
        process.env.JWT_SECRET || 'misogiai',
        { expiresIn: process.env.JWT_EXPIRE || '1d' }
      );

      res.status(200).json({
        token,
        user: {
          id: user._id,
          username: user.username,
          email: user.email
        }
      });
    } catch (error) {
      console.error('Login API Error:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);


// Get current user
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user preferences
router.patch('/preferences', auth, async (req, res) => {
  console.log(`[${new Date().toISOString()}] PATCH /preferences - Attempting to update user preferences.`);
  console.log(`[${new Date().toISOString()}] User ID: ${req.user._id}`);
  console.log(`[${new Date().toISOString()}] Request Body for preferences: ${JSON.stringify(req.body)}`);

  const allowedUpdates = ['pomodoroLength', 'shortBreakLength', 'longBreakLength', 'dailyGoal'];
  const updateKeys = Object.keys(req.body);
  const isValidOperation = updateKeys.every(key => allowedUpdates.includes(key));

  console.log(`[${new Date().toISOString()}] Incoming update keys: ${updateKeys.join(', ')}`);
  console.log(`[${new Date().toISOString()}] Allowed update keys: ${allowedUpdates.join(', ')}`);
  console.log(`[${new Date().toISOString()}] Is valid update operation? ${isValidOperation}`);

  if (!isValidOperation) {
    return res.status(400).json({ message: 'Invalid updates in preferences' });
  }

  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Initialize preferences object if undefined
    if (!user.preferences) {
      user.preferences = {};
    }

    console.log(`[${new Date().toISOString()}] Applying updates to user preferences.`);
    updateKeys.forEach(key => {
      user.preferences[key] = req.body[key];
    });

    await user.save();
    res.json({ preferences: user.preferences });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error updating preferences: ${error.message}`);
    console.error(`[${new Date().toISOString()}] Full error stack:`, error);
    res.status(400).json({ message: 'Failed to update preferences' });
  }
});


module.exports = router; 