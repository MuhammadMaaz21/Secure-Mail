/**
 * URL / link analysis — inspects every link for real phishing signals,
 * not keyword matching. Trusted domains (chatgpt.com, google.com, …) are
 * treated as safe to avoid false positives.
 */

const TRUSTED_DOMAINS = new Set([
  'google.com', 'gmail.com', 'youtube.com', 'chatgpt.com', 'openai.com',
  'microsoft.com', 'office.com', 'live.com', 'outlook.com', 'bing.com',
  'apple.com', 'icloud.com', 'amazon.com', 'aws.amazon.com',
  'facebook.com', 'instagram.com', 'whatsapp.com', 'linkedin.com',
  'twitter.com', 'x.com', 'github.com', 'gitlab.com', 'stackoverflow.com',
  'wikipedia.org', 'reddit.com', 'zoom.us', 'dropbox.com', 'slack.com',
  'netflix.com', 'spotify.com', 'paypal.com', 'cloudflare.com',
  'mozilla.org', 'medium.com', 'notion.so', 'figma.com', 'canva.com',
  'securemail.com',
]);

const IMPERSONATED_BRANDS = [
  'paypal', 'google', 'microsoft', 'apple', 'amazon', 'facebook', 'instagram',
  'netflix', 'outlook', 'office365', 'icloud', 'whatsapp', 'linkedin',
  'bank', 'hsbc', 'barclays', 'natwest', 'lloyds', 'dhl', 'fedex', 'ups',
  'usps', 'coinbase', 'binance', 'metamask',
];

const SHORTENERS = new Set([
  'bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly', 'is.gd', 'buff.ly',
  'rebrand.ly', 'cutt.ly', 'shorturl.at', 'rb.gy', 't.ly',
]);

const SUSPICIOUS_TLDS = new Set([
  'zip', 'mov', 'xyz', 'top', 'tk', 'ml', 'ga', 'cf', 'gq', 'country',
  'click', 'link', 'work', 'fit', 'review', 'kim', 'loan', 'win', 'bid',
]);

const RISK = { safe: 0.0, low: 0.15, suspicious: 0.5, dangerous: 0.85 };

function registrableDomain(host) {
  const labels = host.toLowerCase().split('.').filter(Boolean);
  if (labels.length <= 2) return labels.join('.');
  const secondLevel = ['co', 'com', 'org', 'gov', 'ac', 'edu', 'net'];
  const last = labels[labels.length - 1];
  const penultimate = labels[labels.length - 2];
  if (last.length === 2 && secondLevel.includes(penultimate)) {
    return labels.slice(-3).join('.');
  }
  return labels.slice(-2).join('.');
}

function extractUrls(text) {
  if (!text) return [];
  const noEmails = text.replace(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi, ' ');
  const regex = /\b((?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s)]*)?)/gi;
  const found = noEmails.match(regex) || [];
  return [...new Set(found.map((u) => u.trim()))];
}

function analyzeOne(raw) {
  let url = raw;
  if (!/^https?:\/\//i.test(url)) url = 'http://' + url;

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return { url: raw, domain: '', risk: 'suspicious', score: RISK.suspicious, reason: 'Malformed link' };
  }

  const host = parsed.hostname;
  const domain = registrableDomain(host);
  const tld = host.split('.').pop().toLowerCase();
  const isHttps = parsed.protocol === 'https:';

  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    return { url: raw, domain: host, risk: 'dangerous', score: RISK.dangerous, reason: `Uses a raw IP address (${host}) instead of a domain name` };
  }

  if (raw.includes('@')) {
    return { url: raw, domain, risk: 'dangerous', score: RISK.dangerous, reason: 'Link contains an "@" which can hide the real destination' };
  }

  if (host.includes('xn--')) {
    return { url: raw, domain, risk: 'dangerous', score: RISK.dangerous, reason: 'Internationalised (punycode) domain often used to spoof real sites' };
  }

  if (TRUSTED_DOMAINS.has(domain)) {
    return { url: raw, domain, risk: 'safe', score: RISK.safe, reason: `Trusted website (${domain})` };
  }

  const brandHit = IMPERSONATED_BRANDS.find((b) => host.includes(b));
  if (brandHit) {
    return { url: raw, domain, risk: 'dangerous', score: RISK.dangerous, reason: `Pretends to be "${brandHit}" but the real domain is ${domain}` };
  }

  if (SHORTENERS.has(domain)) {
    return { url: raw, domain, risk: 'suspicious', score: RISK.suspicious, reason: `Shortened link (${domain}) hides its real destination` };
  }

  if (SUSPICIOUS_TLDS.has(tld)) {
    return { url: raw, domain, risk: 'suspicious', score: RISK.suspicious, reason: `Uses a high-risk domain ending (.${tld})` };
  }

  const hyphens = (host.match(/-/g) || []).length;
  const subdomains = host.split('.').length;
  if (hyphens >= 3 || host.length > 40 || subdomains >= 5) {
    return { url: raw, domain, risk: 'suspicious', score: RISK.suspicious, reason: `Unusual domain structure (${host})` };
  }

  if (!isHttps) {
    return { url: raw, domain, risk: 'suspicious', score: RISK.suspicious, reason: `Not secure (http, not https): ${domain}` };
  }

  return { url: raw, domain, risk: 'low', score: RISK.low, reason: `External link (${domain})` };
}

function analyzeUrls(text) {
  const urls = extractUrls(text);
  const links = urls.map(analyzeOne);
  const risk = links.reduce((m, l) => Math.max(m, l.score), 0);
  const allTrusted = links.length > 0 && links.every((l) => l.risk === 'safe');
  return { risk, links, count: links.length, allTrusted };
}

module.exports = { analyzeUrls, extractUrls, TRUSTED_DOMAINS };
