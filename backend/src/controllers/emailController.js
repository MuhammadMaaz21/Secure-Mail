const Email = require('../models/Email');
const User = require('../models/User');
const UserSettings = require('../models/UserSettings');
const { analyzeEmailAI } = require('../utils/aiClassifier');
const { isEmailExpired } = require('../jobs/emailCleanup');
const { addBlock } = require('../utils/blockchain');
const { isTemporaryEmail, incrementTempEmailUsage } = require('../controllers/privacyController');
const TemporaryEmail = require('../models/TemporaryEmail');
const { encryptEmailContent, decryptEmailContent } = require('../utils/encryption');
const { sanitizeHtml, sanitizeText } = require('../utils/sanitize');

function buildStoredAiAnalysis(ai) {
  return {
    threatLevel: ai.threatLevel,
    confidence: ai.confidence,
    riskScore: ai.riskScore ?? ai.confidence,
    details: ai.details,
    reasons: Array.isArray(ai.reasons) ? ai.reasons : [],
    spamProbability: ai.spamProbability ?? 0,
    phishingProbability: ai.phishingProbability ?? 0,
    tone: ai.tone,
    isImportant: ai.isImportant === true,
    links: Array.isArray(ai.links) ? ai.links : [],
    attachmentScan: Array.isArray(ai.attachmentScan) ? ai.attachmentScan : [],
    source: ai.source || 'ai-model',
  };
}

/**
 * Send email - creates email in both sent folder (for sender) and inbox (for recipients)
 */
