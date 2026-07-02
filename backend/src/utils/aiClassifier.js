/**
 * Multi-signal email threat analyzer.
 *
 * Combines ML content models, URL inspection, attachment scanning, and
 * sender checks into a single graduated risk score (never a flat 100%).
 */

const path = require('path');
const { detectTone } = require('./aiAnalysis');
const { analyzeUrls, TRUSTED_DOMAINS } = require('./urlAnalysis');
const { analyzeAttachments } = require('./attachmentAnalysis');

const PHISHING_MODEL = 'onnx-community/bert-finetuned-phishing-ONNX';
const SPAM_MODEL = 'onnx-community/tanaos-spam-detection-v1-ONNX';

/** ML models need ~1–2 GB RAM. Disabled in production/cloud to prevent OOM crashes. */
function shouldUseMlModels() {
  if (process.env.AI_USE_ML_MODELS === 'true') return true;
  if (process.env.AI_USE_ML_MODELS === 'false') return false;
  if (process.env.NODE_ENV === 'production') return false;
  if (process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID) return false;
  return true;
}

const PHISHING_THRESHOLD = 0.6;
const SPAM_THRESHOLD = 0.4;
const SUSPICIOUS_THRESHOLD = 0.3;

const importantKeywords = [
  'meeting', 'invoice', 'deadline', 'urgent', 'important', 'payment', 'contract',
  'interview', 'schedule', 'report', 'action required', 'project', 'application',
  'reminder', 'appointment', 'offer letter', 'salary',
];

let modelsPromise = null;

async function getModels() {
  if (!modelsPromise) {
    modelsPromise = (async () => {
      const { pipeline, env } = await import('@xenova/transformers');
      env.cacheDir = path.join(__dirname, '..', '..', '.models');
      env.allowRemoteModels = true;
      env.allowLocalModels = true;
      console.log('[AI] Loading email threat-detection models (first run downloads them once)...');
      const [phishing, spam] = await Promise.all([
        pipeline('text-classification', PHISHING_MODEL, { quantized: true }),
        pipeline('text-classification', SPAM_MODEL, { quantized: true }),
      ]);
      console.log('[AI] Email threat-detection models ready.');
      return { phishing, spam };
    })().catch((err) => {
      modelsPromise = null;
      throw err;
    });
  }
  return modelsPromise;
}

function scoreFor(results, label) {
  const hit = (Array.isArray(results) ? results : [results]).find((r) => r.label === label);
  return hit ? hit.score : 0;
}

function combine(...risks) {
  return 1 - risks.reduce((acc, r) => acc * (1 - Math.max(0, Math.min(1, r))), 1);
}

function analyzeSender(senderEmail) {
  const domain = (senderEmail || '').split('@')[1] || '';
  if (!domain) return { risk: 0, reason: null };
  const brands = ['paypal', 'google', 'microsoft', 'apple', 'amazon', 'bank', 'netflix', 'outlook'];
  const hit = brands.find((b) => domain.toLowerCase().includes(b));
  if (hit && !TRUSTED_DOMAINS.has(domain.toLowerCase())) {
    return { risk: 0.6, reason: `Sender domain "${domain}" imitates "${hit}"` };
  }
  return { risk: 0, reason: null };
}

async function runContentModels(text) {
  const { phishing, spam } = await getModels();
  const input = text.slice(0, 2000);
  const [phishingOut, spamOut] = await Promise.all([
    phishing(input, { topk: null }),
    spam(input, { topk: null }),
  ]);
  return {
    phishing: scoreFor(phishingOut, 'phishing'),
    spam: scoreFor(spamOut, 'spam'),
  };
}

