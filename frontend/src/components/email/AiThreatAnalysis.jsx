import React from 'react';
import { Shield, AlertTriangle, CheckCircle, Link2, Paperclip, Star } from 'lucide-react';

const riskColors = {
  safe: { bg: 'bg-emerald-50/50', border: 'border-emerald-200', badge: 'bg-emerald-500', icon: 'text-emerald-600', iconBg: 'bg-emerald-100' },
  phishing: { bg: 'bg-red-50/50', border: 'border-red-200', badge: 'bg-red-600', icon: 'text-red-600', iconBg: 'bg-red-100' },
  spam: { bg: 'bg-amber-50/50', border: 'border-amber-200', badge: 'bg-amber-500', icon: 'text-amber-600', iconBg: 'bg-amber-100' },
  suspicious: { bg: 'bg-orange-50/50', border: 'border-orange-200', badge: 'bg-orange-500', icon: 'text-orange-600', iconBg: 'bg-orange-100' },
};

const threatLabels = {
  safe: 'Safe',
  phishing: 'Phishing',
  spam: 'Spam',
  suspicious: 'Suspicious',
};

export default function AiThreatAnalysis({ aiAnalysis, compact = false }) {
  if (!aiAnalysis) return null;

  const level = aiAnalysis.threatLevel || 'safe';
  const colors = riskColors[level] || riskColors.suspicious;
  const riskScore = aiAnalysis.riskScore ?? aiAnalysis.confidence ?? 0;
  const reasons = aiAnalysis.reasons || [];
  const links = aiAnalysis.links || [];
  const attachments = aiAnalysis.attachmentScan || [];

  return (
    <div className={`rounded-2xl shadow-sm border overflow-hidden ${colors.bg} ${colors.border}`}>
      <div className={compact ? 'p-4' : 'p-5'}>
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ${colors.iconBg}`}>
            {level === 'safe' ? (
              <CheckCircle className={colors.icon} size={22} />
            ) : (
              <AlertTriangle className={colors.icon} size={22} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <h3 className="text-base font-semibold text-gray-900">AI Threat Analysis</h3>
              <span className={`px-3 py-1 rounded-lg text-xs font-semibold text-white ${colors.badge}`}>
                {threatLabels[level] || 'Unknown'}
              </span>
              <span className="px-2 py-1 bg-white/80 text-gray-700 text-xs rounded-full font-medium border border-gray-200">
                {riskScore}% risk
              </span>
              {aiAnalysis.isImportant && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full font-medium">
                  <Star size={12} /> Important
                </span>
              )}
            </div>

            <p className="text-sm text-gray-700 leading-relaxed mb-3">
              {aiAnalysis.details}
            </p>

            {(aiAnalysis.spamProbability > 0 || aiAnalysis.phishingProbability > 0) && (
              <div className="flex flex-wrap gap-3 mb-3 text-xs text-gray-600">
                {aiAnalysis.phishingProbability > 0 && (
                  <span>Phishing language: <strong>{aiAnalysis.phishingProbability}%</strong></span>
                )}
                {aiAnalysis.spamProbability > 0 && (
                  <span>Spam language: <strong>{aiAnalysis.spamProbability}%</strong></span>
                )}
              </div>
            )}

            {reasons.length > 0 && (
              <ul className="text-xs text-gray-700 space-y-1 mb-3">
                {reasons.map((reason, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-gray-400 mt-0.5">•</span>
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            )}

            {links.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-semibold text-gray-800 mb-1 flex items-center gap-1">
                  <Link2 size={12} /> Links checked ({links.length})
                </p>
                <ul className="text-xs space-y-1">
                  {links.map((link, i) => (
                    <li key={i} className={`flex items-start gap-1.5 ${link.risk === 'safe' ? 'text-green-700' : link.risk === 'dangerous' ? 'text-red-700' : 'text-amber-700'}`}>
                      <span className="font-medium capitalize">[{link.risk}]</span>
                      <span>{link.reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {attachments.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-semibold text-gray-800 mb-1 flex items-center gap-1">
                  <Paperclip size={12} /> Attachments scanned ({attachments.length})
                </p>
                <ul className="text-xs space-y-1">
                  {attachments.map((file, i) => (
                    <li key={i} className={`flex items-start gap-1.5 ${file.risk === 'safe' ? 'text-green-700' : file.risk === 'dangerous' ? 'text-red-700' : 'text-amber-700'}`}>
                      <span className="font-medium capitalize">[{file.risk}]</span>
                      <span><strong>{file.name}</strong> — {file.reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="text-xs text-gray-500 pt-2 border-t border-gray-200/80">
              <p className="font-medium mb-1 flex items-center gap-1">
                <Shield size={11} /> Analysis includes:
              </p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>ML content analysis (transformer models)</li>
                <li>Link &amp; domain inspection</li>
                <li>Attachment file scan (content + extension)</li>
                <li>Sender domain verification</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