const sendEmail = async (req, res) => {
  try {
    // Parse FormData fields (to, cc, bcc may be JSON strings)
    let to = req.body.to;
    let cc = req.body.cc || [];
    let bcc = req.body.bcc || [];
    
    // Parse JSON strings if they are strings
    if (typeof to === 'string') {
      try {
        to = JSON.parse(to);
      } catch (e) {
        to = [to]; // Fallback to array with single value
      }
    }
    if (typeof cc === 'string' && cc.trim()) {
      try {
        cc = JSON.parse(cc);
      } catch (e) {
        cc = [cc]; // Fallback to array with single value
      }
    }
    if (typeof bcc === 'string' && bcc.trim()) {
      try {
        bcc = JSON.parse(bcc);
      } catch (e) {
        bcc = [bcc]; // Fallback to array with single value
      }
    }
    
    // Parse FormData fields (encrypt may be string "true"/"false")
    let encrypt = req.body.encrypt;
    if (typeof encrypt === 'string') {
      encrypt = encrypt === 'true' || encrypt === '1';
    } else {
      encrypt = Boolean(encrypt);
    }
    
    const { subject, body, selfDestructTimer = 'none', draftId } = req.body;
    const senderId = req.userId;
    const senderEmail = req.user.email;
    
    // Handle uploaded files from multer
    const uploadedFiles = req.files || [];
    const path = require('path');
    
    // Process uploaded files
    let processedAttachments = [];
    if (uploadedFiles.length > 0) {
      // Files were uploaded via multer
      processedAttachments = uploadedFiles.map(file => {
        // Store the full absolute path from multer
        const attachmentData = {
          name: file.originalname,
          size: file.size,
          type: file.mimetype,
          path: file.path // Multer stores full absolute path
        };
        return attachmentData;
      });
    }
    
    // Validation
    if (!to || !Array.isArray(to) || to.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: 'At least one recipient (to) is required'
      });
    }
    
    if (!subject || !subject.trim()) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: 'Subject is required'
      });
    }
    
    if (!body || !body.trim()) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: 'Email body is required'
      });
    }
    
    // Validate email addresses
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const allRecipients = [...to, ...cc, ...bcc];
    
    // Check for duplicate recipients
    const uniqueRecipients = [...new Set(allRecipients.map(e => e.toLowerCase().trim()))];
    if (uniqueRecipients.length !== allRecipients.length) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: 'Duplicate email addresses are not allowed'
      });
    }
    
    for (const email of allRecipients) {
      const trimmedEmail = email.trim();
      if (!trimmedEmail) {
        return res.status(400).json({
          success: false,
          error: 'ValidationError',
          message: 'Empty email address is not allowed'
        });
      }
      if (!emailRegex.test(trimmedEmail)) {
        return res.status(400).json({
          success: false,
          error: 'ValidationError',
          message: `Invalid email address: ${trimmedEmail}`
        });
      }
    }
    
    // Validate and calculate self-destruct time
    const validTimers = ['none', '1min', '5min', '1hour', '1day'];
    if (selfDestructTimer && !validTimers.includes(selfDestructTimer)) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: 'Invalid self-destruct timer value'
      });
    }
    
    let selfDestructAt = null;
    if (selfDestructTimer && selfDestructTimer !== 'none') {
      const now = new Date();
      switch (selfDestructTimer) {
        case '1min':
          selfDestructAt = new Date(now.getTime() + 60 * 1000);
          break;
        case '5min':
          selfDestructAt = new Date(now.getTime() + 5 * 60 * 1000);
          break;
        case '1hour':
          selfDestructAt = new Date(now.getTime() + 60 * 60 * 1000);
          break;
        case '1day':
          selfDestructAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
          break;
        default:
          return res.status(400).json({
            success: false,
            error: 'ValidationError',
            message: 'Invalid self-destruct timer value'
          });
      }
    }
    
    // Get sender name from user profile (if available)
    const senderName = req.user.email.split('@')[0]; // Fallback to email username
    
    // Run AI analysis on email content using the real ML model (with error handling)
    let aiAnalysis;
    try {
      aiAnalysis = await analyzeEmailAI({
        subject: subject.trim(),
        body: body.trim(),
        senderEmail,
        attachments: processedAttachments,
      });
    } catch (error) {
      console.error('AI analysis error:', error);
      // Use default safe analysis if AI fails
      aiAnalysis = {
        threatLevel: 'safe',
        confidence: 0,
        riskScore: 0,
        details: 'Analysis unavailable',
        reasons: [],
        spamProbability: 0,
        phishingProbability: 0,
        tone: 'professional',
        classification: 'inbox',
        isSpam: false,
        isPhishing: false,
        isImportant: false,
        links: [],
        attachmentScan: [],
        source: 'unavailable',
      };
    }
    
    // Update spam/phishing flags based on AI analysis
    const isSpam = aiAnalysis.isSpam || aiAnalysis.threatLevel === 'spam';
    const isPhishing = aiAnalysis.isPhishing || aiAnalysis.threatLevel === 'phishing';
    
    // Handle encryption if enabled
    let emailBody = body.trim();
    let emailAttachments = processedAttachments; // Use processed attachments
    let isEncrypted = false;
    let encryptedBody = null;
    let encryptedAttachments = [];
    
    if (encrypt) {
      // Check all recipients have encryption keys
      const allRecipientsList = [...new Set([...to, ...cc, ...bcc])];
      const recipientsWithoutKeys = [];
      
      for (const recipientEmail of allRecipientsList) {
        const recipient = await User.findOne({ email: recipientEmail.toLowerCase() });
        if (!recipient || !recipient.publicKey) {
          recipientsWithoutKeys.push(recipientEmail);
        }
      }
      
      if (recipientsWithoutKeys.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'EncryptionError',
          message: `The following recipients do not have encryption keys set up: ${recipientsWithoutKeys.join(', ')}. They need to generate encryption keys first.`,
          recipientsWithoutKeys
        });
      }
      
      // All recipients have keys, proceed with encryption
      // For the sent email, we'll use the first recipient's encryption
      const firstRecipient = allRecipientsList[0];
      const firstRecipientUser = await User.findOne({ email: firstRecipient.toLowerCase() });
      
      try {
        const encrypted = encryptEmailContent(emailBody, firstRecipientUser.publicKey);
        encryptedBody = encrypted.encrypted;
        emailBody = '[ENCRYPTED]'; // Placeholder
        isEncrypted = true;
        
        // Encrypt attachments if any
        if (emailAttachments && emailAttachments.length > 0) {
          const fs = require('fs');
          encryptedAttachments = [];
          
          for (const att of emailAttachments) {
            try {
              // Read the actual file data
              if (att.path && fs.existsSync(att.path)) {
                const fileData = fs.readFileSync(att.path);
                // Convert to base64 for encryption
                const base64Data = fileData.toString('base64');
                
                // Encrypt the file data using the recipient's public key
                const encrypted = encryptEmailContent(base64Data, firstRecipientUser.publicKey);
                
                encryptedAttachments.push({
            name: att.name,
            size: att.size,
            type: att.type,
                  encrypted: encrypted.encrypted // Store encrypted data
                });
              } else {
                // Still add the attachment metadata even if file is missing
                encryptedAttachments.push({
                  name: att.name,
                  size: att.size,
                  type: att.type,
                  encrypted: '[FILE_NOT_FOUND]'
                });
              }
            } catch (error) {
              console.error('[Encrypt] Error encrypting attachment:', att.name, error);
              // Add attachment with error indicator
              encryptedAttachments.push({
                name: att.name,
                size: att.size,
                type: att.type,
                encrypted: '[ENCRYPTION_FAILED]'
              });
            }
          }
        }
      } catch (error) {
        console.error('Encryption error:', error);
        return res.status(400).json({
          success: false,
          error: 'EncryptionError',
          message: 'Failed to encrypt email: ' + error.message
        });
      }
    }
    
    // Sanitize email content to prevent XSS
    const sanitizedSubject = sanitizeText(subject.trim());
    const sanitizedBody = sanitizeHtml(emailBody);
    
    // Delete draft before creating sent email
    if (draftId) {
      try {
        const mongoose = require('mongoose');
        const draftObjectId = typeof draftId === 'string' ? new mongoose.Types.ObjectId(draftId) : draftId;
        
        const deleteResult = await Email.deleteOne({ _id: draftObjectId, senderId });
        
        if (deleteResult.deletedCount === 0) {
          await Email.findByIdAndDelete(draftObjectId);
        }
        
        const exists = await Email.findById(draftObjectId);
        if (exists) {
          await Email.deleteOne({ _id: draftObjectId });
        }
      } catch (error) {
        console.error('Error deleting draft:', error.message);
      }
    }
    
    // Create email in SENT folder for sender
    const sentEmail = new Email({
      senderId,
      senderEmail,
      senderName,
      to,
      cc,
      bcc,
      subject: sanitizedSubject,
      body: sanitizedBody,
      attachments: isEncrypted ? [] : emailAttachments, // Don't store unencrypted attachments if encrypted
      folder: 'sent',
      status: 'sent',
      selfDestructTimer,
      selfDestructAt,
      isRead: true, // Sent emails are marked as read
      deliveryStatus: 'pending', // Initially pending
      isSpam,
      isPhishing,
      isEncrypted,
      encryptedBody,
      encryptedAttachments: isEncrypted ? (Array.isArray(encryptedAttachments) ? encryptedAttachments : []) : [],
      aiAnalysis: buildStoredAiAnalysis(aiAnalysis),
    });
    
    sentEmail.folder = 'sent';
    sentEmail.status = 'sent';
    sentEmail.deliveryStatus = 'pending';
    
    await sentEmail.save();
    
    // Create email in INBOX folder for each recipient
    const inboxEmails = [];
    const allRecipientsList = [...new Set([...to, ...cc, ...bcc])]; // Remove duplicates
    
    // Prepare raw values for blockchain (before sanitization)
    const rawSubject = subject.trim();
    const rawBody = emailBody.trim(); // Use emailBody (before sanitization)
    const rawTimestamp = sentEmail.createdAt.toISOString(); // Get timestamp after save
    const sortedRecipientIds = allRecipientsList.map(email => email.toLowerCase()).sort();
    
    // Calculate body hash from raw body
    const crypto = require('crypto');
    const bodyHash = crypto.createHash('sha256').update(rawBody).digest('hex');
    
    // Store blockchain metadata in email document (with timestamp from createdAt)
    sentEmail.blockMetadata = {
      senderId: senderId.toString(),
      recipientIds: sortedRecipientIds,
      subject: rawSubject,
      bodyHash: bodyHash,
      timestamp: rawTimestamp
    };
    sentEmail.markModified('blockMetadata'); // Ensure Mongoose saves the nested object
    await sentEmail.save();
    
    // Add to blockchain ledger using raw values (use timestamp from blockMetadata)
    try {
      addBlock(
        sentEmail._id,
        senderId,
        sortedRecipientIds,
        sentEmail.blockMetadata.timestamp, // Use timestamp from blockMetadata
        rawSubject,
        rawBody
      );
    } catch (error) {
      console.error('Error adding email to blockchain:', error);
      // Don't fail email send if blockchain fails
    }
    
    // Track internal vs external recipients
    let internalRecipientCount = 0;
    let externalRecipientCount = 0;
    
    // Batch fetch all users and temp emails to avoid N+1 queries
    const recipientEmailsLower = allRecipientsList.map(e => e.toLowerCase());
    const [users, tempEmails] = await Promise.all([
      User.find({ email: { $in: recipientEmailsLower } }).select('_id email publicKey'),
      TemporaryEmail.find({ 
        tempAddress: { $in: recipientEmailsLower },
        expiresAt: { $gt: new Date() }
      })
    ]);
    
    // Create lookup maps
    const userMap = new Map(users.map(u => [u.email.toLowerCase(), u]));
    const tempEmailMap = new Map(tempEmails.map(t => [t.tempAddress.toLowerCase(), t]));
    
    for (const recipientEmail of allRecipientsList) {
      const recipientEmailLower = recipientEmail.toLowerCase();
      // Check if recipient is a temporary/disposable email
      const tempEmail = tempEmailMap.get(recipientEmailLower);
      const isDisposable = !!tempEmail;
      
      // Determine the actual recipient user
      // If it's a temporary email, use the owner of that temporary email
      // Otherwise, check if it's a registered user
      let recipientUserId = null;
      if (isDisposable && tempEmail) {
        recipientUserId = tempEmail.userId;
        // Increment usage count
        await incrementTempEmailUsage(recipientEmailLower);
      } else {
        const recipient = userMap.get(recipientEmailLower);
        if (recipient) {
          recipientUserId = recipient._id;
        }
      }
      
      // Only create inbox email if we have a valid recipient (registered user or temp email owner)
      if (recipientUserId) {
        // For encrypted emails, use encrypted data for recipient
        let recipientBody = emailBody;
        // Copy attachments array for recipient (ensure it's a proper array with all fields)
        let recipientAttachments = emailAttachments && emailAttachments.length > 0 
          ? emailAttachments.map(att => ({
              name: att.name,
              size: att.size,
              type: att.type,
              path: att.path // Include file path for recipient
            }))
          : [];
        let recipientEncryptedBody = encryptedBody;
        let recipientEncryptedAttachments = encryptedAttachments;
        
        // If email is encrypted, check if this recipient has the public key
        if (isEncrypted) {
          // Use already fetched user from map if available, otherwise fetch
          let recipientUser = userMap.get(recipientEmailLower);
          if (!recipientUser && recipientUserId) {
            recipientUser = await User.findById(recipientUserId).select('publicKey');
          }
          if (recipientUser && recipientUser.publicKey) {
            // Re-encrypt for this specific recipient if different from first
            if (recipientEmail.toLowerCase() !== [...new Set([...to, ...cc, ...bcc])][0].toLowerCase()) {
              try {
                const reEncrypted = encryptEmailContent(body.trim(), recipientUser.publicKey);
                recipientEncryptedBody = reEncrypted.encrypted;
                
                // Re-encrypt attachments for this recipient
                if (emailAttachments && emailAttachments.length > 0) {
                  const fs = require('fs');
                  recipientEncryptedAttachments = [];
                  
                  for (const att of emailAttachments) {
                    try {
                      // Read the actual file data
                      if (att.path && fs.existsSync(att.path)) {
                        const fileData = fs.readFileSync(att.path);
                        // Convert to base64 for encryption
                        const base64Data = fileData.toString('base64');
                        
                        // Encrypt the file data using this recipient's public key
                        const encrypted = encryptEmailContent(base64Data, recipientUser.publicKey);
                        
                        recipientEncryptedAttachments.push({
                          name: att.name,
                          size: att.size,
                          type: att.type,
                          encrypted: encrypted.encrypted
                        });
                      } else {
                        recipientEncryptedAttachments.push({
                          name: att.name,
                          size: att.size,
                          type: att.type,
                          encrypted: '[FILE_NOT_FOUND]'
                        });
                      }
                    } catch (error) {
                      console.error('[Encrypt] Error encrypting attachment for recipient:', att.name, error);
                      recipientEncryptedAttachments.push({
                        name: att.name,
                        size: att.size,
                        type: att.type,
                        encrypted: '[ENCRYPTION_FAILED]'
                      });
                    }
                  }
                }
              } catch (error) {
                console.error('Error re-encrypting for recipient:', error);
                // Skip this recipient if encryption fails
                continue;
              }
            } else {
              // Use the already encrypted body and attachments for the first recipient
              recipientEncryptedBody = encryptedBody;
              recipientEncryptedAttachments = encryptedAttachments;
            }
          } else {
            // Skip this recipient if they don't have encryption keys
            continue;
          }
        }
        
        // Classify email for recipient using the AI analysis already computed
        // above (the model result is content-based, so it is the same for
        // every recipient and we avoid running inference more than once).
        const classificationResult = {
          classification: aiAnalysis.classification || 'inbox',
          isSpam: aiAnalysis.isSpam === true,
          isPhishing: aiAnalysis.isPhishing === true,
          isImportant: aiAnalysis.isImportant === true
        };
        
        // Determine recipientFolder using explicit mapping
        let recipientFolder = 'inbox';
        switch ((classificationResult.classification || '').toLowerCase()) {
          case 'spam':
            recipientFolder = 'spam';
            break;
          case 'phishing':
            // Put phishing into spam folder to protect users, but keep a phishing flag
            recipientFolder = 'spam';
            break;
          case 'important':
            recipientFolder = 'inbox';
            break;
          default:
            recipientFolder = 'inbox';
        }
        
        // Ensure flags are set consistently
        const isSpam = classificationResult.classification === 'spam' || classificationResult.isSpam === true;
        const isPhishing = classificationResult.classification === 'phishing' || classificationResult.isPhishing === true;
        const isImportant = classificationResult.classification === 'important' || classificationResult.isImportant === true;
        
        // Defensive check - do not drop messages
        if (!recipientEmail || !recipientEmail.includes('@')) {
          continue;
        }
        
        
        const inboxEmail = new Email({
          senderId,
          senderEmail,
          senderName,
          to: [recipientEmail],
          cc: cc.includes(recipientEmail) ? cc : [],
          bcc: [], // BCC recipients shouldn't see each other
          subject: sanitizedSubject,
          body: sanitizeHtml(recipientBody),
          attachments: isEncrypted ? [] : (Array.isArray(recipientAttachments) ? recipientAttachments : []),
          folder: recipientFolder,
          status: 'sent',
          selfDestructTimer,
          selfDestructAt,
          isRead: false,
          isSpam,
          isPhishing,
          isImportant,
          classification: classificationResult.classification || 'inbox',
          isDisposable,
          disposableAddress: isDisposable ? recipientEmail.toLowerCase() : null,
          isEncrypted,
          encryptedBody: recipientEncryptedBody,
          encryptedAttachments: isEncrypted ? (Array.isArray(recipientEncryptedAttachments) ? recipientEncryptedAttachments : []) : [],
          aiAnalysis: buildStoredAiAnalysis(aiAnalysis),
          // Store same blockchain metadata as sent email (same block)
          blockMetadata: {
            senderId: senderId.toString(),
            recipientIds: sortedRecipientIds,
            subject: rawSubject,
            bodyHash: bodyHash,
            timestamp: rawTimestamp
          }
        });
        
        inboxEmail.markModified('blockMetadata'); // Ensure Mongoose saves the nested object
        await inboxEmail.save();
        inboxEmails.push(inboxEmail);
        internalRecipientCount++;
      } else {
        // If recipient is not registered and not a temp email, they're external
        externalRecipientCount++;
      }
      // If recipient is not registered and not a temp email, we don't create the email
      // They can access it when they register with that email
    }
    
    // Update delivery status based on recipients
    // If all recipients are internal (emails created in inbox), mark as delivered immediately
    // If there are external recipients, simulate delivery with a delay
    if (externalRecipientCount === 0 && internalRecipientCount > 0) {
      // All recipients are internal - mark as delivered immediately
      sentEmail.deliveryStatus = 'delivered';
      sentEmail.deliveredAt = new Date();
      await sentEmail.save();
    } else if (externalRecipientCount > 0) {
      // Has external recipients - simulate delivery (in production, this would be handled by email service)
      // For demo: randomly set status to delivered or failed after a delay
      setTimeout(async () => {
        try {
          const email = await Email.findById(sentEmail._id);
          if (email) {
            // Simulate 90% success rate for external emails
            const success = Math.random() > 0.1;
            email.deliveryStatus = success ? 'delivered' : 'failed';
            if (success) {
              email.deliveredAt = new Date();
            } else {
              email.deliveryError = 'Recipient server unreachable or mailbox full';
            }
            await email.save();
          }
        } catch (error) {
          console.error('Error updating delivery status:', error);
        }
      }, 2000); // Update after 2 seconds
    }
    
    // Draft was already deleted before creating sent email, so no need to delete again here
    
    // Return the sent email with ID
    res.status(201).json({
      success: true,
      message: 'Email sent successfully',
      data: {
        id: sentEmail._id,
        senderEmail,
        to,
        cc,
        bcc,
        subject: sentEmail.subject,
        body: sentEmail.body,
        attachments: sentEmail.attachments,
        selfDestructTimer: sentEmail.selfDestructTimer,
        selfDestructAt: sentEmail.selfDestructAt,
        createdAt: sentEmail.createdAt,
        recipientsCount: allRecipientsList.length
      }
    });
    
  } catch (error) {
    console.error('Send email error:', error);
    res.status(500).json({
      success: false,
      error: 'ServerError',
      message: 'Failed to send email: ' + (error.message || 'Unknown error'),
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

/**
 * Get user's emails by folder
 */
const getEmails = async (req, res) => {
  try {
    // Validate and sanitize pagination parameters
    let page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 20;
    
    // Ensure valid values
    if (page < 1) page = 1;
    if (limit < 1) limit = 20;
    if (limit > 100) limit = 100; // Max limit to prevent abuse
    
    const folder = req.query.folder || 'inbox';
    const userId = req.userId;
    const userEmail = req.user.email;
    
    const validFolders = ['inbox', 'sent', 'draft', 'trash', 'spam'];
    if (!validFolders.includes(folder)) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: 'Invalid folder'
      });
    }
    
    // Build query based on folder
    let query = {};
    
    if (folder === 'sent') {
      // Sent folder: emails where user is the sender, exclude deleted and vault emails
      // Use $or to properly check for null or non-existent deletedAt
      query = { 
        senderId: userId, 
        folder: 'sent',
        $and: [
          {
            $or: [
              { deletedAt: null },
              { deletedAt: { $exists: false } }
            ]
          },
          { isVault: false }
        ]
      };
    } else if (folder === 'draft') {
      // Draft folder: emails where user is the sender with draft status, exclude deleted
      query = { 
        senderId: userId, 
        folder: 'draft',
        status: 'draft',
        $or: [
          { deletedAt: null },
          { deletedAt: { $exists: false } }
        ] // Exclude soft-deleted emails
      };
    } else if (folder === 'trash') {
      // Trash folder: show soft-deleted emails
      query = {
        $or: [
          { senderId: userId },
          { to: userEmail.toLowerCase() },
          { cc: userEmail.toLowerCase() },
          { bcc: userEmail.toLowerCase() }
        ],
        deletedAt: { $ne: null }
      };
    } else {
      // Inbox, spam: emails where user is a recipient (exclude soft-deleted)
      // Get all temporary email addresses owned by this user
      const userTempEmails = await TemporaryEmail.find({
        userId,
        expiresAt: { $gt: new Date() } // Only active temp emails
      }).select('tempAddress');
      
      const tempAddresses = userTempEmails.map(te => te.tempAddress.toLowerCase());
      
      // Build query to include emails sent to user's email OR to user's temporary addresses
      const recipientConditions = [
        { to: userEmail.toLowerCase() },
        { cc: userEmail.toLowerCase() },
        { bcc: userEmail.toLowerCase() }
      ];
      
      // Add conditions for temporary addresses
      if (tempAddresses.length > 0) {
        recipientConditions.push(
          { to: { $in: tempAddresses } },
          { cc: { $in: tempAddresses } },
          { bcc: { $in: tempAddresses } }
        );
      }
      
      // Get filter parameter for classification filtering
      const filter = req.query.filter || 'all';
      
      // Build base recipient and deletion conditions
      const recipientAndDeletionConditions = {
        $and: [
          { $or: recipientConditions },
          {
            $or: [
              { deletedAt: null },
              { deletedAt: { $exists: false } }
            ]
          },
          { isVault: false }
        ]
      };
      
      // Handle folder and filter logic
      if (folder === 'spam') {
        // Spam folder: show emails in spam folder (but exclude phishing)
        query = {
          ...recipientAndDeletionConditions,
          folder: 'spam',
          classification: { $ne: 'phishing' } // Exclude phishing emails from spam folder view
        };
      } else if (folder === 'inbox') {
        // Inbox folder with filters
        if (filter === 'spam') {
          // Show spam emails (in spam folder, but exclude phishing)
          query = {
            ...recipientAndDeletionConditions,
            folder: 'spam',
            classification: { $ne: 'phishing' } // Exclude phishing emails from spam filter
          };
        } else if (filter === 'important') {
          // Show important emails in inbox
          query = {
            ...recipientAndDeletionConditions,
            folder: 'inbox',
            classification: 'important'
          };
        } else if (filter === 'phishing') {
          // Show phishing emails (in spam folder with phishing classification)
          query = {
            ...recipientAndDeletionConditions,
            folder: 'spam',
            classification: 'phishing'
          };
        } else if (filter === 'all') {
          // Show ALL emails (inbox, spam, important, phishing - everything)
          // This is like Gmail's "All Mail" view
          query = {
            $and: [
              { $or: recipientConditions },
              {
                $or: [
                  { deletedAt: null },
                  { deletedAt: { $exists: false } }
                ]
              },
              { isVault: false },
              {
                $or: [
                  { folder: 'inbox' },
                  { folder: 'spam' }
                ]
              }
              // No classification filter - show all emails regardless of classification
            ]
          };
        } else {
          // Default: show all inbox emails (both inbox and spam folders)
          query = {
            $and: [
              { $or: recipientConditions },
              {
                $or: [
                  { deletedAt: null },
                  { deletedAt: { $exists: false } }
                ]
              },
              { isVault: false },
              {
                $or: [
                  { folder: 'inbox' },
                  { folder: 'spam' }
                ]
              }
            ]
          };
        }
      }
    }
    
        // Get user settings to filter blocked senders
        const userSettings = await UserSettings.findOne({ userId });
        const blockedSenders = userSettings?.blockedSenders || [];

        // Build query with blocked senders filter for accurate counting
        let countQuery = { ...query };
        if (blockedSenders.length > 0) {
          countQuery.senderEmail = { 
            $nin: blockedSenders.map(bs => bs.toLowerCase()) 
          };
        }

        // Count total (after applying blocked senders filter for accurate pagination)
        const total = await Email.countDocuments(countQuery);

        // Pagination
        const skip = (page - 1) * limit;

        let emails = await Email.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .select('-__v');

        // Filter out emails from blocked senders (expired emails are already deleted by cleanup job)
        let filteredEmails = emails;
        if (blockedSenders.length > 0) {
          filteredEmails = emails.filter(email => {
            const senderEmail = email.senderEmail?.toLowerCase() || '';
            return !blockedSenders.some(blocked => blocked.toLowerCase() === senderEmail);
          });
        }
    
    res.json({
      success: true,
      data: {
        emails: filteredEmails,
        pagination: {
          page: page,
          limit: limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
    
  } catch (error) {
    console.error('Get emails error:', error);
    res.status(500).json({
      success: false,
      error: 'ServerError',
      message: 'Failed to fetch emails',
      details: error.message
    });
  }
};

/**
 * Get single email by ID
 */
const getEmailById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    const userEmail = req.user.email;
    
    const email = await Email.findById(id);
    
    if (!email) {
      return res.status(404).json({
        success: false,
        error: 'NotFound',
        message: 'Email not found'
      });
    }
    
    // Check if email has expired
    if (isEmailExpired(email)) {
      return res.json({
        success: true,
        data: {
          ...email.toObject(),
          isExpired: true,
          expiredAt: email.selfDestructAt
        }
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
    
    // Mark as read if viewing from inbox
    if (email.folder === 'inbox' && !email.isRead) {
      email.isRead = true;
      await email.save();
    }
    
    res.json({
      success: true,
      data: email
    });
    
  } catch (error) {
    console.error('Get email by ID error:', error);
    res.status(500).json({
      success: false,
      error: 'ServerError',
      message: 'Failed to fetch email',
      details: error.message
    });
  }
};

/**
 * Retry sending a failed email
 */
const retryEmail = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    
    const email = await Email.findById(id);
    
    if (!email) {
      return res.status(404).json({
        success: false,
        error: 'NotFound',
        message: 'Email not found'
      });
    }
    
    // Check if user is the sender
    if (email.senderId.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'You can only retry your own emails'
      });
    }
    
    // Check if email is in sent folder and failed
    if (email.folder !== 'sent') {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: 'Can only retry sent emails'
      });
    }
    
    if (email.deliveryStatus !== 'failed') {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: 'Can only retry failed emails'
      });
    }
    
    // Reset delivery status to pending
    email.deliveryStatus = 'pending';
    email.deliveryError = null;
    await email.save();
    
    // Simulate retry delivery
    setTimeout(async () => {
      try {
        const retryEmail = await Email.findById(email._id);
        if (retryEmail) {
          // Simulate 90% success rate on retry
          const success = Math.random() > 0.1;
          retryEmail.deliveryStatus = success ? 'delivered' : 'failed';
          if (success) {
            retryEmail.deliveredAt = new Date();
            retryEmail.deliveryError = null;
          } else {
            retryEmail.deliveryError = 'Retry failed: Recipient server unreachable';
          }
          await retryEmail.save();
        }
      } catch (error) {
        console.error('Error updating retry delivery status:', error);
      }
    }, 2000);
    
    res.json({
      success: true,
      message: 'Email retry initiated',
      data: {
        id: email._id,
        deliveryStatus: email.deliveryStatus
      }
    });
    
  } catch (error) {
    console.error('Retry email error:', error);
    res.status(500).json({
      success: false,
      error: 'ServerError',
      message: 'Failed to retry email',
      details: error.message
    });
  }
};

