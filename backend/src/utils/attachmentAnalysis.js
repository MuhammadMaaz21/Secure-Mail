/**
 * Attachment safety scan — reads file content and checks extensions
 * for executables, disguised files, and the EICAR test virus signature.
 */

const fs = require('fs');

const DANGEROUS_EXT = new Set([
  'exe', 'scr', 'bat', 'cmd', 'com', 'pif', 'vbs', 'vbe', 'js', 'jse',
  'jar', 'msi', 'ps1', 'wsf', 'wsh', 'hta', 'cpl', 'dll', 'sys', 'reg',
  'lnk', 'app', 'msc', 'gadget', 'scf', 'inf',
]);

const SUSPICIOUS_EXT = new Set([
  'docm', 'xlsm', 'pptm', 'dotm', 'xlam', 'iso', 'img', 'vhd', 'apk',
]);

const ARCHIVE_EXT = new Set(['zip', 'rar', '7z', 'gz', 'tar', 'cab', 'ace', 'bz2']);

const EICAR_SIGNATURE = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';

const RISK = { safe: 0.0, low: 0.1, suspicious: 0.5, dangerous: 0.9 };

function getExtensions(name) {
  const parts = (name || '').toLowerCase().split('.');
  return parts.slice(1);
}

function readHead(path, bytes = 8192) {
  try {
    if (!path || !fs.existsSync(path)) return null;
    const fd = fs.openSync(path, 'r');
    const buf = Buffer.alloc(bytes);
    const read = fs.readSync(fd, buf, 0, bytes, 0);
    fs.closeSync(fd);
    return buf.subarray(0, read);
  } catch {
    return null;
  }
}

function analyzeOne(att) {
  const name = att.name || att.originalname || 'file';
  const exts = getExtensions(name);
  const ext = exts[exts.length - 1] || '';

  const head = readHead(att.path);
  if (head) {
    const asText = head.toString('latin1');
    if (asText.includes(EICAR_SIGNATURE)) {
      return { name, risk: 'dangerous', score: RISK.dangerous, reason: 'MALWARE DETECTED — file contains the EICAR virus test signature' };
    }
    if (head.length >= 2 && head[0] === 0x4d && head[1] === 0x5a && !['exe', 'dll', 'msi', 'scr'].includes(ext)) {
      return { name, risk: 'dangerous', score: RISK.dangerous, reason: `File is actually a Windows program (disguised as ".${ext || 'unknown'}")` };
    }
  }

  if (exts.length >= 2 && DANGEROUS_EXT.has(ext)) {
    return { name, risk: 'dangerous', score: RISK.dangerous, reason: `Disguised executable (double extension ".${exts[exts.length - 2]}.${ext}")` };
  }

  if (DANGEROUS_EXT.has(ext)) {
    return { name, risk: 'dangerous', score: RISK.dangerous, reason: `Executable/script file (.${ext}) can run harmful code` };
  }

  if (SUSPICIOUS_EXT.has(ext)) {
    return { name, risk: 'suspicious', score: RISK.suspicious, reason: `${ext.endsWith('m') ? 'Macro-enabled document' : 'Disk image'} (.${ext}) can carry malware` };
  }

  if (ARCHIVE_EXT.has(ext)) {
    return { name, risk: 'low', score: RISK.low, reason: `Compressed archive (.${ext}) — contents not scanned` };
  }

  return { name, risk: 'safe', score: RISK.safe, reason: `Looks safe (.${ext || 'no extension'})` };
}

function analyzeAttachments(attachments = []) {
  const list = Array.isArray(attachments) ? attachments : [];
  const files = list.map(analyzeOne);
  const risk = files.reduce((m, f) => Math.max(m, f.score), 0);
  return { risk, files, count: files.length };
}

module.exports = { analyzeAttachments };
