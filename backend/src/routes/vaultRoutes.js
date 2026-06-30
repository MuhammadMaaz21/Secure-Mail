const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const {
  setVaultPin,
  verifyVaultPin,
  getVaultEmails,
  moveToVault,
  removeFromVault,
  invalidateToken
} = require('../controllers/vaultController');

router.use(authenticate);

router.post('/set-pin', setVaultPin);
router.post('/verify-pin', verifyVaultPin);
router.post('/lock', invalidateToken);
router.get('/emails', getVaultEmails);
router.post('/move/:emailId', moveToVault);
router.post('/remove/:emailId', removeFromVault);

module.exports = router;

