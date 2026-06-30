const Email = require('../models/Email');
const TemporaryEmail = require('../models/TemporaryEmail');

/**
 * Cleanup job to delete expired self-destruct emails
 * This should be run periodically (e.g., every minute via cron)
 */
const cleanupExpiredEmails = async () => {
  try {
    const now = new Date();
    
    // Only delete emails that have a selfDestructAt timestamp AND it has passed
    // This ensures we don't delete emails without self-destruct timers
    const result = await Email.deleteMany({
      selfDestructAt: { 
        $exists: true,
        $ne: null,
        $lte: now 
      }
    });
    
    if (result.deletedCount > 0) {
      console.log(`[Email Cleanup] Deleted ${result.deletedCount} expired email(s) at ${now.toISOString()}`);
    }
    
    return {
      deleted: result.deletedCount,
      message: `Deleted ${result.deletedCount} expired email(s)`
    };
    
  } catch (error) {
    console.error('[Email Cleanup] Error:', error);
    throw error;
  }
};

/**
 * Check if an email has expired
 */
const isEmailExpired = (email) => {
  if (!email.selfDestructAt) {
    return false;
  }
  return new Date() >= new Date(email.selfDestructAt);
};

/**
 * Cleanup job to permanently delete emails that have been in trash for more than 30 days
 * This should be run periodically (e.g., daily via cron)
 */
const cleanupTrashEmails = async () => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
    
    // Permanently delete emails that have been soft-deleted for more than 30 days
    const result = await Email.deleteMany({
      deletedAt: { 
        $exists: true,
        $ne: null,
        $lte: thirtyDaysAgo
      }
    });
    
    if (result.deletedCount > 0) {
      console.log(`[Trash Cleanup] Permanently deleted ${result.deletedCount} email(s) from trash at ${now.toISOString()}`);
    }
    
    return {
      deleted: result.deletedCount,
      message: `Permanently deleted ${result.deletedCount} email(s) from trash`
    };
    
  } catch (error) {
    console.error('[Trash Cleanup] Error:', error);
    throw error;
  }
};

/**
 * Cleanup job to delete expired temporary email addresses
 * This should be run periodically (e.g., hourly via cron)
 */
const cleanupExpiredTempEmails = async () => {
  try {
    const now = new Date();
    
    // Delete expired temporary email addresses
    const result = await TemporaryEmail.deleteMany({
      expiresAt: { 
        $exists: true,
        $lte: now
      }
    });
    
    if (result.deletedCount > 0) {
      console.log(`[Temp Email Cleanup] Deleted ${result.deletedCount} expired temporary email address(es) at ${now.toISOString()}`);
    }
    
    return {
      deleted: result.deletedCount,
      message: `Deleted ${result.deletedCount} expired temporary email address(es)`
    };
    
  } catch (error) {
    console.error('[Temp Email Cleanup] Error:', error);
    throw error;
  }
};

module.exports = {
  cleanupExpiredEmails,
  isEmailExpired,
  cleanupTrashEmails,
  cleanupExpiredTempEmails
};

