import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Reply, Forward, Trash2, Shield, AlertTriangle, CheckCircle, ImageOff } from 'lucide-react';
import { formatTimestamp } from '../../utils/formatTimestamp';
import api from '../../api/api';
import { toast } from '../../utils/toast';
import { getSettings } from '../../utils/settings';
import AiThreatAnalysis from '../../components/email/AiThreatAnalysis';

export default function EmailDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [email, setEmail] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [isMarkingSpam, setIsMarkingSpam] = React.useState(false);
  const [disableExternalImages, setDisableExternalImages] = React.useState(false);
  const [settingsLoaded, setSettingsLoaded] = React.useState(false);

  // Load settings
  React.useEffect(() => {
    const loadSettings = async () => {
      const settings = await getSettings();
      setDisableExternalImages(settings.disableExternalImages || false);
      setSettingsLoaded(true);
    };
    loadSettings();
  }, []);

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

  React.useEffect(() => {
    const fetchEmail = async () => {
      if (!id) return;
      
      try {
        setLoading(true);
        const response = await api.get(`/email/${id}`);
        if (response.data.success) {
          setEmail(response.data.data);
        } else {
          toast.error('Email not found');
          navigate('/inbox');
        }
      } catch (error) {
        console.error('Error fetching email:', error);
        // If email is not found (404), it was likely deleted
        if (error.response?.status === 404) {
          toast.error('Email not found or has been deleted');
        } else {
        toast.error('Failed to load email');
        }
        navigate('/inbox');
      } finally {
        setLoading(false);
      }
    };

    fetchEmail();
  }, [id, navigate]);

  const handleReply = () => {
    navigate('/compose', { state: { replyTo: email } });
  };

  const handleForward = () => {
    navigate('/compose', { state: { forward: email } });
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this email?')) {
      return;
    }

    try {
      const response = await api.delete(`/email/${email._id}`);
      if (response.data.success) {
        toast.success('Email moved to trash');
        // Trigger refresh event for inbox
        window.dispatchEvent(new Event('refreshInbox'));
        // Navigate to inbox - the list will refresh automatically
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

  const handleMarkSpam = async () => {
    setIsMarkingSpam(true);
    try {
      const response = await api.post(`/email/${email._id}/spam`);
      if (response.data.success) {
        toast.success('Email marked as spam');
        // Update local state
        setEmail({ ...email, isSpam: true, folder: 'spam' });
      } else {
        throw new Error(response.data.message || 'Failed to mark email as spam');
      }
    } catch (error) {
      console.error('Error marking email as spam:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to mark email as spam';
      toast.error(errorMessage);
    } finally {
      setIsMarkingSpam(false);
    }
  };

  if (loading) {
    return (
      <div className="glass p-6 rounded-xl min-h-[60vh] backdrop-blur-md bg-white/80">
        <div className="text-center py-12">
          <p className="text-textDark text-lg">Loading email...</p>
        </div>
      </div>
    );
  }

  if (!email) {
    return (
      <div className="glass p-6 rounded-xl min-h-[60vh] backdrop-blur-md bg-white/80">
        <button
          onClick={() => navigate('/inbox')}
          className="flex items-center gap-2 text-primary hover:text-primaryDark mb-4 transition-colors"
        >
          <ArrowLeft size={20} />
          <span>Back to Inbox</span>
        </button>
        <div className="text-center py-12">
          <p className="text-textDark text-lg mb-2">Email not found</p>
          <p className="text-textLight">The email you're looking for doesn't exist.</p>
        </div>
      </div>
    );
  }

  // Handle both API format and dummy data format
  const senderName = email.senderName || email.senderEmail || email.sender || 'Unknown';
  const senderEmail = email.senderEmail || email.sender || '';
  const timestamp = email.createdAt || email.timestamp;
  const isImportant = email.isImportant || email.important;
  const isSpam = email.isSpam || email.spam;
  const isPhishing = email.isPhishing || email.phishing;
  const recipients = email.to || [];
  const ccRecipients = email.cc || [];
  const bccRecipients = email.bcc || [];

  // Get current user email from localStorage (for recipients display)
  const currentUserEmail = localStorage.getItem('userEmail') || 'user@securemail.com';

  // Check if email has expired
  const isExpired = email.isExpired || (email.selfDestructAt && new Date() >= new Date(email.selfDestructAt));

  // If expired, show expired message
  if (isExpired) {
    return (
      <div className="glass p-4 md:p-6 rounded-xl min-h-[60vh] backdrop-blur-md bg-white/80">
        <button
          onClick={() => navigate('/inbox')}
          className="flex items-center gap-2 text-primary hover:text-primaryDark mb-6 transition-colors"
        >
          <ArrowLeft size={20} />
          <span>Back to Inbox</span>
        </button>
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

  return (
    <div className="glass p-4 md:p-6 rounded-xl min-h-[60vh] backdrop-blur-md bg-white/80">
      {/* Header with Back Button */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/inbox')}
          className="flex items-center gap-2 text-primary hover:text-primaryDark mb-4 transition-colors"
        >
          <ArrowLeft size={20} />
          <span>Back to Inbox</span>
        </button>
      </div>

      {/* Email Header */}
      <div className="mb-8 pb-6 border-b border-gray-200">
        <div className="flex items-start justify-between gap-4 mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-primary pr-4 flex-1 leading-tight">{email.subject}</h1>
          <div className="flex gap-2 flex-shrink-0 flex-wrap">
            {isImportant && !isSpam && !isPhishing && (
              <span className="px-3 py-1.5 bg-primary/10 text-primary text-xs rounded-lg font-semibold flex items-center gap-1 border border-primary/20">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                Important
              </span>
            )}
            {isSpam && (
              <span className="px-3 py-1.5 bg-yellow-50 text-yellow-700 text-xs rounded-lg font-semibold border border-yellow-200">
                Spam
              </span>
            )}
            {isPhishing && (
              <span className="px-3 py-1.5 bg-red-50 text-red-700 text-xs rounded-lg font-semibold border border-red-200">
                Phishing
              </span>
            )}
          </div>
        </div>

        {/* Sender, Recipients, Time */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <span className="text-sm font-semibold text-textDark min-w-[60px]">From:</span>
            <span className="text-sm text-textDark">{senderName}</span>
            <span className="text-xs text-textLight">({senderEmail})</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <span className="text-sm font-semibold text-textDark min-w-[60px]">To:</span>
            <span className="text-sm text-textDark">{recipients.length > 0 ? recipients.join(', ') : currentUserEmail}</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <span className="text-sm font-semibold text-textDark min-w-[60px]">Date:</span>
            <span className="text-sm text-textLight">{formatTimestamp(timestamp)}</span>
            <span className="text-xs text-textLight">
              ({new Date(timestamp).toLocaleString()})
            </span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mb-6 flex flex-wrap gap-3">
        <button
          onClick={handleReply}
          className="flex items-center gap-2 px-4 py-2 bg-white/80 hover:bg-white text-textDark rounded-lg border border-gray-200 transition-all hover:shadow-md"
        >
          <Reply size={18} />
          <span>Reply</span>
        </button>
        <button
          onClick={handleForward}
          className="flex items-center gap-2 px-4 py-2 bg-white/80 hover:bg-white text-textDark rounded-lg border border-gray-200 transition-all hover:shadow-md"
        >
          <Forward size={18} />
          <span>Forward</span>
        </button>
        <button
          onClick={handleDelete}
          className="flex items-center gap-2 px-4 py-2 bg-white/80 hover:bg-red-50 text-red-600 rounded-lg border border-red-200 transition-all hover:shadow-md"
        >
          <Trash2 size={18} />
          <span>Delete</span>
        </button>
        {!isSpam && (
          <button
            onClick={handleMarkSpam}
            disabled={isMarkingSpam}
            className="flex items-center gap-2 px-4 py-2 bg-white/80 hover:bg-yellow-50 text-yellow-700 rounded-lg border border-yellow-200 transition-all hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Shield size={18} />
            <span>{isMarkingSpam ? 'Marking...' : 'Mark as Spam'}</span>
          </button>
        )}
      </div>

      {/* AI Threat Analysis Section */}
      {email.aiAnalysis && (
        <div className="mb-6">
          <AiThreatAnalysis aiAnalysis={email.aiAnalysis} />
        </div>
      )}

      {disableExternalImages && (
        <div className="mb-4 p-3 bg-blue-50/50 border border-blue-200 rounded-lg flex items-center gap-2 text-sm text-blue-800">
          <ImageOff size={16} />
          <span>External images are disabled for privacy protection</span>
        </div>
      )}

      {/* Email Body */}
      <div className="pt-4">
        <div className="prose max-w-none">
          {settingsLoaded ? (
            <div 
              className="text-textDark whitespace-pre-wrap leading-relaxed text-base"
              dangerouslySetInnerHTML={{ 
                __html: disableExternalImages 
                  ? processEmailBody(email.body || email.snippet) 
                  : (email.body || email.snippet) 
              }}
            />
          ) : (
            <div className="text-textDark whitespace-pre-wrap leading-relaxed text-base">
              {email.body || email.snippet}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
