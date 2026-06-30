/**
 * Mock AI Analysis Module
 * Analyzes email content for spam, phishing, and tone detection
 * 
 * This is a mock implementation that uses keyword matching and pattern detection
 * In production, this would be replaced with actual ML/AI models
 */

// Spam keywords and patterns (aligned with classification keywords)
const spamKeywords = [
  'free', 'click here', 'limited time', 'act now', 'urgent', 'winner', 'congratulations',
  'prize', 'guaranteed', 'no risk', 'special offer', 'exclusive deal', 'save money',
  'make money', 'work from home', 'get rich', 'miracle', 'amazing', 'incredible',
  'once in a lifetime', 'don\'t miss out', 'order now', 'buy now', 'discount',
  'percent off', 'cash', 'loan', 'debt', 'credit', 'refinance',
  // Additional keywords from classification
  'win money', 'free gift', 'lottery', 'offer expires', 'click this link',
  'you won', 'claim now', 'exclusive offer', 'one time only'
];

// Phishing keywords and patterns
const phishingKeywords = [
  'verify your account', 'suspended', 'locked', 'expired', 'update your information',
  'confirm your identity', 'security alert', 'unauthorized access', 'click to verify',
  'account verification required', 'immediate action required', 'your account will be closed',
  'verify now', 'confirm now', 'urgent action', 'security breach', 'suspicious activity',
  'login required', 'password reset', 'account compromised', 'verify email', 'confirm email'
];

// Suspicious domains (common phishing patterns)
const suspiciousDomains = [
  'verify-', 'security-', 'account-', 'update-', 'confirm-', 'secure-', 'login-',
  'bank-', 'paypal-', 'amazon-', 'microsoft-', 'apple-', 'google-'
];

// Tone detection keywords
const toneKeywords = {
  professional: ['regards', 'sincerely', 'best regards', 'thank you', 'appreciate', 'please', 'would', 'could'],
  urgent: ['urgent', 'immediately', 'asap', 'right away', 'now', 'hurry', 'quickly', 'emergency'],
  friendly: ['hi', 'hello', 'hey', 'thanks', 'cheers', 'great', 'awesome', 'wonderful', 'happy'],
  aggressive: ['must', 'required', 'demand', 'immediately', 'failure', 'consequences', 'warn', 'threat'],
  suspicious: ['verify', 'confirm', 'suspended', 'locked', 'expired', 'unauthorized', 'breach']
};

/**
 * Analyze email content for spam probability
 * @param {string} subject - Email subject
 * @param {string} body - Email body
 * @param {string} senderEmail - Sender email address
 * @returns {number} Spam probability (0-100)
 */
const analyzeSpam = (subject, body, senderEmail) => {
  const text = `${subject} ${body}`.toLowerCase();
  let spamScore = 0;
  
  // Check for spam keywords
  spamKeywords.forEach(keyword => {
    if (text.includes(keyword.toLowerCase())) {
      spamScore += 5;
    }
  });
  
  // Check for excessive capitalization
  const capsRatio = (text.match(/[A-Z]/g) || []).length / text.length;
  if (capsRatio > 0.3) {
    spamScore += 10;
  }
  
  // Check for excessive exclamation marks
  const exclamationCount = (text.match(/!/g) || []).length;
  if (exclamationCount > 3) {
    spamScore += 5;
  }
  
  // Check for suspicious sender domain
  if (senderEmail) {
    const domain = senderEmail.split('@')[1] || '';
    suspiciousDomains.forEach(suspicious => {
      if (domain.includes(suspicious)) {
        spamScore += 15;
      }
    });
  }
  
  // Check for suspicious links (basic check)
  const linkCount = (text.match(/http/gi) || []).length;
  if (linkCount > 2) {
    spamScore += 5;
  }
  
  return Math.min(100, Math.max(0, spamScore));
};

/**
 * Analyze email content for phishing indicators
 * @param {string} subject - Email subject
 * @param {string} body - Email body
 * @param {string} senderEmail - Sender email address
 * @returns {boolean} True if phishing detected
 */
