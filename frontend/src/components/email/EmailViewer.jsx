import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatTimestamp } from '../../utils/formatTimestamp';
import { Shield, AlertTriangle, CheckCircle, ImageOff, Reply, Forward, Trash2, CheckCircle2, XCircle, Lock, LockKeyhole, X, Paperclip, Download, Timer } from 'lucide-react';
import { getSettings } from '../../utils/settings';
import api from '../../api/api';
import { toast } from '../../utils/toast';
import AiThreatAnalysis from './AiThreatAnalysis';

export default function EmailViewer({ email }) {
  const navigate = useNavigate();
  const [disableExternalImages, setDisableExternalImages] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [isEncrypted, setIsEncrypted] = useState(false);
  const [decryptedBody, setDecryptedBody] = useState(null);
  const [decryptedAttachments, setDecryptedAttachments] = useState([]);
  const [showDecryptModal, setShowDecryptModal] = useState(false);
  const [decryptPassword, setDecryptPassword] = useState('');
  const [decrypting, setDecrypting] = useState(false);
  const [decryptError, setDecryptError] = useState('');

  const handleReply = () => {
    if (email) {
      navigate('/compose', { state: { replyTo: email } });
    }
  };

  const handleForward = () => {
    if (email) {
      navigate('/compose', { state: { forward: email } });
    }
  };

  const handleDelete = async () => {
    if (!email || !email._id) return;
    
    if (!window.confirm('Are you sure you want to delete this email? It will be moved to trash.')) {
      return;
    }
    
    try {
      const response = await api.delete(`/email/${email._id}`);
      if (response.data.success) {
        toast.success('Email moved to trash');
        // Trigger refresh event for inbox
        window.dispatchEvent(new Event('refreshInbox'));
        // Navigate away - the Inbox component will refresh the list automatically
        navigate('/inbox');
      } else {
        throw new Error(response.data.message || 'Failed to delete email');
      }
    } catch (error) {
      console.error('Error deleting email:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to delete email';
      toast.error(errorMessage);
    }
  };

  const handleMoveToVault = async () => {
    if (!email || !email._id) return;
    try {
      const response = await api.post(`/vault/move/${email._id}`);
      if (response.data.success) {
        toast.success('Email moved to vault');
        // Trigger refresh event for inbox/sent
        window.dispatchEvent(new Event('refreshInbox'));
        // Navigate away - the component will refresh the list automatically
        navigate('/inbox');
      } else {
        throw new Error(response.data.message || 'Failed to move email to vault');
      }
    } catch (error) {
      console.error('Error moving email to vault:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to move email to vault';
      toast.error(errorMessage);
    }
  };

  const handleDecrypt = async () => {
    if (!email || !email._id || !decryptPassword.trim()) {
      setDecryptError('Password is required');
      return;
    }

    try {
      setDecrypting(true);
      setDecryptError('');
      
      const emailId = email._id.toString ? email._id.toString() : email._id;
      
      const response = await api.post(`/email/decrypt/${emailId}`, {
        password: decryptPassword
      });

      if (response.data.success) {
        setDecryptedBody(response.data.data.decryptedBody);
        // Store decrypted attachments if available
        if (response.data.data.decryptedAttachments && Array.isArray(response.data.data.decryptedAttachments)) {
          setDecryptedAttachments(response.data.data.decryptedAttachments);
        } else {
          setDecryptedAttachments([]);
        }
        setShowDecryptModal(false);
        setDecryptPassword('');
        
        // Check if keys were regenerated
        if (response.data.data.keysRegenerated) {
          toast.success('Encryption keys regenerated. Email decrypted successfully. Note: Old emails encrypted with previous keys may not be decryptable.');
        } else {
        toast.success('Email decrypted successfully');
        }
      } else {
        throw new Error(response.data.message || 'Failed to decrypt email');
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || 'Failed to decrypt email. Invalid password.';
      setDecryptError(errorMessage);
      toast.error('Failed to decrypt email');
    } finally {
      setDecrypting(false);
    }
  };

  const handleVerify = async () => {
    if (!email || !email._id || verifying) return;
    
    try {
      setVerifying(true);
      const response = await api.get(`/email/verify/${email._id}`);
      
      if (response.data.success) {
        const verified = response.data.data?.verified;
        setVerificationStatus({
          verified: verified,
          reason: response.data.data?.reason || (verified ? 'Email verified successfully' : 'Email verification failed'),
          timestamp: response.data.data?.timestamp || response.data.data?.emailTimestamp
        });
        
        if (verified) {
          toast.success('Email verified successfully');
        } else {
          toast.error('Email verification failed - email may have been tampered with');
        }
      } else {
        throw new Error(response.data.message || 'Verification failed');
      }
    } catch (error) {
      console.error('Error verifying email:', error);
      setVerificationStatus({
        verified: false,
        reason: error.response?.data?.message || error.message || 'Failed to verify email'
      });
      toast.error('Failed to verify email');
    } finally {
      setVerifying(false);
    }
  };

  useEffect(() => {
    const loadSettings = async () => {
      const settings = await getSettings();
      setDisableExternalImages(settings.disableExternalImages || false);
      setSettingsLoaded(true);
    };
    loadSettings();
  }, []);

  useEffect(() => {
    // Reset verification status when email changes
    setVerificationStatus(null);
    // Check if email is encrypted
    if (email?.isEncrypted) {
      setIsEncrypted(true);
      setDecryptedBody(null);
      setDecryptedAttachments([]);
      setShowDecryptModal(false);
    } else {
      setIsEncrypted(false);
      setDecryptedBody(null);
      setDecryptedAttachments([]);
    }
  }, [email?._id, email?.isEncrypted]);

  // Process email body to block external images if setting is enabled
  const processEmailBody = (body) => {
    if (!body || !disableExternalImages) return body;
    
    // Replace img tags with external URLs with a placeholder
    return body.replace(
      /<img[^>]+src=["'](https?:\/\/[^"']+)["'][^>]*>/gi,
      (match, url) => {
        return `<div style="padding: 20px; background: #f3f4f6; border: 1px solid #d1d5db; border-radius: 8px; text-align: center; margin: 10px 0;">
          <svg style="width: 48px; height: 48px; margin: 0 auto 10px; color: #6b7280;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p style="color: #6b7280; font-size: 14px; margin: 0;">External image blocked for privacy</p>
          <p style="color: #9ca3af; font-size: 12px; margin: 5px 0 0 0;">${url}</p>
        </div>`;
      }
    );
  };
  if (!email) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 h-full flex items-center justify-center text-textLight">
        <div className="text-center">
          <svg
            className="w-16 h-16 mx-auto mb-4 text-textLight/50"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <p className="text-lg">Select an email to view</p>
        </div>
      </div>
    );
  }

  // Check if email has expired
  const isExpired = email.isExpired || (email.selfDestructAt && new Date() >= new Date(email.selfDestructAt));
  const hasSelfDestruct = email.selfDestructTimer && email.selfDestructTimer !== 'none' || email.selfDestructAt;

  // If expired, show expired message
  if (isExpired) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 h-full overflow-y-auto p-6">
        <div className="text-center py-16">
          <div className="mb-6">
            <Shield className="mx-auto text-gray-400" size={64} />
          </div>
          <h2 className="text-2xl font-bold text-textDark mb-4">This email has self-destructed</h2>
          <p className="text-textLight mb-2">
            This email was set to self-destruct and has been automatically deleted.
          </p>
          {email.expiredAt && (
            <p className="text-sm text-textLight">
              Expired on: {new Date(email.expiredAt).toLocaleString()}
            </p>
          )}
        </div>
      </div>
    );
  }

  // Handle both API format and dummy data format with proper fallbacks
  const senderName = email?.senderName || email?.senderEmail || email?.sender || 'Unknown';
  const senderEmail = email?.senderEmail || email?.sender || '';
  const timestamp = email?.createdAt || email?.timestamp || new Date();
  const isImportant = email?.isImportant || email?.important || false;
  const isSpam = email?.isSpam || email?.spam || false;
  const isPhishing = email?.isPhishing || email?.phishing || false;
  const recipients = Array.isArray(email?.to) ? email.to : (email?.to ? [email.to] : []);
  const ccRecipients = Array.isArray(email?.cc) ? email.cc : (email?.cc ? [email.cc] : []);
  const bccRecipients = Array.isArray(email?.bcc) ? email.bcc : (email?.bcc ? [email.bcc] : []);

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
    <div className="h-full flex flex-col overflow-hidden bg-gray-50 rounded-lg">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-6 space-y-4">
        {/* Email Header Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 space-y-4">
            {/* Subject and Top Actions Row */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-semibold text-gray-900 mb-3 leading-tight">
                {email.subject}
              </h1>
                <div className="flex items-center gap-2 flex-wrap">
                {verificationStatus && (
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${
                    verificationStatus.verified
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-red-50 text-red-700 border-red-200'
                  }`}>
                    {verificationStatus.verified ? (
                      <>
                        <CheckCircle2 size={14} />
                        Verified
                      </>
                    ) : (
                      <>
                        <XCircle size={14} />
                        Tampered
                      </>
                    )}
                  </span>
                )}
                {isImportant && !isSpam && !isPhishing && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-700 rounded-lg text-xs font-medium border border-amber-200">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    Important
                  </span>
                )}
                {isSpam && (
                  <span className="px-2.5 py-1 bg-yellow-50 text-yellow-700 rounded-lg text-xs font-medium border border-yellow-200">
                    Spam
                  </span>
                )}
                  {isPhishing && (
                    <span className="px-2.5 py-1 bg-red-50 text-red-700 rounded-lg text-xs font-medium border border-red-200">
                      Phishing
                    </span>
                  )}
                  {email.isDisposable && (
                    <span className="px-2.5 py-1 bg-purple-50 text-purple-700 rounded-lg text-xs font-medium border border-purple-200">
                      Disposable Address
                    </span>
                  )}
                  {isEncrypted && (
                    <span className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium border border-blue-200 inline-flex items-center gap-1">
                      <LockKeyhole size={14} />
                      Encrypted
                    </span>
                  )}
                  {hasSelfDestruct && !isExpired && (
                    <span className="px-2.5 py-1 bg-orange-50 text-orange-700 rounded-lg text-xs font-medium border border-orange-200 inline-flex items-center gap-1">
                      <Timer size={14} />
                      Self-Destruct
                    </span>
                  )}
                </div>
                </div>
              
              {/* Action Buttons and Verify */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={handleVerify}
                  disabled={verifying}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 font-medium text-xs ${
                    verificationStatus?.verified === true
                      ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                      : verificationStatus?.verified === false
                      ? 'bg-red-500 text-white hover:bg-red-600'
                      : 'bg-[#4DD0E1] text-white hover:bg-[#3BC0D1]'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                  title={verifying ? 'Verifying...' : 'Verify Authenticity'}
                >
                  <Shield size={14} />
                  <span>{verifying ? 'Verifying...' : 'Verify Authenticity'}</span>
                </button>
                <div className="flex items-center gap-1 bg-gray-50 rounded-xl p-1 border border-gray-200">
              {email.folder !== 'vault' && !email.isVault && (
                <button
                  onClick={handleMoveToVault}
                      className="p-2 hover:bg-[#4DD0E1]/10 rounded-lg transition-all duration-200 text-[#4DD0E1] hover:text-[#3BC0D1]"
                  title="Move to Vault"
                >
                  <Lock size={18} />
                </button>
              )}
              <button
                onClick={handleReply}
                    className="p-2 hover:bg-white rounded-lg transition-all duration-200 text-gray-600 hover:text-gray-900"
                title="Reply"
              >
                <Reply size={18} />
              </button>
              <button
                onClick={handleForward}
                    className="p-2 hover:bg-white rounded-lg transition-all duration-200 text-gray-600 hover:text-gray-900"
                title="Forward"
              >
                <Forward size={18} />
              </button>
                  <button
                    onClick={handleDelete}
                    className="p-2 hover:bg-red-50 rounded-lg transition-all duration-200 text-gray-600 hover:text-red-600"
                    title="Delete"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>

            {/* Sender Info */}
            <div className="flex items-start gap-4 pt-4 border-t border-gray-100">
              <div className={`w-12 h-12 rounded-xl ${getAvatarColor(senderName)} flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 shadow-sm`}>
                {getAvatarInitials(senderName)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-sm font-semibold text-gray-900">{senderName}</span>
                  <span className="text-xs text-gray-500 font-medium">{formatTimestamp(timestamp)}</span>
                </div>
                <div className="text-sm text-gray-600 mb-2">{senderEmail}</div>
                {recipients.length > 0 && (
                  <div className="mb-2 text-sm">
                    <span className="text-gray-500 font-medium">To:</span>
                    <span className="text-gray-700 ml-2">{recipients.join(', ')}</span>
                  </div>
                )}
                {ccRecipients.length > 0 && (
                  <div className="mb-2 text-sm">
                    <span className="text-gray-500 font-medium">Cc:</span>
                    <span className="text-gray-700 ml-2">{ccRecipients.join(', ')}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* AI Threat Analysis Card */}
        {email.aiAnalysis && (
          <AiThreatAnalysis aiAnalysis={email.aiAnalysis} compact />
        )}

        {/* Email Body Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6">
            {disableExternalImages && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200/50 rounded-xl flex items-center gap-2 text-sm text-blue-800">
                <ImageOff size={18} className="text-blue-600" />
                <span className="font-medium">External images are disabled for privacy protection</span>
              </div>
            )}
            {isEncrypted && !decryptedBody ? (
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-8 text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-blue-500 rounded-xl flex items-center justify-center shadow-sm">
                  <LockKeyhole className="text-white" size={32} />
                </div>
                <h3 className="text-lg font-semibold text-blue-900 mb-2">This email is encrypted</h3>
                <p className="text-sm text-blue-700 mb-6 max-w-md mx-auto">
                  Enter your password to decrypt and view the email content.
                </p>
                <button
                  onClick={() => setShowDecryptModal(true)}
                  className="px-6 py-3 bg-[#4DD0E1] text-white rounded-xl font-semibold hover:bg-[#3BC0D1] transition-colors shadow-sm"
                >
                  Decrypt Email
                </button>
              </div>
            ) : (
              <div className="prose prose-gray max-w-none">
                {settingsLoaded ? (
                  <div 
                    className="text-gray-800 whitespace-pre-wrap leading-relaxed text-[15px]"
                    dangerouslySetInnerHTML={{ 
                      __html: disableExternalImages 
                        ? processEmailBody(decryptedBody || email.body || email.snippet) 
                        : (decryptedBody || email.body || email.snippet) 
                    }}
                  />
                ) : (
                  <div className="text-gray-800 whitespace-pre-wrap leading-relaxed text-[15px]">
                    {decryptedBody || email.body || email.snippet}
                  </div>
                )}
              </div>
            )}
            
            {/* Attachments Section */}
            {((email.attachments && email.attachments.length > 0) || (decryptedAttachments && decryptedAttachments.length > 0)) && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="flex items-center gap-2 mb-4">
                  <Paperclip size={18} className="text-gray-500" />
                  <h3 className="text-sm font-semibold text-gray-700">
                    Attachments ({(email.attachments?.length || 0) + (decryptedAttachments?.length || 0)})
                  </h3>
                </div>
                <div className="space-y-2">
                  {/* Regular attachments */}
                  {email.attachments && email.attachments.map((attachment, index) => {
                    const formatFileSize = (bytes) => {
                      if (bytes === 0) return '0 Bytes';
                      const k = 1024;
                      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
                      const i = Math.floor(Math.log(bytes) / Math.log(k));
                      return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
                    };
                    
                    const handleDownload = async () => {
                      try {
                        const emailId = email._id.toString ? email._id.toString() : email._id;
                        const response = await api.get(`/email/attachment/${emailId}/${index}`, {
                          responseType: 'blob' // Important: receive as blob
                        });
                        
                        // Create blob URL and trigger download
                        const blob = new Blob([response.data], { type: attachment.type || 'application/octet-stream' });
                        const url = window.URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = attachment.name;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        window.URL.revokeObjectURL(url);
                        toast.success('Attachment downloaded');
                      } catch (error) {
                        console.error('Error downloading attachment:', error);
                        toast.error('Failed to download attachment');
                      }
                    };
                    
                    return (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200 hover:bg-gray-100 transition-colors cursor-pointer"
                        onClick={handleDownload}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Paperclip size={18} className="text-blue-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {attachment.name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {formatFileSize(attachment.size || 0)} • {attachment.type || 'Unknown type'}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownload();
                          }}
                          className="p-2 hover:bg-blue-100 rounded-lg transition-colors text-blue-600 flex-shrink-0"
                          title="Download attachment"
                        >
                          <Download size={18} />
                        </button>
                      </div>
                    );
                  })}
                  
                  {/* Decrypted attachments */}
                  {decryptedAttachments && decryptedAttachments.map((attachment, index) => {
                    const formatFileSize = (bytes) => {
                      if (bytes === 0) return '0 Bytes';
                      const k = 1024;
                      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
                      const i = Math.floor(Math.log(bytes) / Math.log(k));
                      return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
                    };
                    
                    const handleDownload = () => {
                      try {
                        // Decrypted attachments come as base64 data
                        const base64Data = attachment.data || attachment.encrypted;
                        if (!base64Data) {
                          toast.error('Attachment data not available');
                          return;
                        }
                        
                        // Convert base64 to blob
                        const byteCharacters = atob(base64Data);
                        const byteNumbers = new Array(byteCharacters.length);
                        for (let i = 0; i < byteCharacters.length; i++) {
                          byteNumbers[i] = byteCharacters.charCodeAt(i);
                        }
                        const byteArray = new Uint8Array(byteNumbers);
                        const blob = new Blob([byteArray], { type: attachment.type || 'application/octet-stream' });
                        
                        // Create download link
                        const url = window.URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = attachment.name;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        window.URL.revokeObjectURL(url);
                        toast.success('Attachment downloaded');
                      } catch (error) {
                        console.error('Error downloading decrypted attachment:', error);
                        toast.error('Failed to download attachment');
                      }
                    };
                    
                    return (
                      <div
                        key={`decrypted-${index}`}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200 hover:bg-gray-100 transition-colors cursor-pointer"
                        onClick={handleDownload}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Paperclip size={18} className="text-blue-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {attachment.name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {formatFileSize(attachment.size || 0)} • {attachment.type || 'Unknown type'} • Decrypted
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownload();
                          }}
                          className="p-2 hover:bg-blue-100 rounded-lg transition-colors text-blue-600 flex-shrink-0"
                          title="Download attachment"
                        >
                          <Download size={18} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          </div>
        </div>
      </div>

      {/* Decrypt Modal */}
      {showDecryptModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="glass p-6 rounded-2xl backdrop-blur-md bg-white/90 shadow-xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <LockKeyhole className="text-[#4DD0E1]" size={24} />
                <h2 className="text-2xl font-bold text-primary">Decrypt Email</h2>
              </div>
              <button
                onClick={() => {
                  setShowDecryptModal(false);
                  setDecryptPassword('');
                  setDecryptError('');
                }}
                className="text-textLight hover:text-textDark transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <p className="text-textDark mb-4">
              Enter your account password to decrypt this encrypted email.
            </p>
            <p className="text-xs text-textLight mb-4">
              Note: If you changed your password after creating encryption keys, you may need to regenerate your keys.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-textDark mb-2">Password</label>
                <input
                  type="password"
                  value={decryptPassword}
                  onChange={(e) => {
                    setDecryptPassword(e.target.value);
                    setDecryptError('');
                  }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleDecrypt();
                    }
                  }}
                  className="w-full glass bg-white/90 px-4 py-3 rounded-xl border border-gray-200 text-textDark focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Enter your password"
                  autoFocus
                />
                {decryptError && (
                  <p className="mt-2 text-sm text-red-600">{decryptError}</p>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDecryptModal(false);
                    setDecryptPassword('');
                    setDecryptError('');
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDecrypt}
                  disabled={decrypting || !decryptPassword.trim()}
                  className="flex-1 px-4 py-2 bg-[#4DD0E1] text-white rounded-xl font-medium hover:bg-[#3BC0D1] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {decrypting ? 'Decrypting...' : 'Decrypt'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
