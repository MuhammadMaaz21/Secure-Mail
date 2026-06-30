const Email = require('../models/Email');
const UserSettings = require('../models/UserSettings');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

// Store verified PIN tokens (in production, use Redis or similar)
const verifiedTokens = new Map();

// Generate a verification token
const generateToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Set vault PIN
 */
const setVaultPin = async (req, res) => {
  try {
    const userId = req.userId;
    const { pin } = req.body;

    // Validate PIN
    if (!pin || !/^\d{4}$/.test(pin)) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: 'PIN must be exactly 4 digits'
      });
    }

    // Hash the PIN
    const saltRounds = 10;
    const vaultPinHash = await bcrypt.hash(pin, saltRounds);

    // Update or create user settings
    let settings = await UserSettings.findOne({ userId });
    if (!settings) {
      settings = new UserSettings({ userId });
    }
    settings.vaultPinHash = vaultPinHash;
    await settings.save();

    res.json({
      success: true,
      message: 'Vault PIN set successfully'
    });

  } catch (error) {
    console.error('Set vault PIN error:', error);
    res.status(500).json({
      success: false,
      error: 'ServerError',
      message: 'Failed to set vault PIN',
      details: error.message
    });
  }
};

/**
 * Verify vault PIN and return token
 */
const verifyVaultPin = async (req, res) => {
  try {
    const userId = req.userId;
    const { pin } = req.body;

    // Validate PIN
    if (!pin || !/^\d{4}$/.test(pin)) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: 'PIN must be exactly 4 digits'
      });
    }

    // Get user settings
    const settings = await UserSettings.findOne({ userId });
    if (!settings || !settings.vaultPinHash) {
      return res.status(404).json({
        success: false,
        error: 'NotFound',
        message: 'Vault PIN not set. Please set a PIN first.'
      });
    }

    // Verify PIN
    const isValid = await bcrypt.compare(pin, settings.vaultPinHash);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Invalid PIN'
      });
    }

    // Generate and store verification token (valid for 1 hour)
    const token = generateToken();
    verifiedTokens.set(`${userId}:${token}`, {
      userId,
      expiresAt: Date.now() + (60 * 60 * 1000) // 1 hour
    });

    res.json({
      success: true,
      message: 'PIN verified successfully',
      data: {
        token
      }
    });

  } catch (error) {
    console.error('Verify vault PIN error:', error);
    res.status(500).json({
      success: false,
      error: 'ServerError',
      message: 'Failed to verify vault PIN',
      details: error.message
    });
  }
};

/**
 * Check if token is valid and cleanup expired tokens
 */
const isTokenValid = (userId, token) => {
  const key = `${userId}:${token}`;
  const tokenData = verifiedTokens.get(key);
  
  if (!tokenData) {
    // Cleanup expired tokens while checking
    cleanupExpiredTokens();
    return false;
  }

  // Check if token expired
  if (Date.now() > tokenData.expiresAt) {
    verifiedTokens.delete(key);
    cleanupExpiredTokens();
    return false;
  }

  return true;
};

/**
 * Cleanup expired tokens
 */
const cleanupExpiredTokens = () => {
  const now = Date.now();
  for (const [key, tokenData] of verifiedTokens.entries()) {
    if (now > tokenData.expiresAt) {
      verifiedTokens.delete(key);
    }
  }
};

/**
 * Invalidate/revoke vault token (lock vault)
 */
const invalidateToken = async (req, res) => {
  try {
    const userId = req.userId;
    const { token } = req.body;

    let invalidatedCount = 0;

    // If token is provided, invalidate that specific token
    if (token && token !== null && token !== undefined) {
      const key = `${userId}:${token}`;
      if (verifiedTokens.has(key)) {
        verifiedTokens.delete(key);
        invalidatedCount = 1;
      }
    }
    
    // Always invalidate ALL tokens for this user to ensure complete lock
    // This handles cases where user might have multiple valid tokens
    for (const [key, tokenData] of verifiedTokens.entries()) {
      if (tokenData.userId && tokenData.userId.toString() === userId.toString()) {
        verifiedTokens.delete(key);
        invalidatedCount++;
      }
    }

    res.json({
      success: true,
      message: 'Vault locked successfully',
      data: {
        invalidatedCount
      }
    });

  } catch (error) {
    console.error('Invalidate token error:', error);
    res.status(500).json({
      success: false,
      error: 'ServerError',
      message: 'Failed to lock vault',
      details: error.message
    });
  }
};

