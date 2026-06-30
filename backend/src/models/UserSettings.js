const mongoose = require('mongoose');

const userSettingsSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  
  // Privacy settings
  defaultSelfDestructTimer: {
    type: String,
    enum: ['none', '1min', '5min', '1hour', '1day'],
    default: 'none'
  },
  
  // Blocked senders
  blockedSenders: [{
    type: String,
    lowercase: true,
    trim: true
  }],
  
  // Email display settings
  disableExternalImages: {
    type: Boolean,
    default: false
  },
  
  // Security settings
  autoMarkSpam: {
    type: Boolean,
    default: true
  },
  
  autoMarkPhishing: {
    type: Boolean,
    default: true
  },
  
  // Notification settings
  newEmailNotifications: {
    type: Boolean,
    default: true
  },
  
  importantEmailAlerts: {
    type: Boolean,
    default: true
  },
  
  securityAlerts: {
    type: Boolean,
    default: true
  },
  
  // Account preferences
  language: {
    type: String,
    enum: ['en', 'es', 'fr'],
    default: 'en'
  },
  
  timezone: {
    type: String,
    default: 'UTC'
  },
  
  // Vault PIN
  vaultPinHash: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// Index for efficient queries
userSettingsSchema.index({ userId: 1 });

module.exports = mongoose.model('UserSettings', userSettingsSchema);

