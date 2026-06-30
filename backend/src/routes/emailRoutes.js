const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const upload = require('../middleware/upload');
const {
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
} = require('../controllers/emailController');
const { decryptEmail, generateKeys, getPublicKey } = require('../controllers/encryptionController');

// All email routes require authentication
router.use(authenticate);

// Draft routes (must be before /:id routes)
router.post('/save-draft', saveDraft);
router.get('/drafts', getDrafts);
router.delete('/draft/:id', deleteDraft);

// Trash routes (must be before /:id routes)
router.get('/trash', getTrash);
router.post('/restore/:id', restoreEmail);
router.delete('/permanent/:id', permanentDeleteEmail);

// Verify email (must be before /:id routes)
router.get('/verify/:id', verifyEmail);

// Encryption routes (must be before /:id routes)
router.post('/decrypt/:id', decryptEmail);
router.post('/generate-keys', generateKeys);
router.get('/public-key', getPublicKey);

// Send email with file upload support
router.post('/send', upload.array('attachments', 10), sendEmail);

// Get emails by folder
router.get('/', getEmails);

// Retry failed email
router.post('/:id/retry', retryEmail);

// Mark email as spam
router.post('/:id/spam', markAsSpam);

// Delete email (move to trash)
router.delete('/:id', deleteEmail);

// Get single email by ID
router.get('/:id', getEmailById);

// Serve attachment files
const path = require('path');
const fs = require('fs');
router.get('/attachment/:emailId/:attachmentIndex', authenticate, async (req, res) => {
  try {
    const { emailId, attachmentIndex } = req.params;
    const email = await require('../models/Email').findById(emailId);
    
    if (!email) {
      return res.status(404).json({ success: false, message: 'Email not found' });
    }
    
    const { userCanAccessEmail } = require('../utils/emailUtils');
    const userId = req.userId;
    const userEmail = req.user.email;
    const hasAccess = await userCanAccessEmail(email, userId, userEmail);

    if (!hasAccess) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    
    const index = parseInt(attachmentIndex);
    if (!email.attachments || !email.attachments[index]) {
      return res.status(404).json({ success: false, message: 'Attachment not found' });
    }
    
    const attachment = email.attachments[index];
    if (!attachment.path) {
      return res.status(404).json({ success: false, message: 'Attachment file not found' });
    }
    
    // attachment.path from multer is the full absolute path to the file
    // Example: /path/to/backend/uploads/filename-1234567890.ext
    let filePath = attachment.path;
    
    // Check if path is absolute (starts with /)
    if (!path.isAbsolute(filePath)) {
      // If relative, construct full path
      filePath = path.join(__dirname, '../../uploads', filePath);
    }
    
    // Resolve to absolute path
    filePath = path.resolve(filePath);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.error(`[Attachment] File not found: ${filePath}`);
      console.error(`[Attachment] Original path: ${attachment.path}`);
      return res.status(404).json({ 
        success: false, 
        message: 'Attachment file not found on server',
        debug: process.env.NODE_ENV === 'development' ? { filePath, originalPath: attachment.path } : undefined
      });
    }
    
    res.setHeader('Content-Type', attachment.type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(attachment.name)}"`);
    res.sendFile(filePath);
  } catch (error) {
    console.error('Error serving attachment:', error);
    res.status(500).json({ success: false, message: 'Error serving attachment' });
  }
});

module.exports = router;

