const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const PomodoroSession = require('../models/PomodoroSession');

// Get daily productivity trends
router.get('/daily', auth, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    console.log(`[Daily] Fetching data for user: ${req.user.userId}, from ${startDate.toISOString()} to ${endDate.toISOString()}`);

    const dailyStats = await PomodoroSession.aggregate([
      {
        $match: {
          user: req.user.userId,
          startTime: { $gte: startDate, $lte: endDate },
          completed: true
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$startTime' } },
          totalSessions: { $sum: 1 },
          totalMinutes: { $sum: '$duration' },
          avgProductivity: { $avg: '$productivity' },
          interruptions: { $sum: { $size: '$interruptions' } }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    console.log('[Daily] Aggregated Result:', dailyStats);
    res.json(dailyStats);
  } catch (error) {
    console.error('[Daily] Error:', error);
    res.status(500).json({ message: 'Could not fetch daily analytics' });
  }
});

// Get productivity patterns by time of day
router.get('/patterns', auth, async (req, res) => {
  try {
    console.log(`[Patterns] Fetching productivity pattern for user: ${req.user.userId}`);

    const patterns = await PomodoroSession.aggregate([
      {
        $match: {
          user: req.user.userId,
          completed: true
        }
      },
      {
        $project: {
          hour: { $hour: '$startTime' },
          productivity: 1,
          duration: 1
        }
      },
      {
        $group: {
          _id: '$hour',
          avgProductivity: { $avg: '$productivity' },
          totalSessions: { $sum: 1 },
          totalMinutes: { $sum: '$duration' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    console.log('[Patterns] Aggregated Result:', patterns);
    res.json(patterns);
  } catch (error) {
    console.error('[Patterns] Error:', error);
    res.status(500).json({ message: 'Could not fetch productivity patterns' });
  }
});

// Get task category analysis
router.get('/categories', auth, async (req, res) => {
  try {
    console.log(`[Categories] Fetching task category analysis for user: ${req.user.userId}`);

    const categoryStats = await PomodoroSession.aggregate([
      {
        $match: {
          user: req.user.userId,
          completed: true,
          'task.category': { $exists: true }
        }
      },
      {
        $group: {
          _id: '$task.category',
          totalSessions: { $sum: 1 },
          totalMinutes: { $sum: '$duration' },
          avgProductivity: { $avg: '$productivity' },
          interruptions: { $sum: { $size: '$interruptions' } }
        }
      },
      { $sort: { totalMinutes: -1 } }
    ]);

    console.log('[Categories] Aggregated Result:', categoryStats);
    res.json(categoryStats);
  } catch (error) {
    console.error('[Categories] Error:', error);
    res.status(500).json({ message: 'Could not fetch category analytics' });
  }
});

// Get productivity insights and recommendations
router.get('/insights', auth, async (req, res) => {
  try {
    console.log(`[Insights] Generating insights for user: ${req.user.userId}`);

    // Most productive time
    const productiveHours = await PomodoroSession.aggregate([
      {
        $match: {
          user: req.user.userId,
          completed: true,
          productivity: { $exists: true }
        }
      },
      {
        $project: {
          hour: { $hour: '$startTime' },
          productivity: 1
        }
      },
      {
        $group: {
          _id: '$hour',
          avgProductivity: { $avg: '$productivity' },
          sessionCount: { $sum: 1 }
        }
      },
      { $sort: { avgProductivity: -1 } },
      { $limit: 3 }
    ]);

    console.log('[Insights] Top Productive Hours:', productiveHours);

    // Common interruptions
    const interruptions = await PomodoroSession.aggregate([
      {
        $match: {
          user: req.user.userId,
          'interruptions.0': { $exists: true }
        }
      },
      { $unwind: '$interruptions' },
      {
        $group: {
          _id: '$interruptions.reason',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    console.log('[Insights] Top Interruptions:', interruptions);

    const insights = {
      productiveHours,
      interruptions,
      recommendations: [
        {
          type: 'optimal_time',
          message: `Your most productive hours are ${productiveHours.map(h => `${h._id}:00`).join(', ')}. Try scheduling important tasks during these times.`
        },
        {
          type: 'interruption_management',
          message: interruptions.length > 0
            ? `Common interruptions: ${interruptions.map(i => i._id).join(', ')}. Consider addressing these distractions.`
            : 'No significant interruption patterns detected.'
        }
      ]
    };

    res.json(insights);
  } catch (error) {
    console.error('[Insights] Error:', error);
    res.status(500).json({ message: 'Could not generate insights' });
  }
});

module.exports = router;
