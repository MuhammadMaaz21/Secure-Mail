const User = require('../models/User');
const Email = require('../models/Email');
const { decryptPrivateKey, decryptEmailContent, generateKeyPair, encryptPrivateKey } = require('../utils/encryption');

/**
 * Generate encryption keys for user (if they don't have them)
 */
const generateKeys = async (req, res) => {
  try {
    const userId = req.userId;
    const { password } = req.body; // User's password to encrypt private key

    if (!password) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: 'Password is required to generate encryption keys'
      });
    }

    // Get user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'NotFound',
        message: 'User not found'
      });
    }

    // Check if user already has keys - allow regeneration if regenerate flag is set
    const { regenerate } = req.body;
    const hasExistingKeys = user.publicKey && user.encryptedPrivateKey;
    
    if (hasExistingKeys && !regenerate) {
      // If keys exist and regenerate flag is not set, allow regeneration anyway
      // This handles cases where frontend might not detect existing keys properly
      // Continue with regeneration instead of returning error
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'AuthenticationError',
        message: 'Invalid password'
      });
    }

    // Generate encryption key pair
    const { publicKey, privateKey } = generateKeyPair();
    const encryptedPrivateKeyData = encryptPrivateKey(privateKey, password);

    // Save keys to user
    user.publicKey = publicKey;
    user.encryptedPrivateKey = encryptedPrivateKeyData.encrypted;
    await user.save();

    res.json({
      success: true,
      message: (hasExistingKeys || regenerate)
        ? 'Encryption keys regenerated successfully' 
        : 'Encryption keys generated successfully',
      data: {
        publicKey: publicKey.substring(0, 100) + '...' // Return partial key for verification
      }
    });

  } catch (error) {
    console.error('Generate keys error:', error);
    res.status(500).json({
      success: false,
      error: 'ServerError',
      message: 'Failed to generate encryption keys',
      details: error.message
    });
  }
};

/**
 * Get user's public key (for verification)
 */
const getPublicKey = async (req, res) => {
  try {
    const userId = req.userId;

    const user = await User.findById(userId).select('publicKey email');
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'NotFound',
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        hasPublicKey: !!user.publicKey,
        publicKey: user.publicKey ? user.publicKey.substring(0, 100) + '...' : null,
        email: user.email
      }
    });

  } catch (error) {
    console.error('Get public key error:', error);
    res.status(500).json({
      success: false,
      error: 'ServerError',
      message: 'Failed to get public key',
      details: error.message
    });
  }
};

/**
 * Decrypt email content using user's private key
 * Requires user's password to decrypt the private key
 */
