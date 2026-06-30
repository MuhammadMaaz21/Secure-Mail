/**
 * Sanitize user input to prevent XSS attacks
 */

const sanitizeHtml = (html) => {
  if (!html || typeof html !== 'string') {
    return '';
  }
  
  // Remove script tags and event handlers
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/on\w+='[^']*'/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/data:text\/html/gi, '');
};

const sanitizeText = (text) => {
  if (!text || typeof text !== 'string') {
    return '';
  }
  
  // Escape HTML entities
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
};

const sanitizeEmail = (email) => {
  if (!email || typeof email !== 'string') {
    return '';
  }
  
  // Remove any HTML tags and trim
  return email.replace(/<[^>]*>/g, '').trim();
};

module.exports = {
  sanitizeHtml,
  sanitizeText,
  sanitizeEmail
};

