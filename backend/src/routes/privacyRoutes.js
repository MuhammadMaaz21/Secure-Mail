const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const {
  createTempEmail,
  getTempEmails,
  deleteTempEmail
} = require('../controllers/privacyController');

router.use(authenticate);

router.post('/create-temp-email', createTempEmail);
router.get('/temp-emails', getTempEmails);
router.delete('/temp-email/:id', deleteTempEmail);

module.exports = router;

