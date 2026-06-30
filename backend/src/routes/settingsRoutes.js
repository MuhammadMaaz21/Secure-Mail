const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const {
  getSettings,
  updateSettings,
  addBlockedSender,
  removeBlockedSender,
  changePassword
} = require('../controllers/settingsController');

// All settings routes require authentication
router.use(authenticate);

// Get user settings
router.get('/', getSettings);

// Update settings
router.put('/', updateSettings);

// Add blocked sender
router.post('/blocked-senders', addBlockedSender);

// Remove blocked sender
router.delete('/blocked-senders', removeBlockedSender);

// Change password
router.post('/change-password', changePassword);

module.exports = router;