const decryptEmail = async (req, res) => {
  try {
    const { id } = req.params; // Route parameter is :id, not :emailId
    const { password } = req.body; // User's password to decrypt their private key
    const userId = req.userId;

    if (!password) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: 'Password is required to decrypt email'
      });
    }

    if (!id) {
      console.error(`[Decrypt] Missing email ID in request`);
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: 'Email ID is required'
      });
    }

    // Get email - try both with and without deleted emails
    let email = await Email.findById(id);
    
    // If not found, check if it's in trash (deletedAt set)
    if (!email) {
      email = await Email.findOne({ _id: id, deletedAt: { $ne: null } });
      if (email) {
        return res.status(404).json({
          success: false,
          error: 'NotFound',
          message: 'Email not found or has been deleted'
        });
      }
    }

    if (!email) {
      console.error(`[Decrypt] Email not found in database: ${id}, userId: ${userId}`);
      return res.status(404).json({
        success: false,
        error: 'NotFound',
        message: 'Email not found'
      });
    }

    // Check if email is encrypted
    if (!email.isEncrypted) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: 'Email is not encrypted'
      });
    }

    // Check if user has access to this email
    const userEmail = req.user.email;
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

    // Get user's private key
    const user = await User.findById(userId);
    if (!user || !user.encryptedPrivateKey) {
      return res.status(400).json({
        success: false,
        error: 'EncryptionError',
        message: 'User does not have encryption keys set up. Please generate encryption keys first.'
      });
    }

    // Verify the password is correct by comparing with stored password hash
    // This ensures the user enters the correct account password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'AuthenticationError',
        message: 'Invalid password. Please enter your account password.'
      });
    }

    // Decrypt user's private key using password
    let privateKey;
    let needsReencryption = false;
    let keysWereRegenerated = false;
    try {
      privateKey = decryptPrivateKey(
        { encrypted: user.encryptedPrivateKey },
        password.trim() // Trim password to handle whitespace issues
      );
    } catch (error) {
      console.error(`[Decrypt] Failed to decrypt private key:`, error.message);
      
      // Check if it's a format error
      if (error.message.includes('Invalid encrypted data format')) {
        return res.status(500).json({
          success: false,
          error: 'EncryptionError',
          message: 'Encryption key format is invalid. Please regenerate your encryption keys.'
        });
      }
      
      // If password validation passed but decryption failed, the private key was encrypted with old password
      // We need to try to recover it, but we can't decrypt without the old password
      // However, if the user has access to their account, we can try to regenerate keys
      // But that would lose access to old encrypted emails...
      
      // Alternative: Try to decrypt with password variations (trimmed, with/without spaces)
      // This handles cases where password might have been stored with different formatting
      let decrypted = false;
      const passwordVariations = [
        password.trim(),
        password,
        password.trim().toLowerCase(),
        password.trim().toUpperCase()
      ];
      
      for (const pwd of passwordVariations) {
        try {
          privateKey = decryptPrivateKey({ encrypted: user.encryptedPrivateKey }, pwd);
          decrypted = true;
          // Re-encrypt with current password (trimmed) to fix the issue
          needsReencryption = true;
          break;
        } catch (e) {
          // Try next variation
          continue;
        }
      }
      
      if (!decrypted) {
        // If all variations failed, we can't decrypt the old private key
        // Since password validation passed, we know the current password is correct
        // The only solution is to regenerate the encryption keys with the current password
        // This will allow future emails to work, but old emails encrypted with the old key won't be decryptable
        try {
          // Generate new key pair
          const { publicKey, privateKey: newPrivateKey } = generateKeyPair();
          
          // Encrypt new private key with current password
          const encryptedPrivateKeyData = encryptPrivateKey(newPrivateKey, password.trim());
          
          // Update user with new keys
          user.publicKey = publicKey;
          user.encryptedPrivateKey = encryptedPrivateKeyData.encrypted;
          await user.save();
          
          // Use the new private key for decryption
          privateKey = newPrivateKey;
          keysWereRegenerated = true;
        } catch (regenerateError) {
          console.error(`[Decrypt] Failed to regenerate keys:`, regenerateError);
          return res.status(500).json({
            success: false,
            error: 'EncryptionError',
            message: 'Failed to regenerate encryption keys. Please try again or regenerate keys manually in Settings.'
          });
        }
      }
    }
    
    // If we successfully decrypted but used a password variation, re-encrypt with current password
    if (needsReencryption && privateKey) {
      try {
        const reencryptedData = encryptPrivateKey(privateKey, password.trim());
        user.encryptedPrivateKey = reencryptedData.encrypted;
        await user.save();
      } catch (error) {
        console.error(`[Decrypt] Failed to re-encrypt private key:`, error);
        // Continue anyway - we have the decrypted private key in memory
      }
    }

    // Decrypt email body
    let decryptedBody;
    try {
      decryptedBody = decryptEmailContent(
        { encrypted: email.encryptedBody },
        privateKey
      );
    } catch (error) {
      // If decryption fails and we just regenerated keys, the email was encrypted with the old public key
      // This email cannot be decrypted with the new private key
      if (keysWereRegenerated) {
        return res.status(500).json({
          success: false,
          error: 'DecryptionError',
          message: 'This email was encrypted with your old encryption keys and cannot be decrypted with the new keys. Your encryption keys have been regenerated for future emails.'
        });
      }
      return res.status(500).json({
        success: false,
        error: 'DecryptionError',
        message: 'Failed to decrypt email content: ' + error.message
      });
    }

    // Decrypt attachments if any
    let decryptedAttachments = [];
    if (email.encryptedAttachments && email.encryptedAttachments.length > 0) {
      try {
        decryptedAttachments = email.encryptedAttachments.map((att, index) => {
          try {
            // Skip placeholder attachments
            if (att.encrypted === '[ENCRYPTED]' || att.encrypted === '[FILE_NOT_FOUND]' || att.encrypted === '[ENCRYPTION_FAILED]') {
              return null;
            }
            
            const decryptedData = decryptEmailContent(
              { encrypted: att.encrypted },
              privateKey
            );
            
            return {
              name: att.name,
              size: att.size,
              type: att.type,
              data: decryptedData // Base64 decoded data
            };
          } catch (error) {
            console.error('[Decrypt] Error decrypting attachment:', att.name, error.message);
            return null;
          }
        }).filter(Boolean);
        
      } catch (error) {
        console.error('[Decrypt] Error decrypting attachments:', error);
      }
    }

    res.json({
      success: true,
      data: {
        decryptedBody,
        decryptedAttachments,
        emailId: email._id,
        keysRegenerated: keysWereRegenerated
      }
    });

  } catch (error) {
    console.error('Decrypt email error:', error);
    res.status(500).json({
      success: false,
      error: 'ServerError',
      message: 'Failed to decrypt email',
      details: error.message
    });
  }
};

module.exports = {
  generateKeys,
  getPublicKey,
  decryptEmail
};