/**
 * Delete email
 */
const deleteEmail = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    const userEmail = req.user.email;

    const email = await Email.findById(id);

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

    // Soft delete: set deletedAt timestamp
    if (!email.deletedAt) {
      email.deletedAt = new Date();
      await email.save();
    }

    res.json({
      success: true,
      message: 'Email moved to trash',
      data: {
        id: email._id,
        deletedAt: email.deletedAt
      }
    });

  } catch (error) {
    console.error('Delete email error:', error);
    res.status(500).json({
      success: false,
      error: 'ServerError',
      message: 'Failed to delete email',
      details: error.message
    });
  }
};

/**
 * Mark email as spam
 */
const markAsSpam = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    const userEmail = req.user.email;

    const email = await Email.findById(id);

    if (!email) {
      return res.status(404).json({
        success: false,
        error: 'NotFound',
        message: 'Email not found'
      });
    }

    // Check if user is a recipient (only recipients can mark as spam)
    const isRecipient = email.to.includes(userEmail.toLowerCase()) ||
                       email.cc.includes(userEmail.toLowerCase()) ||
                       email.bcc.includes(userEmail.toLowerCase());

    if (!isRecipient) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Only recipients can mark emails as spam'
      });
    }

    // Mark as spam and move to spam folder
    email.isSpam = true;
    email.folder = 'spam';
    await email.save();

    res.json({
      success: true,
      message: 'Email marked as spam',
      data: {
        id: email._id,
        isSpam: email.isSpam,
        folder: email.folder
      }
    });

  } catch (error) {
    console.error('Mark as spam error:', error);
    res.status(500).json({
      success: false,
      error: 'ServerError',
      message: 'Failed to mark email as spam',
      details: error.message
    });
  }
};

