import React, { useState, useMemo } from 'react';
import { Send, X, Paperclip, Clock, AlertCircle, Save, Lock } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../../api/api';
import { toast } from '../../utils/toast';

// Email validation function
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
};

// Validate multiple emails (comma-separated)
const validateEmailList = (emailString) => {
  if (!emailString.trim()) return { valid: true, emails: [], errors: [] };
  
  const emails = emailString.split(',').map(e => e.trim()).filter(e => e);
  const errors = [];
  const validEmails = [];
  
  emails.forEach((email, index) => {
    if (validateEmail(email)) {
      validEmails.push(email);
    } else {
      errors.push('Invalid email');
    }
  });
  
  return {
    valid: errors.length === 0,
    emails: validEmails,
    errors: errors
  };
};

export default function Compose() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Check if this is a reply, forward, or draft
  const replyTo = location.state?.replyTo;
  const forward = location.state?.forward;
  const draft = location.state?.draft;
  
  // Simple draft ID tracking - one ID per compose session
  const [draftId, setDraftId] = useState(() => {
    if (draft?.id) return draft.id.toString();
    return null;
  });
  
  const [to, setTo] = useState(() => {
    if (draft?.to) {
      const toArray = Array.isArray(draft.to) ? draft.to : [draft.to];
      const filteredTo = toArray.filter(e => e && e !== 'draft@placeholder.local');
      return filteredTo.length > 0 ? filteredTo.join(', ') : '';
    }
    if (replyTo?.sender) return replyTo.sender;
    if (forward) return '';
    return '';
  });
  const [cc, setCc] = useState(() => {
    if (draft?.cc) {
      return Array.isArray(draft.cc) ? draft.cc.join(', ') : (draft.cc || '');
    }
    return '';
  });
  const [bcc, setBcc] = useState(() => {
    if (draft?.bcc) {
      return Array.isArray(draft.bcc) ? draft.bcc.join(', ') : (draft.bcc || '');
    }
    return '';
  });
  const [subject, setSubject] = useState(() => {
    if (draft?.subject && draft.subject !== '(No subject)') return draft.subject;
    if (replyTo?.subject) return `Re: ${replyTo.subject}`;
    if (forward?.subject) return `Fwd: ${forward.subject}`;
    return '';
  });
  const [body, setBody] = useState(() => {
    if (draft?.body && draft.body !== '(No content)') return draft.body;
    if (replyTo) {
      return `\n\n--- Original Message ---\nFrom: ${replyTo.senderName || replyTo.sender}\nDate: ${new Date(replyTo.timestamp).toLocaleString()}\n\n${replyTo.body || replyTo.snippet}`;
    }
    if (forward) {
      return `\n\n--- Forwarded Message ---\nFrom: ${forward.senderName || forward.sender}\nDate: ${new Date(forward.timestamp).toLocaleString()}\nSubject: ${forward.subject}\n\n${forward.body || forward.snippet}`;
    }
    return '';
  });
  const [attachments, setAttachments] = useState([]);
  const [selfDestructTimer, setSelfDestructTimer] = useState(() => {
    if (draft?.selfDestructTimer) return draft.selfDestructTimer;
    return 'none';
  });
  const [encrypt, setEncrypt] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);

  // Load default self-destruct timer from settings
  React.useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await api.get('/settings');
        if (response.data.success && response.data.data.defaultSelfDestructTimer) {
          if (!draft?.selfDestructTimer) {
            setSelfDestructTimer(response.data.data.defaultSelfDestructTimer);
          }
        }
      } catch (error) {
        console.error('Error fetching settings:', error);
      } finally {
        setLoadingSettings(false);
      }
    };
    fetchSettings();
  }, []);

  // Simple Gmail-style draft saving
  const saveDraftTimerRef = React.useRef(null);
  const isUnmountingRef = React.useRef(false);
  const sendingRef = React.useRef(false);

  // Refs to store current form values for unmount save
  const formValuesRef = React.useRef({ to, cc, bcc, subject, body, draftId, selfDestructTimer, attachments });
  
  // Update refs whenever form values change
  React.useEffect(() => {
    formValuesRef.current = { to, cc, bcc, subject, body, draftId, selfDestructTimer, attachments };
  }, [to, cc, bcc, subject, body, draftId, selfDestructTimer, attachments]);

  // Save draft function - simple and reliable
  const saveDraft = React.useCallback(async (silent = false) => {
    if (sendingRef.current) {
      return;
    }
    
    // Don't save if form is completely empty
    if (!to.trim() && !subject.trim() && !body.trim()) {
      return;
    }

    // Prevent saving if already saving
    if (isSavingDraft) {
      return;
    }

      try {
        setIsSavingDraft(true);
      
      const toEmails = to.trim() ? to.split(',').map(e => e.trim()).filter(e => e) : [];
      const ccEmails = cc.trim() ? cc.split(',').map(e => e.trim()).filter(e => e) : [];
      const bccEmails = bcc.trim() ? bcc.split(',').map(e => e.trim()).filter(e => e) : [];

      const draftData = {
        draftId: draftId,
        to: toEmails,
        cc: ccEmails,
        bcc: bccEmails,
        subject: subject.trim() || '',
        body: body.trim() || '',
        attachments: attachments.map(f => ({ name: f.name, size: f.size, type: f.type })),
        selfDestructTimer: selfDestructTimer
      };

      const response = await api.post('/email/save-draft', draftData);
      
      if (response.data.success) {
        const returnedDraftId = response.data.data._id?.toString() || response.data.data.id?.toString();
        
        // Update draft ID if we got a new one
        if (returnedDraftId && returnedDraftId !== draftId) {
          setDraftId(returnedDraftId);
        }
        
        setLastSaved(new Date());
        if (!silent) {
          toast.success('Draft saved');
        }
      }
    } catch (error) {
      console.error('[SaveDraft] Error saving draft:', error);
      if (!silent) {
        toast.error('Failed to save draft');
      }
    } finally {
      setIsSavingDraft(false);
    }
  }, [to, cc, bcc, subject, body, selfDestructTimer, draftId, attachments, isSavingDraft]);

  // Auto-save on field changes (debounced 2 seconds)
  React.useEffect(() => {
    if (sendingRef.current) {
      return;
    }
    
    if (isLoading) {
      return;
    }
    
    // Don't auto-save if form is completely empty
    if (!to.trim() && !subject.trim() && !body.trim()) {
      return;
    }
    
    // Clear existing timer
    if (saveDraftTimerRef.current) {
      clearTimeout(saveDraftTimerRef.current);
    }

    // Set new timer
    saveDraftTimerRef.current = setTimeout(() => {
      if (!isUnmountingRef.current) {
        saveDraft(true);
      }
    }, 2000);

    return () => {
      if (saveDraftTimerRef.current) {
        clearTimeout(saveDraftTimerRef.current);
      }
    };
  }, [to, cc, bcc, subject, body, selfDestructTimer, isLoading, saveDraft]);

  // Helper function to save draft with current values
  const saveDraftOnUnmount = React.useCallback(() => {
    if (sendingRef.current) {
      return;
    }
    
    const currentValues = formValuesRef.current;
    
    // Save immediately if there's content
    if (currentValues.to?.trim() || currentValues.subject?.trim() || currentValues.body?.trim()) {
      const toEmails = currentValues.to?.trim() ? currentValues.to.split(',').map(e => e.trim()).filter(e => e) : [];
      const ccEmails = currentValues.cc?.trim() ? currentValues.cc.split(',').map(e => e.trim()).filter(e => e) : [];
      const bccEmails = currentValues.bcc?.trim() ? currentValues.bcc.split(',').map(e => e.trim()).filter(e => e) : [];

          const draftData = {
        draftId: currentValues.draftId,
            to: toEmails,
            cc: ccEmails,
            bcc: bccEmails,
        subject: (currentValues.subject || '').trim(),
        body: (currentValues.body || '').trim(),
        attachments: (currentValues.attachments || []).map(f => ({ name: f.name, size: f.size, type: f.type })),
        selfDestructTimer: currentValues.selfDestructTimer || 'none'
          };

      api.post('/email/save-draft', draftData)
        .then(response => {
          if (response.data.success && response.data.data) {
            const savedDraft = response.data.data;
            const returnedDraftId = savedDraft._id?.toString() || savedDraft.id?.toString();
            
            // Update draftId in the ref so it's available for next save
            if (returnedDraftId) {
              formValuesRef.current.draftId = returnedDraftId;
              }
            }
        })
        .catch(err => {
        });
        }
  }, []);

  // Save draft when tab becomes hidden (user switches tabs)
  React.useEffect(() => {
    const handleVisibilityChange = () => {
      if (sendingRef.current) return;
      
      if (document.hidden) {
        // Tab is now hidden, save draft
        saveDraftOnUnmount();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [saveDraftOnUnmount]);

  // Save draft on unmount (when leaving compose page)
  React.useEffect(() => {
    return () => {
      isUnmountingRef.current = true;
      
      // Clear any pending debounced save
      if (saveDraftTimerRef.current) {
        clearTimeout(saveDraftTimerRef.current);
        saveDraftTimerRef.current = null;
      }
      
      // Save draft on unmount
      saveDraftOnUnmount();
    };
  }, [saveDraftOnUnmount]);
  
  // Validation states
  const [toError, setToError] = useState('');
  const [ccError, setCcError] = useState('');
  const [bccError, setBccError] = useState('');
  const [touched, setTouched] = useState({
    to: false,
    cc: false,
    bcc: false,
    subject: false,
    body: false
  });

  // Debounce timers for validation
  const toValidationTimerRef = React.useRef(null);
  const ccValidationTimerRef = React.useRef(null);
  const bccValidationTimerRef = React.useRef(null);

  const handleToChange = (e) => {
    const value = e.target.value;
    setTo(value);
    
    // Clear previous timer
    if (toValidationTimerRef.current) {
      clearTimeout(toValidationTimerRef.current);
    }
    
    // Clear error while typing
    setToError('');
    
    // Only validate after user stops typing (debounced)
    if (value.trim()) {
      toValidationTimerRef.current = setTimeout(() => {
      const validation = validateEmailList(value);
      setToError(validation.valid ? '' : validation.errors.join(', '));
      }, 800); // Wait 800ms after user stops typing
    }
  };

  const handleToBlur = () => {
    setTouched({ ...touched, to: true });
    // Clear timer and validate immediately on blur
    if (toValidationTimerRef.current) {
      clearTimeout(toValidationTimerRef.current);
    }
    if (to.trim()) {
      const validation = validateEmailList(to);
      setToError(validation.valid ? '' : validation.errors.join(', '));
    }
  };

  const handleCcChange = (e) => {
    const value = e.target.value;
    setCc(value);
    
    // Clear previous timer
    if (ccValidationTimerRef.current) {
      clearTimeout(ccValidationTimerRef.current);
    }
    
    // Clear error while typing
    setCcError('');
    
    // Only validate after user stops typing (debounced)
    if (value.trim()) {
      ccValidationTimerRef.current = setTimeout(() => {
      const validation = validateEmailList(value);
      setCcError(validation.valid ? '' : validation.errors.join(', '));
      }, 800); // Wait 800ms after user stops typing
    }
  };

  const handleCcBlur = () => {
    setTouched({ ...touched, cc: true });
    // Clear timer and validate immediately on blur
    if (ccValidationTimerRef.current) {
      clearTimeout(ccValidationTimerRef.current);
    }
    if (cc.trim()) {
      const validation = validateEmailList(cc);
      setCcError(validation.valid ? '' : validation.errors.join(', '));
    }
  };

  const handleBccChange = (e) => {
    const value = e.target.value;
    setBcc(value);
    
    // Clear previous timer
    if (bccValidationTimerRef.current) {
      clearTimeout(bccValidationTimerRef.current);
    }
    
    // Clear error while typing
    setBccError('');
    
    // Only validate after user stops typing (debounced)
    if (value.trim()) {
      bccValidationTimerRef.current = setTimeout(() => {
      const validation = validateEmailList(value);
      setBccError(validation.valid ? '' : validation.errors.join(', '));
      }, 800); // Wait 800ms after user stops typing
    }
  };

  const handleBccBlur = () => {
    setTouched({ ...touched, bcc: true });
    // Clear timer and validate immediately on blur
    if (bccValidationTimerRef.current) {
      clearTimeout(bccValidationTimerRef.current);
    }
    if (bcc.trim()) {
      const validation = validateEmailList(bcc);
      setBccError(validation.valid ? '' : validation.errors.join(', '));
    }
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    
    // Validate file sizes (max 10MB per file)
    const maxSize = 10 * 1024 * 1024; // 10MB
    const invalidFiles = files.filter(file => file.size > maxSize);
    
    if (invalidFiles.length > 0) {
      toast.error(`Some files exceed the 10MB limit: ${invalidFiles.map(f => f.name).join(', ')}`);
      const validFiles = files.filter(file => file.size <= maxSize);
      if (validFiles.length > 0) {
        setAttachments([...attachments, ...validFiles]);
      }
    } else {
      // Validate file types (whitelist)
      const allowedTypes = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain', 'text/csv',
        'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ];
      
      const invalidTypes = files.filter(file => !allowedTypes.includes(file.type));
      if (invalidTypes.length > 0) {
        toast.error(`Some file types are not allowed: ${invalidTypes.map(f => f.name).join(', ')}`);
        const validFiles = files.filter(file => allowedTypes.includes(file.type));
        if (validFiles.length > 0) {
          setAttachments([...attachments, ...validFiles]);
        }
      } else {
        setAttachments([...attachments, ...files]);
      }
    }
    
    // Reset file input
    e.target.value = '';
  };

  const removeAttachment = (index) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    sendingRef.current = true;
    isUnmountingRef.current = true;
    
    const currentDraftId = draftId;
    setDraftId(null);
    formValuesRef.current.draftId = null;
    
    if (saveDraftTimerRef.current) {
      clearTimeout(saveDraftTimerRef.current);
      saveDraftTimerRef.current = null;
    }
    
    // Validate all fields
    const toValidation = validateEmailList(to);
    const ccValidation = cc.trim() ? validateEmailList(cc) : { valid: true, emails: [] };
    const bccValidation = bcc.trim() ? validateEmailList(bcc) : { valid: true, emails: [] };
    
    if (!to.trim()) {
      setToError('To field is required');
      setTouched({ ...touched, to: true });
      return;
    }
    
    if (!toValidation.valid) {
      setToError(toValidation.errors.join(', '));
      setTouched({ ...touched, to: true });
      return;
    }
    
    if (!ccValidation.valid) {
      setCcError(ccValidation.errors.join(', '));
      setTouched({ ...touched, cc: true });
      return;
    }
    
    if (!bccValidation.valid) {
      setBccError(bccValidation.errors.join(', '));
      setTouched({ ...touched, bcc: true });
      return;
    }
    
    if (!subject.trim()) {
      setTouched({ ...touched, subject: true });
      return;
    }
    
    if (!body.trim()) {
      setTouched({ ...touched, body: true });
      return;
    }
    
    // Validate self-destruct timer
    const validTimers = ['none', '1min', '5min', '1hour', '1day'];
    if (selfDestructTimer && !validTimers.includes(selfDestructTimer)) {
      toast.error('Invalid self-destruct timer value');
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Use FormData to send files
      const formData = new FormData();
      
      // Add email fields
      formData.append('to', JSON.stringify(toValidation.emails));
      formData.append('cc', JSON.stringify(ccValidation.emails));
      formData.append('bcc', JSON.stringify(bccValidation.emails));
      formData.append('subject', subject.trim());
      formData.append('body', body.trim());
      formData.append('selfDestructTimer', selfDestructTimer);
      formData.append('encrypt', encrypt ? 'true' : 'false'); // Convert boolean to string for FormData
      if (currentDraftId) {
        formData.append('draftId', currentDraftId);
      }
      
      // Add attachments (actual files)
      attachments.forEach((file) => {
        formData.append('attachments', file);
      });
      
      // Send with multipart/form-data content type
      const response = await api.post('/email/send', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      if (response.data.success) {
        setIsLoading(false);
        
        toast.success(`Email sent successfully to ${response.data.data.recipientsCount} recipient(s)!`);
        
        // Redirect to sent page after a short delay
        // Clear any pending auto-save by navigating away
        setTimeout(() => {
          navigate('/sent');
        }, 1000);
      } else {
        throw new Error(response.data.message || 'Failed to send email');
      }
    } catch (error) {
      console.error('Send email error:', error);
      let errorMessage = error.response?.data?.message || error.message || error.error?.message || 'Failed to send email. Please try again.';
      
      // If encryption error, provide helpful message
      if (error.response?.data?.error === 'EncryptionError' && error.response?.data?.recipientsWithoutKeys) {
        errorMessage = `Encryption failed: The following recipients need to generate encryption keys first: ${error.response.data.recipientsWithoutKeys.join(', ')}. They can do this in Settings > Security > End-to-End Encryption Keys.`;
      }
      
      toast.error(errorMessage);
      setIsLoading(false);
    }
  };

  const isFormValid = useMemo(() => {
    const toValidation = validateEmailList(to);
    const ccValidation = cc.trim() ? validateEmailList(cc) : { valid: true };
    const bccValidation = bcc.trim() ? validateEmailList(bcc) : { valid: true };
    
    return (
      to.trim() &&
      toValidation.valid &&
      ccValidation.valid &&
      bccValidation.valid &&
      subject.trim() &&
      body.trim()
    );
  }, [to, cc, bcc, subject, body]);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-shrink-0 glass p-4 md:p-6 rounded-xl backdrop-blur-md bg-white/80 mb-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-primary">Compose Email</h1>
          <button
            onClick={() => navigate('/dashboard')}
            className="text-textLight hover:text-textDark transition-colors"
          >
            <X size={24} />
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        <div className="glass p-4 md:p-6 rounded-xl backdrop-blur-md bg-white/80">
          <form onSubmit={handleSubmit} className="space-y-4">
        {/* To Field */}
        <div>
          <label className="block text-sm font-semibold text-textDark mb-2">
            To <span className="text-red-500">*</span>
            <span className="text-xs text-textLight font-normal ml-2">(comma-separated for multiple)</span>
          </label>
          <input
            type="text"
            value={to}
            onChange={handleToChange}
            onBlur={handleToBlur}
            placeholder="recipient@example.com, another@example.com"
            className={`w-full glass bg-white/90 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 transition-all border text-textDark placeholder:text-textLight/60 ${
              toError && touched.to
                ? 'border-red-400 ring-2 ring-red-200 focus:ring-red-400'
                : 'border-gray-200 focus:ring-primary focus:border-transparent'
            }`}
            required
          />
          {toError && touched.to && (
            <div className="flex items-center gap-1 mt-1 text-red-600 text-xs">
              <AlertCircle size={14} />
              <span>{toError}</span>
            </div>
          )}
        </div>

        {/* Cc Field */}
        <div>
          <label className="block text-sm font-semibold text-textDark mb-2">
            Cc
            <span className="text-xs text-textLight font-normal ml-2">(comma-separated for multiple)</span>
          </label>
          <input
            type="text"
            value={cc}
            onChange={handleCcChange}
            onBlur={handleCcBlur}
            placeholder="cc@example.com"
            className={`w-full glass bg-white/90 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 transition-all border text-textDark placeholder:text-textLight/60 ${
              ccError && touched.cc
                ? 'border-red-400 ring-2 ring-red-200 focus:ring-red-400'
                : 'border-gray-200 focus:ring-primary focus:border-transparent'
            }`}
          />
          {ccError && touched.cc && (
            <div className="flex items-center gap-1 mt-1 text-red-600 text-xs">
              <AlertCircle size={14} />
              <span>{ccError}</span>
            </div>
          )}
        </div>

        {/* Bcc Field */}
        <div>
          <label className="block text-sm font-semibold text-textDark mb-2">
            Bcc
            <span className="text-xs text-textLight font-normal ml-2">(comma-separated for multiple)</span>
          </label>
          <input
            type="text"
            value={bcc}
            onChange={handleBccChange}
            onBlur={handleBccBlur}
            placeholder="bcc@example.com"
            className={`w-full glass bg-white/90 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 transition-all border text-textDark placeholder:text-textLight/60 ${
              bccError && touched.bcc
                ? 'border-red-400 ring-2 ring-red-200 focus:ring-red-400'
                : 'border-gray-200 focus:ring-primary focus:border-transparent'
            }`}
          />
          {bccError && touched.bcc && (
            <div className="flex items-center gap-1 mt-1 text-red-600 text-xs">
              <AlertCircle size={14} />
              <span>{bccError}</span>
            </div>
          )}
        </div>

        {/* Subject Field */}
        <div>
          <label className="block text-sm font-semibold text-textDark mb-2">
            Subject <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => {
              setSubject(e.target.value);
              setTouched({ ...touched, subject: true });
            }}
            onBlur={() => setTouched({ ...touched, subject: true })}
            placeholder="Email subject"
            className={`w-full glass bg-white/90 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 transition-all border text-textDark placeholder:text-textLight/60 ${
              !subject.trim() && touched.subject
                ? 'border-red-400 ring-2 ring-red-200 focus:ring-red-400'
                : 'border-gray-200 focus:ring-primary focus:border-transparent'
            }`}
            required
          />
          {!subject.trim() && touched.subject && (
            <div className="flex items-center gap-1 mt-1 text-red-600 text-xs">
              <AlertCircle size={14} />
              <span>Subject is required</span>
            </div>
          )}
        </div>

        {/* Attachments */}
        <div>
          <label className="block text-sm font-semibold text-textDark mb-2">
            Attachments
          </label>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 px-4 py-2 bg-white/80 hover:bg-white text-textDark rounded-lg border border-gray-200 cursor-pointer transition-all hover:shadow-md">
              <Paperclip size={18} />
              <span>Add Files</span>
              <input
                type="file"
                multiple
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
            {attachments.length > 0 && (
              <span className="text-sm text-textLight">
                {attachments.length} file{attachments.length !== 1 ? 's' : ''} attached
              </span>
            )}
          </div>
          {attachments.length > 0 && (
            <div className="mt-2 space-y-2">
              {attachments.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-2 bg-white/60 rounded-lg border border-gray-200"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Paperclip size={16} className="text-textLight flex-shrink-0" />
                    <span className="text-sm text-textDark truncate">{file.name}</span>
                    <span className="text-xs text-textLight flex-shrink-0">
                      ({formatFileSize(file.size)})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeAttachment(index)}
                    className="text-red-600 hover:text-red-700 ml-2"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Security Options */}
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Self-Destruct Timer */}
          <div className="flex-1">
            <label className="block text-sm font-semibold text-textDark mb-2">
              <div className="flex items-center gap-2">
                <Clock size={16} />
                <span>Self-Destruct Timer</span>
              </div>
            </label>
            <select
              value={selfDestructTimer}
              onChange={(e) => setSelfDestructTimer(e.target.value)}
              className="w-full glass bg-white/90 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all border border-gray-200 text-textDark"
            >
              <option value="none">None</option>
              <option value="1min">1 Minute</option>
              <option value="5min">5 Minutes</option>
              <option value="1hour">1 Hour</option>
              <option value="1day">1 Day</option>
            </select>
            {selfDestructTimer !== 'none' && (
              <p className="text-xs text-textLight mt-1">
                This email will automatically delete after {selfDestructTimer === '1min' ? '1 minute' : 
                selfDestructTimer === '5min' ? '5 minutes' : 
                selfDestructTimer === '1hour' ? '1 hour' : '1 day'}
              </p>
            )}
          </div>

          {/* Encrypt Email Toggle */}
          <div className="flex-1">
            <label className="block text-sm font-semibold text-textDark mb-2">
              <div className="flex items-center gap-2">
                <Lock size={16} />
                <span>Encryption</span>
              </div>
            </label>
            <button
              type="button"
              onClick={() => setEncrypt(!encrypt)}
              className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl transition-colors font-medium ${
                encrypt
                  ? 'bg-[#4DD0E1] text-white hover:bg-[#3BC0D1]'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              title="Encrypt email with end-to-end encryption"
            >
              <Lock size={18} />
              <span>{encrypt ? 'Encrypted' : 'Not Encrypted'}</span>
            </button>
            {encrypt && (
              <p className="text-xs text-textLight mt-1">
                Email will be encrypted using recipient's public key
              </p>
            )}
          </div>
        </div>

        {/* Message Body */}
        <div>
          <label className="block text-sm font-semibold text-textDark mb-2">
            Message <span className="text-red-500">*</span>
          </label>
          <textarea
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              setTouched({ ...touched, body: true });
            }}
            onBlur={() => setTouched({ ...touched, body: true })}
            placeholder="Write your message here..."
            rows={12}
            className={`w-full glass bg-white/90 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 transition-all border text-textDark placeholder:text-textLight/60 resize-none ${
              !body.trim() && touched.body
                ? 'border-red-400 ring-2 ring-red-200 focus:ring-red-400'
                : 'border-gray-200 focus:ring-primary focus:border-transparent'
            }`}
            required
          />
          {!body.trim() && touched.body && (
            <div className="flex items-center gap-1 mt-1 text-red-600 text-xs">
              <AlertCircle size={14} />
              <span>Message body is required</span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 pt-4 items-center">
          <button
            type="button"
            onClick={() => saveDraft(false)}
            disabled={isSavingDraft}
            className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 bg-gray-500 text-white hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save size={18} />
            {isSavingDraft ? 'Saving...' : 'Save as Draft'}
          </button>
          {lastSaved && (
            <span className="text-xs text-textLight">
              Last saved: {lastSaved.toLocaleTimeString()}
            </span>
          )}
          <button
            type="submit"
            disabled={!isFormValid || isLoading}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all duration-300 ${
              !isFormValid || isLoading
                ? 'bg-gradient-to-r from-[#1FB8A0]/40 to-[#2CE4C6]/40 border-2 border-[#1FB8A0]/30 cursor-not-allowed text-white/70 shadow-md'
                : 'bg-gradient-to-r from-[#1FB8A0] to-[#2CE4C6] hover:from-[#2CE4C6] hover:to-[#1FB8A0] text-white shadow-lg hover:shadow-xl transform hover:-translate-y-0.5'
            }`}
          >
            <Send size={18} />
            {isLoading ? 'Sending...' : 'Send'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="px-6 py-3 rounded-xl font-semibold bg-gray-200 hover:bg-gray-300 text-textDark transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
        </div>
      </div>
    </div>
  );
}
