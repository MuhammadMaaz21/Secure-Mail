const UserSettings = require('../models/UserSettings');
const User = require('../models/User');
const bcrypt = require('bcrypt');
const { generateKeyPair, encryptPrivateKey } = require('../utils/encryption');

/**
 * Get user settings
 */
const getSettings = async (req, res) => {
  try {
    const userId = req.userId;
    
    let settings = await UserSettings.findOne({ userId });
    
    // Create default settings if none exist
    if (!settings) {
      settings = new UserSettings({
        userId,
        defaultSelfDestructTimer: 'none',
        blockedSenders: [],
        disableExternalImages: false,
        autoMarkSpam: true,
        autoMarkPhishing: true,
        newEmailNotifications: true,
        importantEmailAlerts: true,
        securityAlerts: true,
        language: 'en',
        timezone: 'UTC'
      });
      await settings.save();
    }
    
    res.json({
      success: true,
      data: settings
    });
    
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({
      success: false,
      error: 'ServerError',
      message: 'Failed to fetch settings',
      details: error.message
    });
  }
};

/**
 * Update user settings
 */
const updateSettings = async (req, res) => {
  try {
    const userId = req.userId;
    const {
      defaultSelfDestructTimer,
      blockedSenders,
      disableExternalImages,
      autoMarkSpam,
      autoMarkPhishing,
      newEmailNotifications,
      importantEmailAlerts,
      securityAlerts,
      language,
      timezone
    } = req.body;
    
    // Validate defaultSelfDestructTimer
    const validTimers = ['none', '1min', '5min', '1hour', '1day'];
    if (defaultSelfDestructTimer && !validTimers.includes(defaultSelfDestructTimer)) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: 'Invalid self-destruct timer value'
      });
    }
    
    // Validate blocked senders (must be array of email strings)
    if (blockedSenders !== undefined) {
      if (!Array.isArray(blockedSenders)) {
        return res.status(400).json({
          success: false,
          error: 'ValidationError',
          message: 'Blocked senders must be an array'
        });
      }
      
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      for (const email of blockedSenders) {
        if (!emailRegex.test(email)) {
          return res.status(400).json({
            success: false,
            error: 'ValidationError',
            message: `Invalid email address in blocked senders: ${email}`
          });
        }
      }
    }
    
    // Find or create settings
    let settings = await UserSettings.findOne({ userId });
    
    if (!settings) {
      settings = new UserSettings({ userId });
    }
    
    // Update fields
    if (defaultSelfDestructTimer !== undefined) {
      settings.defaultSelfDestructTimer = defaultSelfDestructTimer;
    }
    if (blockedSenders !== undefined) {
      // Remove duplicates and normalize
      settings.blockedSenders = [...new Set(blockedSenders.map(e => e.toLowerCase().trim()))];
    }
    if (disableExternalImages !== undefined) {
      settings.disableExternalImages = disableExternalImages;
    }
    if (autoMarkSpam !== undefined) {
      settings.autoMarkSpam = autoMarkSpam;
    }
    if (autoMarkPhishing !== undefined) {
      settings.autoMarkPhishing = autoMarkPhishing;
    }
    if (newEmailNotifications !== undefined) {
      settings.newEmailNotifications = newEmailNotifications;
    }
    if (importantEmailAlerts !== undefined) {
      settings.importantEmailAlerts = importantEmailAlerts;
    }
    if (securityAlerts !== undefined) {
      settings.securityAlerts = securityAlerts;
    }
    if (language !== undefined) {
      const validLanguages = ['en', 'es', 'fr'];
      if (validLanguages.includes(language)) {
        settings.language = language;
      }
    }
    if (timezone !== undefined) {
      settings.timezone = timezone;
    }
    
    await settings.save();
    
    res.json({
      success: true,
      message: 'Settings updated successfully',
      data: settings
    });
    
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({
      success: false,
      error: 'ServerError',
      message: 'Failed to update settings',
      details: error.message
    });
  }
};