/**
 * Mark/unmark email as important
 */
const markAsImportant = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    const userEmail = req.user.email;

    const email = await Email.findById(id);

    if (!email) {
      return res.status(404).json({
        success: false,
        error: 'NotFound',
        message: 'Email not found'
      });
    }

    // Check if user is a recipient or sender (both can mark as important)
    const isRecipient = email.to.includes(userEmail.toLowerCase()) ||
                       email.cc.includes(userEmail.toLowerCase()) ||
                       email.bcc.includes(userEmail.toLowerCase());
    const isSender = email.senderId.toString() === userId.toString();

    if (!isRecipient && !isSender) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Only recipients or senders can mark emails as important'
      });
    }

    // Toggle importance
    email.isImportant = !email.isImportant;
    await email.save();

    res.json({
      success: true,
      message: email.isImportant ? 'Email marked as important' : 'Email unmarked as important',
      data: {
        id: email._id,
        isImportant: email.isImportant
      }
    });

  } catch (error) {
    console.error('Mark as important error:', error);
    res.status(500).json({
      success: false,
      error: 'ServerError',
      message: 'Failed to mark email as important',
      details: error.message
    });
  }
};

/**
 * Save or update draft - Simple Gmail-style implementation
 */
const saveDraft = async (req, res) => {
  try {
    const { draftId, to = [], cc = [], bcc = [], subject = '', body = '', attachments = [], selfDestructTimer = 'none' } = req.body;
    const senderId = req.userId;
    const senderEmail = req.user.email;
    const sender = await User.findById(senderId);
    const senderName = sender ? sender.name : '';

    // Validate email addresses if provided
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const allRecipients = [...to, ...cc, ...bcc].filter(e => e && e.trim());
    
    for (const email of allRecipients) {
      const trimmedEmail = email.trim();
      if (trimmedEmail && !emailRegex.test(trimmedEmail)) {
        return res.status(400).json({
          success: false,
          error: 'ValidationError',
          message: `Invalid email address: ${trimmedEmail}`
        });
      }
    }

    // Normalize email arrays
    const normalizedTo = Array.isArray(to) ? to.filter(e => e && e.trim()).map(e => e.toLowerCase().trim()) : [];
    const normalizedCc = Array.isArray(cc) ? cc.filter(e => e && e.trim()).map(e => e.toLowerCase().trim()) : [];
    const normalizedBcc = Array.isArray(bcc) ? bcc.filter(e => e && e.trim()).map(e => e.toLowerCase().trim()) : [];
    const normalizedSubject = (subject || '').trim();
    const normalizedBody = (body || '').trim();
    
    let draft;
    
    if (draftId) {
      // Update existing draft - try to find it
      try {
        draft = await Email.findOne({ 
          _id: draftId, 
          senderId
        });
        
        if (draft) {
          // Update existing draft - force correct status and folder
          draft.to = normalizedTo;
          draft.cc = normalizedCc;
          draft.bcc = normalizedBcc;
          draft.subject = normalizedSubject;
          draft.body = normalizedBody;
          draft.attachments = attachments || [];
          draft.selfDestructTimer = selfDestructTimer || 'none';
          draft.status = 'draft';
          draft.folder = 'draft';
          draft.deletedAt = null;
          draft.deliveryStatus = null;
          draft.deliveryError = null;
          draft.deliveredAt = null;
          draft.updatedAt = new Date();
          await draft.save();
        } else {
          // Draft not found, create new one
          draft = new Email();
          draft.senderId = senderId;
          draft.senderEmail = senderEmail.toLowerCase();
          draft.senderName = senderName;
          draft.to = normalizedTo;
          draft.cc = normalizedCc;
          draft.bcc = normalizedBcc;
          draft.subject = normalizedSubject;
          draft.body = normalizedBody;
          draft.attachments = attachments || [];
          draft.folder = 'draft';
          draft.status = 'draft';
          draft.selfDestructTimer = selfDestructTimer || 'none';
          draft.isRead = true;
          draft.deletedAt = null;
          draft.deliveryStatus = null;
          draft.deliveryError = null;
          draft.deliveredAt = null;
          draft.markModified('status');
          draft.markModified('folder');
          await draft.save();
        }
      } catch (error) {
        // Invalid draftId format, create new draft
        draft = new Email();
        draft.senderId = senderId;
        draft.senderEmail = senderEmail.toLowerCase();
        draft.senderName = senderName;
        draft.to = normalizedTo;
        draft.cc = normalizedCc;
        draft.bcc = normalizedBcc;
        draft.subject = normalizedSubject;
        draft.body = normalizedBody;
        draft.attachments = attachments || [];
        draft.folder = 'draft';
        draft.status = 'draft';
        draft.selfDestructTimer = selfDestructTimer || 'none';
        draft.isRead = true;
        draft.deletedAt = null;
        draft.deliveryStatus = null;
        draft.deliveryError = null;
        draft.deliveredAt = null;
        draft.markModified('status');
        draft.markModified('folder');
        await draft.save();
      }
    } else {
      // Create new draft
      draft = new Email();
      draft.senderId = senderId;
      draft.senderEmail = senderEmail.toLowerCase();
      draft.senderName = senderName;
      draft.to = normalizedTo;
            draft.cc = normalizedCc;
            draft.bcc = normalizedBcc;
      draft.subject = normalizedSubject;
      draft.body = normalizedBody;
            draft.attachments = attachments || [];
      draft.folder = 'draft';
      draft.status = 'draft';
            draft.selfDestructTimer = selfDestructTimer || 'none';
      draft.isRead = true;
      draft.deletedAt = null;
      draft.deliveryStatus = null;
      draft.deliveryError = null;
      draft.deliveredAt = null;
      draft.markModified('status');
      draft.markModified('folder');
            await draft.save();
    }
    
    res.json({
      success: true,
      message: draftId ? 'Draft updated successfully' : 'Draft saved successfully',
      data: draft
    });

  } catch (error) {
    console.error('Save draft error:', error);
    res.status(500).json({
      success: false,
      error: 'ServerError',
      message: 'Failed to save draft',
      details: error.message
    });
  }
};

