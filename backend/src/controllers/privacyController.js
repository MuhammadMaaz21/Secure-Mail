const TemporaryEmail = require('../models/TemporaryEmail');
const User = require('../models/User');
const crypto = require('crypto');

// Generate a random disposable email address
const generateTempAddress = (baseDomain = 'temp.securemail.com') => {
  const randomString = crypto.randomBytes(8).toString('hex');
  return `${randomString}@${baseDomain}`;
};

/**
 * Create a temporary email address
 */
const createTempEmail = async (req, res) => {
  try {
    const userId = req.userId;
    const { expiresInHours = 24 } = req.body; // Default 24 hours

    // Validate expiresInHours
    if (expiresInHours < 1 || expiresInHours > 720) { // Max 30 days
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: 'Expiration time must be between 1 and 720 hours (30 days)'
      });
    }

    // Generate unique temp address
    let tempAddress;
    let attempts = 0;
    do {
      tempAddress = generateTempAddress();
      const exists = await TemporaryEmail.findOne({ tempAddress });
      if (!exists) break;
      attempts++;
      if (attempts > 10) {
        throw new Error('Failed to generate unique temporary email address');
      }
    } while (true);

    // Calculate expiration time
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + parseInt(expiresInHours));

    // Create temporary email
    const tempEmail = new TemporaryEmail({
      userId,
      tempAddress,
      expiresAt,
      usageCount: 0
    });

    await tempEmail.save();

    res.json({
      success: true,
      message: 'Temporary email address created successfully',
      data: {
        id: tempEmail._id,
        tempAddress: tempEmail.tempAddress,
        expiresAt: tempEmail.expiresAt,
        createdAt: tempEmail.createdAt
      }
    });

  } catch (error) {
    console.error('Create temp email error:', error);
    res.status(500).json({
      success: false,
      error: 'ServerError',
      message: 'Failed to create temporary email address',
      details: error.message
    });
  }
};

/**
 * Get all temporary email addresses for user
 */
const getTempEmails = async (req, res) => {
  try {
    const userId = req.userId;

    const tempEmails = await TemporaryEmail.find({
      userId,
      expiresAt: { $gt: new Date() } // Only active (not expired)
    })
      .sort({ createdAt: -1 })
      .select('-__v');

    res.json({
      success: true,
      data: {
        emails: tempEmails,
        count: tempEmails.length
      }
    });

  } catch (error) {
    console.error('Get temp emails error:', error);
    res.status(500).json({
      success: false,
      error: 'ServerError',
      message: 'Failed to fetch temporary email addresses',
      details: error.message
    });
  }
};

/**
 * Delete temporary email address
 */
const deleteTempEmail = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const tempEmail = await TemporaryEmail.findOne({ _id: id, userId });

    if (!tempEmail) {
      return res.status(404).json({
        success: false,
        error: 'NotFound',
        message: 'Temporary email address not found'
      });
    }

    await TemporaryEmail.deleteOne({ _id: id });

    res.json({
      success: true,
      message: 'Temporary email address deleted successfully'
    });

  } catch (error) {
    console.error('Delete temp email error:', error);
    res.status(500).json({
      success: false,
      error: 'ServerError',
      message: 'Failed to delete temporary email address',
      details: error.message
    });
  }
};

/**
 * Check if an email address is a temporary address
 */
const isTemporaryEmail = async (emailAddress) => {
  const tempEmail = await TemporaryEmail.findOne({
    tempAddress: emailAddress.toLowerCase(),
    expiresAt: { $gt: new Date() }
  });
  return tempEmail;
};

/**
 * Increment usage count for temporary email
 */
const incrementTempEmailUsage = async (emailAddress) => {
  try {
    const tempEmail = await TemporaryEmail.findOne({
      tempAddress: emailAddress.toLowerCase()
    });
    if (tempEmail) {
      tempEmail.usageCount += 1;
      await tempEmail.save();
    }
  } catch (error) {
    console.error('Error incrementing temp email usage:', error);
  }
};

module.exports = {
  createTempEmail,
  getTempEmails,
  deleteTempEmail,
  isTemporaryEmail,
  incrementTempEmailUsage
};

