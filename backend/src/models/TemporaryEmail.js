const mongoose = require('mongoose');

const temporaryEmailSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  tempAddress: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    required: true
  },
  usageCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Index for efficient queries
temporaryEmailSchema.index({ userId: 1, expiresAt: 1 });
temporaryEmailSchema.index({ tempAddress: 1 });
temporaryEmailSchema.index({ expiresAt: 1 });

module.exports = mongoose.model('TemporaryEmail', temporaryEmailSchema);