/**
 * Get all drafts for the current user
 */
const getDrafts = async (req, res) => {
  try {
    const userId = req.userId;
    
    const validDrafts = await Email.find({
      $and: [
        { senderId: userId },
        { folder: 'draft' },
        { status: 'draft' },
        { 
      $or: [
        { deletedAt: null },
        { deletedAt: { $exists: false } }
          ]
        },
        {
          $or: [
            { deliveryStatus: null },
            { deliveryStatus: { $exists: false } }
          ]
        }
      ]
    })
    .sort({ updatedAt: -1 })
    .lean();
    
    // Additional filter to ensure no deliveryStatus
    const finalDrafts = validDrafts.filter(draft => {
      if (draft.deliveryStatus && draft.deliveryStatus !== null && draft.deliveryStatus !== undefined) {
        return false;
      }
      if (draft.status !== 'draft') {
        return false;
      }
      if (draft.folder !== 'draft') {
        return false;
      }
      return true;
    });

    // Remove duplicates based on _id
    const seenIds = new Set();
    const uniqueDrafts = finalDrafts.filter((draft) => {
      const draftId = draft._id.toString();
      if (seenIds.has(draftId)) {
        return false;
      }
      seenIds.add(draftId);
      return true;
    });

    res.json({
      success: true,
      data: {
        emails: uniqueDrafts,
        count: uniqueDrafts.length
      }
    });

  } catch (error) {
    console.error('Get drafts error:', error);
    res.status(500).json({
      success: false,
      error: 'ServerError',
      message: 'Failed to fetch drafts',
      details: error.message
    });
  }
};