const analyzePhishing = (subject, body, senderEmail) => {
  const text = `${subject} ${body}`.toLowerCase();
  let phishingScore = 0;
  
  // Check for phishing keywords
  phishingKeywords.forEach(keyword => {
    if (text.includes(keyword.toLowerCase())) {
      phishingScore += 10;
    }
  });
  
  // Check for suspicious sender domain
  if (senderEmail) {
    const domain = senderEmail.split('@')[1] || '';
    suspiciousDomains.forEach(suspicious => {
      if (domain.includes(suspicious)) {
        phishingScore += 20;
      }
    });
    
    // Check for domain spoofing patterns
    const commonDomains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com'];
    const senderDomain = domain.toLowerCase();
    if (!commonDomains.includes(senderDomain) && senderDomain.includes('gmail') || 
        senderDomain.includes('yahoo') || senderDomain.includes('outlook')) {
      phishingScore += 30;
    }
  }
  
  // Check for urgent language combined with verification requests
  const hasUrgent = text.includes('urgent') || text.includes('immediately') || text.includes('asap');
  const hasVerify = text.includes('verify') || text.includes('confirm') || text.includes('update');
  if (hasUrgent && hasVerify) {
    phishingScore += 25;
  }
  
  return phishingScore >= 30; // Threshold for phishing detection
};

/**
 * Detect email tone
 * @param {string} subject - Email subject
 * @param {string} body - Email body
 * @returns {string} Detected tone
 */
const detectTone = (subject, body) => {
  const text = `${subject} ${body}`.toLowerCase();
  const toneScores = {
    professional: 0,
    urgent: 0,
    friendly: 0,
    aggressive: 0,
    suspicious: 0
  };
  
  // Count tone keywords
  Object.keys(toneKeywords).forEach(tone => {
    toneKeywords[tone].forEach(keyword => {
      if (text.includes(keyword.toLowerCase())) {
        toneScores[tone]++;
      }
    });
  });
  
  // Determine dominant tone
  let maxScore = 0;
  let detectedTone = 'professional'; // default
  
  Object.keys(toneScores).forEach(tone => {
    if (toneScores[tone] > maxScore) {
      maxScore = toneScores[tone];
      detectedTone = tone;
    }
  });
  
  // If no strong tone detected, default to professional
  if (maxScore === 0) {
    detectedTone = 'professional';
  }
  
  return detectedTone;
};

/**
 * Main AI analysis function
 * @param {Object} emailData - Email data object
 * @param {string} emailData.subject - Email subject
 * @param {string} emailData.body - Email body
 * @param {string} emailData.senderEmail - Sender email address
 * @returns {Object} Analysis results
 */
const analyzeEmail = (emailData) => {
  const { subject = '', body = '', senderEmail = '' } = emailData;
  
  const spamProbability = analyzeSpam(subject, body, senderEmail);
  const isPhishing = analyzePhishing(subject, body, senderEmail);
  const tone = detectTone(subject, body);
  
  // Determine threat level
  let threatLevel = 'safe';
  if (isPhishing) {
    threatLevel = 'phishing';
  } else if (spamProbability >= 50) {
    threatLevel = 'spam';
  } else if (spamProbability >= 30) {
    threatLevel = 'suspicious';
  }
  
  // Generate details
  const details = [];
  if (isPhishing) {
    details.push('Phishing indicators detected: suspicious sender domain and verification requests');
  }
  if (spamProbability >= 50) {
    details.push(`High spam probability (${spamProbability}%): multiple spam keywords detected`);
  } else if (spamProbability >= 30) {
    details.push(`Moderate spam indicators (${spamProbability}%)`);
  }
  if (tone === 'suspicious' || tone === 'aggressive') {
    details.push(`Tone analysis: ${tone} language patterns detected`);
  }
  
  return {
    threatLevel,
    confidence: Math.max(spamProbability, isPhishing ? 85 : 0),
    details: details.join('; ') || 'No threats detected. Email appears safe.',
    spamProbability,
    isPhishing,
    tone
  };
};

module.exports = {
  analyzeEmail,
  analyzeSpam,
  analyzePhishing,
  detectTone
};

