import React, { useState, useEffect } from 'react';
import { Shield, Clock, Ban, ImageOff, X, Plus, Save, AlertCircle, Mail, Trash2, Copy } from 'lucide-react';
import api from '../../api/api';
import { toast } from '../../utils/toast';
import { clearSettingsCache } from '../../utils/settings';

export default function PrivacySettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    defaultSelfDestructTimer: 'none',
    blockedSenders: [],
    disableExternalImages: false,
    autoMarkSpam: true,
    autoMarkPhishing: true
  });
  const [newBlockedEmail, setNewBlockedEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [tempEmails, setTempEmails] = useState([]);
  const [loadingTempEmails, setLoadingTempEmails] = useState(false);
  const [creatingTempEmail, setCreatingTempEmail] = useState(false);
  const [expiresInHours, setExpiresInHours] = useState(24);

  // Fetch settings on mount
  useEffect(() => {
    fetchSettings();
    fetchTempEmails();
  }, []);

  const fetchTempEmails = async () => {
    try {
      setLoadingTempEmails(true);
      const response = await api.get('/privacy/temp-emails');
      if (response.data.success) {
        setTempEmails(response.data.data.emails || []);
      }
    } catch (error) {
      console.error('Error fetching temp emails:', error);
    } finally {
      setLoadingTempEmails(false);
    }
  };

  const handleCreateTempEmail = async () => {
    try {
      setCreatingTempEmail(true);
      const response = await api.post('/privacy/create-temp-email', {
        expiresInHours: parseInt(expiresInHours)
      });
      if (response.data.success) {
        toast.success('Disposable email created successfully');
        fetchTempEmails();
      } else {
        throw new Error(response.data.message || 'Failed to create disposable email');
      }
    } catch (error) {
      console.error('Error creating temp email:', error);
      toast.error(error.response?.data?.message || error.message || 'Failed to create disposable email');
    } finally {
      setCreatingTempEmail(false);
    }
  };

  const handleDeleteTempEmail = async (id) => {
    if (!window.confirm('Are you sure you want to delete this disposable email address?')) {
      return;
    }
    try {
      const response = await api.delete(`/privacy/temp-email/${id}`);
      if (response.data.success) {
        toast.success('Disposable email deleted successfully');
        fetchTempEmails();
      } else {
        throw new Error(response.data.message || 'Failed to delete disposable email');
      }
    } catch (error) {
      console.error('Error deleting temp email:', error);
      toast.error(error.response?.data?.message || error.message || 'Failed to delete disposable email');
    }
  };

  const handleCopyTempEmail = (email) => {
    navigator.clipboard.writeText(email);
    toast.success('Email address copied to clipboard');
  };

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await api.get('/settings');
      if (response.data.success && response.data.data) {
        // Ensure blockedSenders is always an array
        const settingsData = {
          ...response.data.data,
          blockedSenders: response.data.data.blockedSenders || []
        };
        setSettings(settingsData);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  };

  const handleAddBlockedSender = async () => {
    if (!newBlockedEmail.trim()) {
      setEmailError('Email address is required');
      return;
    }

    if (!validateEmail(newBlockedEmail)) {
      setEmailError('Invalid email address');
      return;
    }

    const normalizedEmail = newBlockedEmail.toLowerCase().trim();

    // Check if already blocked
    if (settings.blockedSenders && settings.blockedSenders.includes(normalizedEmail)) {
      setEmailError('This email is already blocked');
      return;
    }

    try {
      const response = await api.post('/settings/blocked-senders', {
        email: newBlockedEmail.trim()
      });

      if (response.data.success && response.data.data) {
        // Ensure blockedSenders is an array
        const updatedSettings = {
          ...response.data.data,
          blockedSenders: response.data.data.blockedSenders || []
        };
        setSettings(updatedSettings);
        setNewBlockedEmail('');
        setEmailError('');
        clearSettingsCache(); // Clear cache to reflect changes
        toast.success('Sender blocked successfully');
      } else {
        throw new Error(response.data.message || 'Failed to block sender');
      }
    } catch (error) {
      console.error('Error blocking sender:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to block sender';
      setEmailError(errorMessage);
      toast.error(errorMessage);
    }
  };

  const handleRemoveBlockedSender = async (email) => {
    try {
      const response = await api.delete('/settings/blocked-senders', {
        params: { email }
      });

      if (response.data.success && response.data.data) {
        // Ensure blockedSenders is an array
        const updatedSettings = {
          ...response.data.data,
          blockedSenders: response.data.data.blockedSenders || []
        };
        setSettings(updatedSettings);
        clearSettingsCache(); // Clear cache to reflect changes
        toast.success('Sender unblocked successfully');
      } else {
        throw new Error(response.data.message || 'Failed to unblock sender');
      }
    } catch (error) {
      console.error('Error unblocking sender:', error);
      toast.error('Failed to unblock sender');
    }
  };

  const handleToggle = async (field, value) => {
    const newSettings = { ...settings, [field]: value };
    setSettings(newSettings);
    
    try {
      const response = await api.put('/settings', {
        [field]: value
      });

      if (response.data.success) {
        setSettings(response.data.data);
        clearSettingsCache(); // Clear cache to reflect changes
        toast.success('Settings updated');
      } else {
        // Revert on error
        setSettings(settings);
        throw new Error(response.data.message || 'Failed to update settings');
      }
    } catch (error) {
      console.error('Error updating settings:', error);
      setSettings(settings); // Revert on error
      toast.error('Failed to update settings');
    }
  };

  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      const response = await api.put('/settings', {
        defaultSelfDestructTimer: settings.defaultSelfDestructTimer,
        disableExternalImages: settings.disableExternalImages,
        autoMarkSpam: settings.autoMarkSpam,
        autoMarkPhishing: settings.autoMarkPhishing
      });

      if (response.data.success) {
        setSettings(response.data.data);
        clearSettingsCache(); // Clear cache to reflect changes
        toast.success('Settings saved successfully');
      } else {
        throw new Error(response.data.message || 'Failed to save settings');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSelfDestructChange = (value) => {
    const newSettings = { ...settings, defaultSelfDestructTimer: value };
    setSettings(newSettings);
  };

  if (loading) {
    return (
      <div className="glass p-6 rounded-xl min-h-[60vh] backdrop-blur-md bg-white/80">
        <div className="text-center py-12">
          <p className="text-textDark text-lg">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass p-4 md:p-6 rounded-xl min-h-[60vh] backdrop-blur-md bg-white/80">
      <div className="space-y-6">
        {/* Disposable Email Addresses - Moved to top for visibility */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <Mail className="text-primary" size={20} />
            <h2 className="text-xl font-semibold text-textDark">Disposable Email Addresses</h2>
          </div>
          <div className="bg-white/50 p-4 rounded-lg space-y-4">
            <p className="text-sm text-textLight">
              Generate temporary email addresses for privacy. Emails sent to these addresses will appear in your inbox marked as "via disposable email".
            </p>
            
            {/* Generate Disposable Email */}
            <div className="flex flex-col sm:flex-row gap-3 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium text-textDark mb-2">Expires In (hours)</label>
                <input
                  type="number"
                  min="1"
                  max="720"
                  value={expiresInHours}
                  onChange={(e) => setExpiresInHours(e.target.value)}
                  className="w-full glass bg-white/90 px-4 py-2.5 rounded-xl border border-gray-200 text-textDark focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <button
                onClick={handleCreateTempEmail}
                disabled={creatingTempEmail}
                className="flex items-center gap-2 px-4 py-2.5 bg-[#4DD0E1] text-white rounded-xl hover:bg-[#3BC0D1] transition-colors font-medium disabled:opacity-50"
              >
                <Plus size={18} />
                <span>{creatingTempEmail ? 'Creating...' : 'Generate Disposable Email'}</span>
              </button>
            </div>

            {/* Active Disposable Emails List */}
            {loadingTempEmails ? (
              <div className="text-center py-4 text-textLight">Loading disposable emails...</div>
            ) : tempEmails.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-textDark">Active Disposable Email Addresses:</p>
                <div className="flex flex-col gap-2">
                  {tempEmails.map((tempEmail) => {
                    const expiresAt = new Date(tempEmail.expiresAt);
                    const isExpired = expiresAt < new Date();
                    const timeRemaining = expiresAt - new Date();
                    const hoursRemaining = Math.floor(timeRemaining / (1000 * 60 * 60));
                    const minutesRemaining = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
                    
                    return (
                      <div
                        key={tempEmail._id}
                        className="flex items-center justify-between bg-white/70 p-3 rounded-lg border border-gray-200"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-textDark font-medium truncate">{tempEmail.tempAddress}</span>
                            <button
                              onClick={() => handleCopyTempEmail(tempEmail.tempAddress)}
                              className="p-1 text-[#4DD0E1] hover:bg-[#4DD0E1]/10 rounded transition-colors"
                              title="Copy email address"
                            >
                              <Copy size={14} />
                            </button>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-textLight">
                            <span>Usage: {tempEmail.usageCount || 0} emails</span>
                            {!isExpired ? (
                              <span>Expires in: {hoursRemaining > 0 ? `${hoursRemaining}h ${minutesRemaining}m` : `${minutesRemaining}m`}</span>
                            ) : (
                              <span className="text-red-500">Expired</span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteTempEmail(tempEmail._id)}
                          className="text-red-500 hover:text-red-700 transition-colors p-1 ml-2"
                          title="Delete disposable email"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="text-sm text-textLight italic">No disposable email addresses created</p>
            )}
          </div>
        </section>

        {/* Default Self-Destruct Timer */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <Clock className="text-primary" size={20} />
            <h2 className="text-xl font-semibold text-textDark">Default Self-Destruct Timer</h2>
          </div>
          <div className="bg-white/50 p-4 rounded-lg">
            <p className="text-sm text-textLight mb-3">
              Set a default self-destruct timer for all outgoing emails. This can be overridden when composing.
            </p>
            <select
              value={settings.defaultSelfDestructTimer}
              onChange={(e) => handleSelfDestructChange(e.target.value)}
              className="w-full md:w-64 glass bg-white/90 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all border border-gray-200 text-textDark"
            >
              <option value="none">None</option>
              <option value="1min">1 Minute</option>
              <option value="5min">5 Minutes</option>
              <option value="1hour">1 Hour</option>
              <option value="1day">1 Day</option>
            </select>
          </div>
        </section>

        {/* Auto-Block Sender List */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <Ban className="text-primary" size={20} />
            <h2 className="text-xl font-semibold text-textDark">Blocked Senders</h2>
          </div>
          <div className="bg-white/50 p-4 rounded-lg space-y-4">
            <p className="text-sm text-textLight">
              Emails from blocked senders will be automatically moved to spam and hidden from your inbox.
            </p>
            
            {/* Add Blocked Sender */}
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex-1">
                <input
                  type="email"
                  value={newBlockedEmail}
                  onChange={(e) => {
                    setNewBlockedEmail(e.target.value);
                    setEmailError('');
                  }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleAddBlockedSender();
                    }
                  }}
                  placeholder="Enter email address to block"
                  className={`w-full glass bg-white/90 px-4 py-2.5 rounded-xl focus:outline-none focus:ring-2 transition-all border text-textDark placeholder:text-textLight/60 ${
                    emailError
                      ? 'border-red-400 ring-2 ring-red-200 focus:ring-red-400'
                      : 'border-gray-200 focus:ring-primary focus:border-transparent'
                  }`}
                />
                {emailError && (
                  <div className="flex items-center gap-1 mt-1 text-red-600 text-xs">
                    <AlertCircle size={14} />
                    <span>{emailError}</span>
                  </div>
                )}
              </div>
              <button
                onClick={handleAddBlockedSender}
                className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl hover:bg-primaryDark transition-colors font-medium"
              >
                <Plus size={18} />
                <span>Block</span>
              </button>
            </div>

            {/* Blocked Senders List */}
            {settings.blockedSenders && settings.blockedSenders.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-textDark">Blocked Email Addresses:</p>
                <div className="flex flex-col gap-2">
                  {settings.blockedSenders.map((email, index) => (
                    <div
                      key={`${email}-${index}`}
                      className="flex items-center justify-between bg-white/70 p-3 rounded-lg border border-gray-200"
                    >
                      <span className="text-textDark">{email}</span>
                      <button
                        onClick={() => handleRemoveBlockedSender(email)}
                        className="text-red-500 hover:text-red-700 transition-colors p-1"
                        title="Unblock sender"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-textLight italic">No blocked senders</p>
            )}
          </div>
        </section>

        {/* External Images Toggle */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <ImageOff className="text-primary" size={20} />
            <h2 className="text-xl font-semibold text-textDark">External Images</h2>
          </div>
          <div className="bg-white/50 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="font-medium text-textDark">Disable External Image Loading</p>
                <p className="text-sm text-textLight">
                  Prevent emails from loading external images automatically. This protects your privacy by preventing senders from tracking when you open emails.
                </p>
              </div>
              <button
                onClick={() => handleToggle('disableExternalImages', !settings.disableExternalImages)}
                className={`relative w-14 h-7 rounded-full transition-colors duration-200 flex-shrink-0 ${
                  settings.disableExternalImages 
                    ? 'bg-[#4DD0E1]' 
                    : 'bg-gray-500'
                }`}
              >
                <div
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform duration-200 shadow-lg ${
                    settings.disableExternalImages ? 'translate-x-7' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </section>

        {/* Auto-Mark Settings */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <Shield className="text-primary" size={20} />
            <h2 className="text-xl font-semibold text-textDark">Auto-Mark Settings</h2>
          </div>
          <div className="bg-white/50 p-4 rounded-lg space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="font-medium text-textDark">Auto-Mark Spam</p>
                <p className="text-sm text-textLight">
                  Automatically mark emails detected as spam by AI analysis
                </p>
              </div>
              <button
                onClick={() => handleToggle('autoMarkSpam', !settings.autoMarkSpam)}
                className={`relative w-14 h-7 rounded-full transition-colors duration-200 flex-shrink-0 ${
                  settings.autoMarkSpam 
                    ? 'bg-[#4DD0E1]' 
                    : 'bg-gray-500'
                }`}
              >
                <div
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform duration-200 shadow-lg ${
                    settings.autoMarkSpam ? 'translate-x-7' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="font-medium text-textDark">Auto-Mark Phishing</p>
                <p className="text-sm text-textLight">
                  Automatically mark emails detected as phishing by AI analysis
                </p>
              </div>
              <button
                onClick={() => handleToggle('autoMarkPhishing', !settings.autoMarkPhishing)}
                className={`relative w-14 h-7 rounded-full transition-colors duration-200 flex-shrink-0 ${
                  settings.autoMarkPhishing 
                    ? 'bg-[#4DD0E1]' 
                    : 'bg-gray-500'
                }`}
              >
                <div
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform duration-200 shadow-lg ${
                    settings.autoMarkPhishing ? 'translate-x-7' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </section>

        {/* Save Button */}
        <div className="flex justify-end pt-4">
          <button
            onClick={handleSaveSettings}
            disabled={saving}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 ${
              saving
                ? 'bg-gray-400 cursor-not-allowed opacity-60'
                : 'bg-gradient-to-r from-primary to-primaryDark hover:from-primaryDark hover:to-primary text-white'
            }`}
          >
            <Save size={18} />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}

