/**
 * Quick test for the multi-signal AI threat detection.
 *
 * Usage:   npm run test:ai
 */

const { analyzeEmailAI } = require('../src/utils/aiClassifier');

const samples = [
  { label: 'chatgpt link (must be SAFE)', expected: 'safe', subject: 'Check this out', body: 'Hey, found a great tool, try it here: chatgpt.com . Let me know!' },
  { label: 'real phishing', expected: 'harmful', subject: 'Account suspended', body: 'Verify your password now at http://secure-paypa1.com or account closed.', senderEmail: 'support@paypal-secure.com' },
  { label: 'spam congratulations', expected: 'harmful', subject: 'Congratulations you WON', body: 'You have won a $1000 gift card. Claim your free prize now!' },
  { label: 'safe work email', expected: 'safe', subject: 'Project meeting tomorrow', body: 'Hi team, can we move the meeting to 3pm? Thanks Sarah' },
  { label: 'google docs link', expected: 'safe', subject: 'Doc', body: 'Here is the doc: https://docs.google.com/document/d/abc Thanks' },
];

(async () => {
  console.log('Running multi-signal AI test...\n');
  let correct = 0;

  for (const s of samples) {
    const r = await analyzeEmailAI(s);
    const harmful = r.threatLevel === 'phishing' || r.threatLevel === 'spam';
    const got = harmful ? 'harmful' : 'safe';
    const ok = got === s.expected ? '✅' : '❌';
    if (got === s.expected) correct++;

    console.log(`${ok} ${s.label}`);
    console.log(`   -> ${r.classification}/${r.threatLevel}  RISK ${r.riskScore}%  (spam ${r.spamProbability}% / phish ${r.phishingProbability}%)`);
    (r.reasons || []).forEach((x) => console.log(`      - ${x}`));
    console.log('');
  }

  console.log(`Score: ${correct}/${samples.length} correct.`);
})().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