/**
 * Add blocked sender
 */
const addBlockedSender = async (req, res) => {
  try {
    const userId = req.userId;
    const { email } = req.body;
    
    if (!email || !email.trim()) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: 'Email address is required'
      });
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: 'Invalid email address'
      });
    }
    
    let settings = await UserSettings.findOne({ userId });
    
    if (!settings) {
      settings = new UserSettings({ userId });
    }
    
    const normalizedEmail = email.toLowerCase().trim();
    
    if (!settings.blockedSenders.includes(normalizedEmail)) {
      settings.blockedSenders.push(normalizedEmail);
      await settings.save();
    }
    
    // Reload settings to ensure we have the latest data
    const updatedSettings = await UserSettings.findOne({ userId });
    
    res.json({
      success: true,
      message: 'Sender blocked successfully',
      data: updatedSettings
    });
    
  } catch (error) {
    console.error('Add blocked sender error:', error);
    res.status(500).json({
      success: false,
      error: 'ServerError',
      message: 'Failed to block sender',
      details: error.message
    });
  }
};

/**
 * Remove blocked sender
 */
const removeBlockedSender = async (req, res) => {
  try {
    const userId = req.userId;
    const { email } = req.query || req.body; // Support both query params and body
    
    if (!email || !email.trim()) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: 'Email address is required'
      });
    }
    
    const settings = await UserSettings.findOne({ userId });
    
    if (!settings) {
      return res.status(404).json({
        success: false,
        error: 'NotFound',
        message: 'Settings not found'
      });
    }
    
    const normalizedEmail = email.toLowerCase().trim();
    settings.blockedSenders = settings.blockedSenders.filter(e => e !== normalizedEmail);
    
    await settings.save();
    
    // Reload settings to ensure we have the latest data
    const updatedSettings = await UserSettings.findOne({ userId });
    
    res.json({
      success: true,
      message: 'Sender unblocked successfully',
      data: updatedSettings
    });
    
  } catch (error) {
    console.error('Remove blocked sender error:', error);
    res.status(500).json({
      success: false,
      error: 'ServerError',
      message: 'Failed to unblock sender',
      details: error.message
    });
  }
};

/**
 * Change user password
 */
const changePassword = async (req, res) => {
  try {
    const userId = req.userId;
    const { currentPassword, newPassword, confirmPassword } = req.body;
    
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: 'Current password, new password, and confirm password are required'
      });
    }
    
    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: 'New password and confirm password do not match'
      });
    }
    
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: 'Password must be at least 8 characters'
      });
    }
    
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: 'Password must contain uppercase, lowercase, and number'
      });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'NotFound',
        message: 'User not found'
      });
    }
    
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'AuthenticationError',
        message: 'Current password is incorrect'
      });
    }
    
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);
    user.passwordHash = passwordHash;
    
    // Automatically regenerate encryption keys with new password if user has keys
    let keysRegenerated = false;
    if (user.publicKey && user.encryptedPrivateKey) {
      try {
        const { publicKey, privateKey } = generateKeyPair();
        const encryptedPrivateKeyData = encryptPrivateKey(privateKey, newPassword);
        user.publicKey = publicKey;
        user.encryptedPrivateKey = encryptedPrivateKeyData.encrypted;
        keysRegenerated = true;
      } catch (error) {
        console.error(`[Change Password] Failed to regenerate encryption keys:`, error);
        // Continue with password change even if key regeneration fails
      }
    }
    
    await user.save();
    
    res.json({
      success: true,
      message: keysRegenerated 
        ? 'Password changed successfully. Your encryption keys have been automatically regenerated with the new password.'
        : 'Password changed successfully',
      data: {
        keysRegenerated
      }
    });
    
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      error: 'ServerError',
      message: 'Failed to change password',
      details: error.message
    });
  }
};

module.exports = {
  getSettings,
  updateSettings,
  addBlockedSender,
  removeBlockedSender,
  changePassword
};

