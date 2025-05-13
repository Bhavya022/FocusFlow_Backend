const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const PomodoroSession = require('../models/PomodoroSession');

// Start a new Pomodoro session
router.post('/start', auth, async (req, res) => {
  try {
    console.log('Received /start request body:', req.body);
    const { duration, type, task } = req.body;

    console.log(`Parsed values -> Duration: ${duration}, Type: ${type}, Task:`, task);
    console.log('Authenticated User ID:', req.user?.userId);

    const session = new PomodoroSession({
      user: req.user.userId,
      duration,
      type,
      task
    });

    await session.save();
    console.log('Session saved successfully:', session);

    res.status(201).json(session);
  } catch (error) {
    console.error('Error starting Pomodoro session:', error);
    res.status(400).json({ message: 'Could not start session', error: error.message });
  }
});

// End a Pomodoro session
router.patch('/:id/end', auth, async (req, res) => {
  try {
    const session = await PomodoroSession.findOne({
      _id: req.params.id,
      user: req.user.userId
    });

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    session.endTime = new Date();
    session.completed = true;
    session.productivity = req.body.productivity;
    session.notes = req.body.notes;

    await session.save();
    res.json(session);
  } catch (error) {
    console.error('Error ending Pomodoro session:', error);
    res.status(400).json({ message: 'Could not end session', error: error.message });
  }
});

// Record an interruption
router.post('/:id/interruption', auth, async (req, res) => {
  console.log(`[${new Date().toISOString()}] POST /${req.params.id}/interruption - Attempting to record interruption.`);
  console.log(`[${new Date().toISOString()}] User ID: ${req.user.userId}`);
  console.log(`[${new Date().toISOString()}] Session ID from params: ${req.params.id}`);
  console.log(`[${new Date().toISOString()}] Request Body: ${JSON.stringify(req.body)}`);

  try {
    const session = await PomodoroSession.findOne({
      _id: req.params.id,
      user: req.user.userId
    });

    if (!session) {
      console.log(`[${new Date().toISOString()}] Session not found for ID: ${req.params.id} and User ID: ${req.user.userId}`);
      return res.status(404).json({ message: 'Session not found' });
    }

    console.log(`[${new Date().toISOString()}] Session found. Current interruptions count: ${session.interruptions.length}`);

    session.interruptions.push({
      timestamp: new Date(),
      reason: req.body.reason
    });

    console.log(`[${new Date().toISOString()}] Interruption added to session. New interruptions count: ${session.interruptions.length}`);
    console.log(`[${new Date().toISOString()}] Interruption details: Timestamp: ${new Date()}, Reason: ${req.body.reason}`);

    await session.save();
    console.log(`[${new Date().toISOString()}] Session saved successfully with new interruption.`);
    res.json(session);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error recording interruption: ${error.message}`);
    console.error(`[${new Date().toISOString()}] Full error stack:`, error.stack);
    res.status(400).json({ message: 'Could not record interruption', error: error.message });
  }
});

// Get user's sessions (with pagination and filters)
router.get('/', auth, async (req, res) => {
  try {
    const match = { user: req.user._id };
    const sort = {};

    // Apply filters
    if (req.query.completed) {
      match.completed = req.query.completed === 'true';
    }
    if (req.query.type) {
      match.type = req.query.type;
    }

    // Apply date range filter
    if (req.query.startDate || req.query.endDate) {
      match.startTime = {};
      if (req.query.startDate) {
        match.startTime.$gte = new Date(req.query.startDate);
      }
      if (req.query.endDate) {
        match.startTime.$lte = new Date(req.query.endDate);
      }
    }

    // Apply sorting
    if (req.query.sortBy) {
      const parts = req.query.sortBy.split(':');
      sort[parts[0]] = parts[1] === 'desc' ? -1 : 1;
    } else {
      sort.startTime = -1;
    }

    const limit = parseInt(req.query.limit) || 10;
    const skip = parseInt(req.query.skip) || 0;

    const sessions = await PomodoroSession.find(match)
      .sort(sort)
      .limit(limit)
      .skip(skip);

    const total = await PomodoroSession.countDocuments(match);

    res.json({
      sessions,
      total,
      hasMore: total > skip + limit
    });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ message: 'Could not fetch sessions', error: error.message });
  }
});

// Get session statistics
router.get('/stats', auth, async (req, res) => {
  try {
    const startDate = req.query.startDate ? new Date(req.query.startDate) : new Date(0);
    const endDate = req.query.endDate ? new Date(req.query.endDate) : new Date();

    const stats = await PomodoroSession.aggregate([
      {
        $match: {
          user: req.user._id,
          startTime: { $gte: startDate, $lte: endDate },
          completed: true
        }
      },
      {
        $group: {
          _id: null,
          totalSessions: { $sum: 1 },
          totalMinutes: { $sum: '$duration' },
          avgProductivity: { $avg: '$productivity' },
          totalInterruptions: { $sum: { $size: '$interruptions' } }
        }
      }
    ]);

    res.json(stats[0] || {
      totalSessions: 0,
      totalMinutes: 0,
      avgProductivity: 0,
      totalInterruptions: 0
    });
  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({ message: 'Could not fetch statistics', error: error.message });
  }
});

module.exports = router;
