const mongoose = require('mongoose');

// Subdocument schema for encrypted attachments
const encryptedAttachmentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  size: { type: Number, required: true },
  type: { type: String, required: true },
  encrypted: { type: String, required: true } // Encrypted base64 data
}, { _id: false });

const emailSchema = new mongoose.Schema({
  // Sender information
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  senderEmail: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  senderName: {
    type: String,
    default: ''
  },
  
  // Recipients
  to: [{
    type: String,
    required: function() {
      // For drafts, to can be empty
      return this.folder !== 'draft';
    },
    lowercase: true,
    trim: true,
    validate: {
      validator: function(v) {
        // For drafts, allow empty strings; for other folders, require non-empty
        if (this.folder === 'draft') {
          return true; // Allow empty for drafts
        }
        return v && v.trim().length > 0;
      },
      message: 'Email address is required for non-draft emails'
    }
  }],
  cc: [{
    type: String,
    default: [],
    lowercase: true,
    trim: true
  }],
  bcc: [{
    type: String,
    default: [],
    lowercase: true,
    trim: true
  }],
  
  // Email content
  subject: {
    type: String,
    required: function() {
      // For drafts, subject can be empty
      return this.folder !== 'draft';
    },
    trim: true,
    default: function() {
      // Default to empty string for drafts
      return this.folder === 'draft' ? '' : undefined;
    }
  },
  body: {
    type: String,
    required: function() {
      // For drafts, body can be empty
      return this.folder !== 'draft';
    },
    default: function() {
      // Default to empty string for drafts
      return this.folder === 'draft' ? '' : undefined;
    }
  },
  
  // Attachments metadata
  attachments: [{
    name: {
      type: String,
      required: true
    },
    size: {
      type: Number,
      required: true
    },
    type: {
      type: String,
      required: true
    },
    path: {
      type: String,
      default: null // Path to stored file
    }
  }],
  
  // Email metadata
  folder: {
    type: String,
    enum: ['inbox', 'sent', 'draft', 'trash', 'spam'],
    required: true
  },
  status: {
    type: String,
    enum: ['sent', 'draft'],
    default: 'draft'
  },
  
  // Security features
  selfDestructTimer: {
    type: String,
    enum: ['none', '1min', '5min', '1hour', '1day'],
    default: 'none'
  },
  selfDestructAt: {
    type: Date,
    default: null
  },
  
  // Status flags
  isRead: {
    type: Boolean,
    default: false
  },
  isImportant: {
    type: Boolean,
    default: false
  },
  isSpam: {
    type: Boolean,
    default: false
  },
  isPhishing: {
    type: Boolean,
    default: false
  },
  
  // Classification for automatic folder organization
  classification: {
    type: String,
    enum: ['inbox', 'spam', 'phishing', 'important'],
    default: 'inbox'
  },
  
  // AI analysis
  aiAnalysis: {
    threatLevel: {
      type: String,
      enum: ['safe', 'suspicious', 'spam', 'phishing'],
      default: 'safe'
    },
    confidence: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    details: {
      type: String,
      default: ''
    },
    spamProbability: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    phishingProbability: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    riskScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    reasons: {
      type: [String],
      default: []
    },
    links: {
      type: [{
        url: String,
        domain: String,
        risk: String,
        reason: String,
      }],
      default: []
    },
    attachmentScan: {
      type: [{
        name: String,
        risk: String,
        reason: String,
      }],
      default: []
    },
    isImportant: {
      type: Boolean,
      default: false
    },
    source: {
      type: String,
      default: 'ai-model'
    },
    tone: {
      type: String,
      enum: ['professional', 'urgent', 'friendly', 'aggressive', 'suspicious'],
      default: 'professional'
    }
  },
  
  // Delivery status (for sent emails)
  deliveryStatus: {
    type: String,
    enum: ['pending', 'delivered', 'failed'],
    default: null
  },
  deliveryError: {
    type: String,
    default: null
  },
  deliveredAt: {
    type: Date,
    default: null
  },
  
  // Soft delete
  deletedAt: {
    type: Date,
    default: null
  },
  
  // Vault flag
  isVault: {
    type: Boolean,
    default: false
  },
  
  // Disposable email flag
  isDisposable: {
    type: Boolean,
    default: false
  },
  
  disposableAddress: {
    type: String,
    default: null
  },
  
  // E2E Encryption
  isEncrypted: {
    type: Boolean,
    default: false
  },
  encryptedBody: {
    type: String,
    default: null
  },
  encryptedAttachments: {
    type: [encryptedAttachmentSchema],
    default: []
  },
  
  // Blockchain metadata (stored at send time for verification)
  blockMetadata: {
    senderId: String,
    recipientIds: [String],
    subject: String,
    bodyHash: String,
    timestamp: String
  }
}, {
  timestamps: true
});

// Index for efficient queries
emailSchema.index({ senderId: 1, folder: 1, createdAt: -1 });
emailSchema.index({ senderId: 1, folder: 1, status: 1, createdAt: -1 });
emailSchema.index({ senderId: 1, status: 1, deletedAt: 1 });
emailSchema.index({ 'to': 1, folder: 1, createdAt: -1 });
emailSchema.index({ 'to': 1, folder: 1, deletedAt: 1 });
emailSchema.index({ 'to': 1, folder: 1, 'aiAnalysis.spamProbability': 1 });
emailSchema.index({ 'classification': 1, folder: 1 });
emailSchema.index({ selfDestructAt: 1 });
emailSchema.index({ deletedAt: 1 });
emailSchema.index({ isVault: 1, deletedAt: 1 });
emailSchema.index({ updatedAt: -1 });

// Method to calculate self-destruct time
emailSchema.methods.calculateSelfDestructTime = function() {
  if (this.selfDestructTimer === 'none') {
    return null;
  }
  
  const now = new Date();
  let destructTime = new Date();
  
  switch (this.selfDestructTimer) {
    case '1min':
      destructTime.setMinutes(now.getMinutes() + 1);
      break;
    case '5min':
      destructTime.setMinutes(now.getMinutes() + 5);
      break;
    case '1hour':
      destructTime.setHours(now.getHours() + 1);
      break;
    case '1day':
      destructTime.setDate(now.getDate() + 1);
      break;
    default:
      return null;
  }
  
  return destructTime;
};

module.exports = mongoose.model('Email', emailSchema);