async function analyzeEmailAI({ subject = '', body = '', senderEmail = '', attachments = [] } = {}) {
  const text = `${subject}\n\n${body}`.trim();

  const url = analyzeUrls(`${subject} ${body}`);
  const files = analyzeAttachments(attachments);
  const sender = analyzeSender(senderEmail);

  let content = { phishing: 0, spam: 0 };
  let source = 'multi-signal-light';
  if (text && shouldUseMlModels()) {
    source = 'ai-model';
    try {
      content = await runContentModels(text);
    } catch (err) {
      console.error('[AI] Content models unavailable, using links/files only:', err.message);
      source = 'heuristic-fallback';
    }
  } else if (text) {
    console.log('[AI] ML models skipped (cloud/light mode) — using link, attachment, and sender analysis');
  }

  const contentRisk = Math.max(content.phishing, content.spam * 0.9);

  let factor = 1.0;
  if (url.count > 0 && url.allTrusted && files.risk < 0.3 && sender.risk < 0.3) {
    factor = 0.25;
  } else if (url.count === 0 && files.risk < 0.3) {
    factor = 0.7;
  }
  const dampedContent = contentRisk * factor;

  let finalRisk = combine(dampedContent, url.risk * 0.9, files.risk, sender.risk * 0.8);

  if (files.risk >= 0.85) finalRisk = Math.max(finalRisk, 0.9);
  if (url.risk >= 0.85) finalRisk = Math.max(finalRisk, 0.82);
  finalRisk = Math.min(0.98, finalRisk);

  const hasStructuralThreat = files.risk >= 0.5 || url.risk >= 0.5 || sender.risk >= 0.5;
  const contentSpamDominant = content.spam >= content.phishing && content.spam >= 0.5;

  let classification = 'inbox';
  let threatLevel = 'safe';
  if (hasStructuralThreat && finalRisk >= PHISHING_THRESHOLD) {
    classification = 'phishing';
    threatLevel = 'phishing';
  } else if (finalRisk >= SPAM_THRESHOLD || contentSpamDominant) {
    classification = 'spam';
    threatLevel = 'spam';
  } else if (finalRisk >= PHISHING_THRESHOLD && content.phishing >= 0.5) {
    classification = 'phishing';
    threatLevel = 'phishing';
  } else if (finalRisk >= SUSPICIOUS_THRESHOLD) {
    threatLevel = 'suspicious';
  }

  let isImportant = false;
  if (threatLevel === 'safe') {
    const lower = text.toLowerCase();
    if (importantKeywords.some((k) => lower.includes(k))) {
      classification = 'important';
      isImportant = true;
    }
  }

  const reasons = [];
  if (source === 'ai-model') {
    if (url.count > 0 && url.allTrusted && files.risk < 0.3 && contentRisk >= 0.5) {
      reasons.push('Content looked promotional, but every link points to a trusted website — treated as safe');
    } else if (content.spam >= content.phishing && content.spam >= 0.5) {
      reasons.push(`Content reads like spam/promotional language (${Math.round(content.spam * 100)}%)`);
    } else if (content.phishing >= 0.5) {
      reasons.push(`Content reads like phishing/scam language (${Math.round(content.phishing * 100)}%)`);
    } else {
      reasons.push('Content language looks legitimate');
    }
  } else if (source === 'multi-signal-light') {
    reasons.push('Analyzed links, attachments, and sender domain (optimized for cloud hosting)');
  }
  url.links.forEach((l) => {
    if (l.risk !== 'low') reasons.push(`Link: ${l.reason}`);
  });
  files.files.forEach((f) => {
    reasons.push(`Attachment "${f.name}": ${f.reason}`);
  });
  if (sender.reason) reasons.push(sender.reason);

  const riskScore = Math.round(finalRisk * 100);
  let details;
  if (threatLevel === 'phishing') details = `Likely phishing/scam (${riskScore}% risk). ${reasons[0] || ''}`.trim();
  else if (threatLevel === 'spam') details = `Likely spam (${riskScore}% risk). ${reasons[0] || ''}`.trim();
  else if (threatLevel === 'suspicious') details = `Some risk signals found (${riskScore}% risk). Treat with caution.`;
  else if (isImportant) details = `No threats found (${riskScore}% risk). Looks like an important message.`;
  else details = `No threats found (${riskScore}% risk). Email appears safe.`;

  return {
    threatLevel,
    classification,
    confidence: riskScore,
    riskScore,
    details,
    reasons,
    spamProbability: Math.round(content.spam * 100),
    phishingProbability: Math.round(content.phishing * 100),
    isPhishing: classification === 'phishing',
    isSpam: classification === 'spam',
    isImportant,
    links: url.links,
    attachmentScan: files.files,
    tone: detectTone(subject, body),
    source,
  };
}

module.exports = { analyzeEmailAI, PHISHING_MODEL, SPAM_MODEL };