/**
 * Delete draft
 */
const deleteDraft = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const draft = await Email.findOne({
      _id: id,
      senderId: userId,
      folder: 'draft',
      status: 'draft'
    });

    if (!draft) {
      return res.status(404).json({
        success: false,
        error: 'NotFound',
        message: 'Draft not found'
      });
    }

    await Email.deleteOne({ _id: id });

    res.json({
      success: true,
      message: 'Draft deleted successfully'
    });

  } catch (error) {
    console.error('Delete draft error:', error);
    res.status(500).json({
      success: false,
      error: 'ServerError',
      message: 'Failed to delete draft',
      details: error.message
    });
  }
};

/**
 * Get trash emails (soft-deleted)
 */
const getTrash = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const userId = req.userId;
    const userEmail = req.user.email;

    // Get user settings to filter blocked senders
    const userSettings = await UserSettings.findOne({ userId });
    const blockedSenders = userSettings?.blockedSenders || [];

    // Query for soft-deleted emails accessible by user
    const query = {
      $or: [
        { senderId: userId },
        { to: userEmail.toLowerCase() },
        { cc: userEmail.toLowerCase() },
        { bcc: userEmail.toLowerCase() }
      ],
      deletedAt: { $ne: null }
    };

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let emails = await Email.find(query)
      .sort({ deletedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('-__v');

    // Filter out emails from blocked senders
    if (blockedSenders.length > 0) {
      emails = emails.filter(email => {
        const senderEmail = email.senderEmail?.toLowerCase() || '';
        return !blockedSenders.some(blocked => blocked.toLowerCase() === senderEmail);
      });
    }

    const total = await Email.countDocuments(query);

    res.json({
      success: true,
      data: {
        emails,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });

  } catch (error) {
    console.error('Get trash error:', error);
    res.status(500).json({
      success: false,
      error: 'ServerError',
      message: 'Failed to fetch trash emails',
      details: error.message
    });
  }
};

/**
 * Restore email from trash
 */
const restoreEmail = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    const userEmail = req.user.email;

    const email = await Email.findById(id);

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

    // Check if email is actually deleted
    if (!email.deletedAt) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: 'Email is not in trash'
      });
    }

    // Restore: clear deletedAt
    email.deletedAt = null;
    await email.save();

    res.json({
      success: true,
      message: 'Email restored successfully',
      data: {
        id: email._id,
        folder: email.folder
      }
    });

  } catch (error) {
    console.error('Restore email error:', error);
    res.status(500).json({
      success: false,
      error: 'ServerError',
      message: 'Failed to restore email',
      details: error.message
    });
  }
};

