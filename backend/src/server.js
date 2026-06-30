const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const cron = require('node-cron');
const connectDB = require('./config/db');
const { cleanupExpiredEmails, cleanupTrashEmails, cleanupExpiredTempEmails } = require('./jobs/emailCleanup');

// Load environment variables
dotenv.config();

// Connect to database
connectDB();

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Backend server is running!', status: 'ok' });
});

app.get('/api', (req, res) => {
  res.json({ message: 'API is running!', status: 'ok', endpoints: ['/api/auth', '/api/email', '/api/settings', '/api/vault', '/api/privacy'] });
});

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/email', require('./routes/emailRoutes'));
app.use('/api/settings', require('./routes/settingsRoutes'));
app.use('/api/vault', require('./routes/vaultRoutes'));
app.use('/api/privacy', require('./routes/privacyRoutes'));

// Error handling middleware
const errorHandler = require('./middleware/errorHandler');
app.use(errorHandler);

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

// Schedule email cleanup job to run every minute (only in production or when explicitly enabled)
if (process.env.ENABLE_EMAIL_CLEANUP !== 'false') {
  cron.schedule('* * * * *', async () => {
    try {
      await cleanupExpiredEmails();
    } catch (error) {
      console.error('[Cron Job] Error cleaning up expired emails:', error);
    }
  });
  console.log('[Cron Job] Email cleanup job scheduled to run every minute');
} else {
  console.log('[Cron Job] Email cleanup job disabled');
}

// Schedule trash cleanup job to run daily at 2 AM (permanently delete emails in trash for 30+ days)
if (process.env.ENABLE_EMAIL_CLEANUP !== 'false') {
  cron.schedule('0 2 * * *', async () => {
    try {
      await cleanupTrashEmails();
    } catch (error) {
      console.error('[Cron Job] Error cleaning up trash emails:', error);
    }
  });
  console.log('[Cron Job] Trash cleanup job scheduled to run daily at 2 AM');
} else {
  console.log('[Cron Job] Trash cleanup job disabled');
}

// Schedule temporary email cleanup job to run hourly (delete expired temporary email addresses)
if (process.env.ENABLE_EMAIL_CLEANUP !== 'false') {
  cron.schedule('0 * * * *', async () => {
    try {
      await cleanupExpiredTempEmails();
    } catch (error) {
      console.error('[Cron Job] Error cleaning up expired temporary emails:', error);
    }
  });
  console.log('[Cron Job] Temporary email cleanup job scheduled to run hourly');
} else {
  console.log('[Cron Job] Temporary email cleanup job disabled');
}
