/**
 * Pre-download the AI threat-detection models so the first email send is fast
 * and the app can then run fully offline.
 *
 * Usage:   npm run setup:ai
 *
 * The models are cached in backend/.models and only need to be downloaded once.
 * If you are on a network with an intercepting proxy and the download fails
 * with a certificate error, run:
 *     NODE_TLS_REJECT_UNAUTHORIZED=0 npm run setup:ai
 */

const { analyzeEmailAI, PHISHING_MODEL, SPAM_MODEL } = require('../src/utils/aiClassifier');

(async () => {
  console.log('Downloading AI models (one-time):');
  console.log('  -', PHISHING_MODEL);
  console.log('  -', SPAM_MODEL);
  console.log('This may take a few minutes the first time...\n');

  const result = await analyzeEmailAI({
    subject: 'Test',
    body: 'This is a test email to trigger the model download.',
    senderEmail: 'test@example.com',
  });

  if (result.source === 'ai-model') {
    console.log('\n✅ AI models downloaded and working. The app will now use real AI threat detection.');
    process.exit(0);
  } else {
    console.error('\n❌ Could not load the AI models (the app will fall back to the basic analyzer).');
    console.error('   Check your internet connection, or retry with NODE_TLS_REJECT_UNAUTHORIZED=0 npm run setup:ai');
    process.exit(1);
  }
})().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