/**
 * Permanently delete email
 */
const permanentDeleteEmail = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    const userEmail = req.user.email;

    const email = await Email.findById(id);

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

    // Permanently delete
    await Email.deleteOne({ _id: id });

    res.json({
      success: true,
      message: 'Email permanently deleted'
    });

  } catch (error) {
    console.error('Permanent delete email error:', error);
    res.status(500).json({
      success: false,
      error: 'ServerError',
      message: 'Failed to permanently delete email',
      details: error.message
    });
  }
};

/**
 * Verify email authenticity using blockchain
 */
const verifyEmail = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    const userEmail = req.user.email;
    
    const email = await Email.findById(id);
    
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
    
    const { verifyEmail: verifyEmailBlockchain } = require('../utils/blockchain');
    
    // Simplified verification - prepare parameters from email document
    // Use blockMetadata if available, otherwise use email fields
    const senderId = email.blockMetadata?.senderId || (email.senderId ? email.senderId.toString() : '');
    const recipientIds = email.blockMetadata?.recipientIds || 
      [...new Set([...email.to, ...email.cc, ...email.bcc])]
        .map(x => x.toLowerCase())
        .filter(x => x && x.includes('@'))
        .sort();
    const timestamp = email.blockMetadata?.timestamp || 
      (email.createdAt ? (email.createdAt.toISOString ? email.createdAt.toISOString() : new Date(email.createdAt).toISOString()) : new Date().toISOString());
    const subject = email.blockMetadata?.subject || (email.subject || '').trim();
    const bodyHash = email.blockMetadata?.bodyHash || undefined;
    const body = bodyHash ? undefined : (email.body || '').trim(); // Only use body if bodyHash not available
    
    // Call verifyEmailBlockchain - it will handle finding the block intelligently
    const verification = verifyEmailBlockchain({
      emailId: email._id.toString(),
      senderId,
      recipientIds,
      timestamp,
      subject,
      bodyHash,
      body
    });
    
    res.json({
      success: true,
      data: {
        verified: verification.verified,
        reason: verification.reason || (verification.verified ? 'Email verified successfully' : 'Verification failed'),
        blockIndex: verification.blockIndex,
        blockTimestamp: verification.blockTimestamp,
        emailTimestamp: verification.emailTimestamp,
        bodyHashMatch: verification.bodyHashMatch,
        timestamp: verification.emailTimestamp || verification.blockTimestamp
      }
    });
    
  } catch (error) {
    console.error('Verify email error:', error);
    res.status(500).json({
      success: false,
      error: 'ServerError',
      message: 'Failed to verify email',
      details: error.message
    });
  }
};

module.exports = {
  sendEmail,
  getEmails,
  getEmailById,
  retryEmail,
  deleteEmail,
  markAsSpam,
  saveDraft,
  getDrafts,
  deleteDraft,
  getTrash,
  restoreEmail,
  permanentDeleteEmail,
  verifyEmail
};

