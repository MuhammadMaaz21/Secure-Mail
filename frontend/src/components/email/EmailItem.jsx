import React from 'react';
import { formatTimestamp } from '../../utils/formatTimestamp';
import { CheckCircle, Clock, XCircle, RotateCw, Shield, AlertTriangle, LockKeyhole, Timer } from 'lucide-react';

export default function EmailItem({ email, onClick, isSelected = false, folder = 'inbox', onRetry }) {
  // Handle both API format and dummy data format
  const isRead = email.isRead !== undefined ? !email.isRead : email.unread;
  const senderName = email.senderName || email.senderEmail || email.sender || 'Unknown';
  const senderEmail = email.senderEmail || email.sender || '';
  const timestamp = email.createdAt || email.timestamp;
  const isImportant = email.isImportant || email.important;
  const isSpam = email.isSpam || email.spam;
  const isPhishing = email.isPhishing || email.phishing;
  const isEncrypted = email.isEncrypted || false;
  const deliveryStatus = email.deliveryStatus; // pending, delivered, failed
  const aiAnalysis = email.aiAnalysis; // AI analysis results
  const hasSelfDestruct = (email.selfDestructTimer && email.selfDestructTimer !== 'none') || email.selfDestructAt;
  
  // For sent emails, show recipient instead of sender
  const displayName = folder === 'sent' 
    ? (email.to && email.to.length > 0 ? email.to[0] : 'Unknown')
    : senderName;
  const displayEmail = folder === 'sent'
    ? (email.to && email.to.length > 0 ? email.to[0] : '')
    : senderEmail;
  
  // Create snippet from body if snippet doesn't exist
  const snippet = email.snippet || (email.body ? email.body.substring(0, 100) + '...' : '');

  const handleRetryClick = (e) => {
    e.stopPropagation(); // Prevent email selection
    if (onRetry) {
      onRetry(email);
    }
  };

  const getDeliveryStatusBadge = () => {
    if (folder !== 'sent' || !deliveryStatus) return null;

    switch (deliveryStatus) {
      case 'delivered':
        return (
          <span className="px-2 py-0.5 bg-green-500 text-xs rounded-full text-white whitespace-nowrap flex items-center gap-1">
            <CheckCircle size={12} />
            Delivered
          </span>
        );
      case 'failed':
        return (
          <span className="px-2 py-0.5 bg-red-500 text-xs rounded-full text-white whitespace-nowrap flex items-center gap-1">
            <XCircle size={12} />
            Failed
          </span>
        );
      case 'pending':
        return (
          <span className="px-2 py-0.5 bg-yellow-500 text-xs rounded-full text-white whitespace-nowrap flex items-center gap-1">
            <Clock size={12} />
            Pending
          </span>
        );
      default:
        return null;
    }
  };

  // Generate avatar initials
  const getAvatarInitials = (name) => {
    if (!name) return 'U';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  // Generate avatar color based on name
  const getAvatarColor = (name) => {
    const colors = [
      'bg-gradient-to-br from-blue-400 to-blue-600',
      'bg-gradient-to-br from-purple-400 to-purple-600',
      'bg-gradient-to-br from-pink-400 to-pink-600',
      'bg-gradient-to-br from-green-400 to-green-600',
      'bg-gradient-to-br from-orange-400 to-orange-600',
      'bg-gradient-to-br from-indigo-400 to-indigo-600',
    ];
    const index = name ? name.charCodeAt(0) % colors.length : 0;
    return colors[index];
  };

  return (
    <div
      className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all duration-200 ${
        isSelected
          ? 'bg-green-50 border border-green-200'
          : 'bg-white hover:bg-gray-50 border border-transparent'
      }`}
      onClick={onClick}
    >
      {/* Avatar */}
      <div className={`w-10 h-10 rounded-full ${getAvatarColor(displayName)} flex items-center justify-center text-white font-semibold text-sm flex-shrink-0`}>
        {getAvatarInitials(displayName)}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="flex-1 min-w-0">
            <div className={`text-sm font-semibold truncate ${isSelected ? 'text-textDark' : 'text-textDark'}`}>
              {displayName}
            </div>
          </div>
          <span className="text-xs text-textLight whitespace-nowrap flex-shrink-0">
            {formatTimestamp(timestamp)}
          </span>
        </div>
        
        <div className="mb-1">
          <div className={`text-sm truncate ${!isRead ? 'font-semibold text-textDark' : 'text-textDark'}`}>
            {email.subject}
          </div>
        </div>
        
        <div className="text-xs text-textLight truncate mb-1">
          {snippet}
        </div>

        {/* Tags */}
        <div className="flex items-center gap-2 flex-wrap">
          {isEncrypted && (
            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-medium border border-blue-200 inline-flex items-center gap-1">
              <LockKeyhole size={12} />
              Encrypted
            </span>
          )}
          {email.isDisposable && (
            <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded text-xs font-medium border border-purple-200">
              Disposable
            </span>
          )}
          {isImportant && !isSpam && !isPhishing && (
            <span className="px-2 py-0.5 bg-blue-500 text-xs rounded-full text-white whitespace-nowrap inline-flex items-center gap-1">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              Important
            </span>
          )}
          {isSpam && (
            <span className="px-2 py-0.5 bg-yellow-500 text-xs rounded-full text-white whitespace-nowrap">
              Spam
            </span>
          )}
          {isPhishing && (
            <span className="px-2 py-0.5 bg-red-600 text-xs rounded-full text-white whitespace-nowrap">
              Phishing
            </span>
          )}
          {hasSelfDestruct && (
            <span className="px-2 py-0.5 bg-orange-500 text-xs rounded-full text-white whitespace-nowrap inline-flex items-center gap-1">
              <Timer size={12} />
              Self-Destruct
            </span>
          )}
          {folder === 'sent' && getDeliveryStatusBadge()}
          {folder === 'sent' && deliveryStatus === 'failed' && (
            <button
              onClick={handleRetryClick}
              className="p-1 hover:bg-primary/10 rounded transition-colors"
              title="Retry sending"
            >
              <RotateCw size={14} className="text-primary" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
