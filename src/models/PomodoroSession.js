const mongoose = require('mongoose');

const pomodoroSessionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  startTime: {
    type: Date,
    required: true,
    default: Date.now
  },
  endTime: {
    type: Date
  },
  duration: {
    type: Number,  // in minutes
    required: true
  },
  type: {
    type: String,
    enum: ['work', 'shortBreak', 'longBreak'],
    required: true
  },
  completed: {
    type: Boolean,
    default: false
  },
  task: {
    title: String,
    description: String,
    category: String
  },
  interruptions: [{
    timestamp: Date,
    reason: String
  }],
  productivity: {
    type: Number,
    min: 1,
    max: 10,
    validate: {
      validator: function (value) {
        return !this.completed || (value !== null && value !== undefined);
      },
      message: 'Productivity is required when session is marked as completed.'
    }
  },
  notes: String
});

pomodoroSessionSchema.index({ user: 1, startTime: -1 });
pomodoroSessionSchema.index({ user: 1, completed: 1 });

module.exports = mongoose.model('PomodoroSession', pomodoroSessionSchema);