/**
 * Get vault emails
 */
const getVaultEmails = async (req, res) => {
  try {
    const userId = req.userId;
    const userEmail = req.user.email;
    // Support both header (preferred) and query param (for backward compatibility)
    const token = req.headers['x-vault-token'] || req.query.token;

    // Verify token
    if (!token || !isTokenValid(userId, token)) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Invalid or expired PIN token. Please verify PIN again.'
      });
    }

    // Get vault emails
    const query = {
      $or: [
        { senderId: userId },
        { to: userEmail.toLowerCase() },
        { cc: userEmail.toLowerCase() },
        { bcc: userEmail.toLowerCase() }
      ],
      isVault: true,
      deletedAt: null
    };

    const emails = await Email.find(query)
      .sort({ createdAt: -1 })
      .select('-__v');

    res.json({
      success: true,
      data: {
        emails,
        count: emails.length
      }
    });

  } catch (error) {
    console.error('Get vault emails error:', error);
    res.status(500).json({
      success: false,
      error: 'ServerError',
      message: 'Failed to fetch vault emails',
      details: error.message
    });
  }
};

/**
 * Move email to vault
 */
const moveToVault = async (req, res) => {
  try {
    const { emailId } = req.params;
    const userId = req.userId;
    const userEmail = req.user.email;

    const email = await Email.findById(emailId);

    if (!email) {
      return res.status(404).json({
        success: false,
        error: 'NotFound',
        message: 'Email not found'
      });
    }

    // Check if user has access to this email
    const isSender = email.senderId.toString() === userId.toString();
    const isRecipient = email.to.includes(userEmail.toLowerCase()) ||
                       email.cc.includes(userEmail.toLowerCase()) ||
                       email.bcc.includes(userEmail.toLowerCase());

    if (!isSender && !isRecipient) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'You do not have access to this email'
      });
    }

    // Move to vault
    email.isVault = true;
    await email.save();

    res.json({
      success: true,
      message: 'Email moved to vault successfully',
      data: {
        id: email._id,
        isVault: email.isVault
      }
    });

  } catch (error) {
    console.error('Move to vault error:', error);
    res.status(500).json({
      success: false,
      error: 'ServerError',
      message: 'Failed to move email to vault',
      details: error.message
    });
  }
};

/**
 * Remove email from vault
 */
const removeFromVault = async (req, res) => {
  try {
    const { emailId } = req.params;
    const userId = req.userId;
    const { token } = req.body;

    // Verify token
    if (!token || !isTokenValid(userId, token)) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Invalid or expired PIN token. Please verify PIN again.'
      });
    }

    const email = await Email.findById(emailId);

    if (!email) {
      return res.status(404).json({
        success: false,
        error: 'NotFound',
        message: 'Email not found'
      });
    }

    // Check if user has access
    const isSender = email.senderId.toString() === userId.toString();
    if (!isSender && !email.to.includes(req.user.email.toLowerCase())) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'You do not have access to this email'
      });
    }

    // Remove from vault
    email.isVault = false;
    await email.save();

    res.json({
      success: true,
      message: 'Email removed from vault successfully'
    });

  } catch (error) {
    console.error('Remove from vault error:', error);
    res.status(500).json({
      success: false,
      error: 'ServerError',
      message: 'Failed to remove email from vault',
      details: error.message
    });
  }
};

// Cleanup expired tokens periodically (every minute for better memory management)
setInterval(() => {
  cleanupExpiredTokens();
}, 60 * 1000); // Run every 1 minute

module.exports = {
  setVaultPin,
  verifyVaultPin,
  getVaultEmails,
  moveToVault,
  removeFromVault,
  invalidateToken,
  isTokenValid
};

