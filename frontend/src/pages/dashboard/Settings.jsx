import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Shield, Lock, Bell, User, Mail, X, Eye, EyeOff, KeyRound, Key } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import PrivacySettings from './PrivacySettings';
import api from '../../api/api';
import { toast } from '../../utils/toast';
import { clearSettingsCache } from '../../utils/settings';

export default function Settings() {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('privacy');
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });
  const [changingPassword, setChangingPassword] = useState(false);
  const [showVaultPinModal, setShowVaultPinModal] = useState(false);
  const [vaultPinData, setVaultPinData] = useState({
    newPin: '',
    confirmPin: ''
  });
  const [settingVaultPin, setSettingVaultPin] = useState(false);
  const [generatingKeys, setGeneratingKeys] = useState(false);
  const [keyPassword, setKeyPassword] = useState('');
  const [showKeyGenModal, setShowKeyGenModal] = useState(false);
  const [hasPublicKey, setHasPublicKey] = useState(false);
  const [checkingKeys, setCheckingKeys] = useState(true);

  // Fetch settings on mount
  useEffect(() => {
    fetchSettings();
    checkEncryptionKeys();
  }, []);

  const checkEncryptionKeys = async () => {
    try {
      setCheckingKeys(true);
      const response = await api.get('/email/public-key');
      if (response.data.success) {
        setHasPublicKey(response.data.data.hasPublicKey);
      }
    } catch (error) {
      console.error('Error checking encryption keys:', error);
    } finally {
      setCheckingKeys(false);
    }
  };

  const handleGenerateKeys = async (e) => {
    e.preventDefault();
    if (!keyPassword.trim()) {
      toast.error('Password is required');
      return;
    }

    try {
      setGeneratingKeys(true);
      const response = await api.post('/email/generate-keys', { 
        password: keyPassword,
        regenerate: hasPublicKey // Set regenerate flag if keys already exist
      });
      if (response.data.success) {
        toast.success(hasPublicKey 
          ? 'Encryption keys regenerated successfully! Note: Old emails encrypted with previous keys may not be decryptable.'
          : 'Encryption keys generated successfully!');
        setShowKeyGenModal(false);
        setKeyPassword('');
        setHasPublicKey(true);
      } else {
        throw new Error(response.data.message || 'Failed to generate keys');
      }
    } catch (error) {
      console.error('Error generating keys:', error);
      toast.error(error.response?.data?.message || error.message || 'Failed to generate encryption keys');
    } finally {
      setGeneratingKeys(false);
    }
  };

  // Set active tab based on route
  useEffect(() => {
    if (location.pathname === '/settings/privacy') {
      setActiveTab('privacy');
    } else if (location.pathname === '/settings') {
      setActiveTab('privacy'); // Default to privacy tab
    }
  }, [location.pathname]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await api.get('/settings');
      if (response.data.success) {
        // Ensure all settings have default values
        const settingsData = {
          ...response.data.data,
          newEmailNotifications: response.data.data.newEmailNotifications ?? true,
          importantEmailAlerts: response.data.data.importantEmailAlerts ?? true,
          securityAlerts: response.data.data.securityAlerts ?? true,
          language: response.data.data.language ?? 'en',
          timezone: response.data.data.timezone ?? 'UTC'
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

  const handleToggle = async (field, value) => {
    if (!settings) return;
    const previousSettings = { ...settings };
    const newSettings = { ...settings, [field]: value };
    setSettings(newSettings);
    
    try {
      const response = await api.put('/settings', {
        [field]: value
      });

      if (response.data.success) {
        setSettings(response.data.data);
        clearSettingsCache();
        toast.success('Settings updated');
      } else {
        setSettings(previousSettings);
        throw new Error(response.data.message || 'Failed to update settings');
      }
    } catch (error) {
      console.error('Error updating settings:', error);
      setSettings(previousSettings);
      toast.error(error.response?.data?.message || 'Failed to update settings');
    }
  };


  const handleChangePassword = async (e) => {
    e.preventDefault();
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('New password and confirm password do not match');
      return;
    }

    try {
      setChangingPassword(true);
      const response = await api.post('/settings/change-password', passwordData);

      if (response.data.success) {
        const message = response.data.data?.keysRegenerated
          ? 'Password changed successfully. Your encryption keys have been automatically regenerated with the new password.'
          : 'Password changed successfully';
        toast.success(message);
        setShowPasswordModal(false);
        setPasswordData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });
        // Refresh encryption keys status
        checkEncryptionKeys();
      } else {
        throw new Error(response.data.message || 'Failed to change password');
      }
    } catch (error) {
      console.error('Error changing password:', error);
      toast.error(error.response?.data?.message || 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleSetVaultPin = async (e) => {
    e.preventDefault();
    
    if (vaultPinData.newPin.length !== 4) {
      toast.error('PIN must be exactly 4 digits');
      return;
    }

    if (vaultPinData.newPin !== vaultPinData.confirmPin) {
      toast.error('PINs do not match');
      return;
    }

    try {
      setSettingVaultPin(true);
      const response = await api.post('/vault/set-pin', { pin: vaultPinData.newPin });

      if (response.data.success) {
        toast.success('Vault PIN set successfully');
        setShowVaultPinModal(false);
        setVaultPinData({
          newPin: '',
          confirmPin: ''
        });
      } else {
        throw new Error(response.data.message || 'Failed to set vault PIN');
      }
    } catch (error) {
      console.error('Error setting vault PIN:', error);
      toast.error(error.response?.data?.message || error.message || 'Failed to set vault PIN');
    } finally {
      setSettingVaultPin(false);
    }
  };

  const handleLanguageChange = async (language) => {
    if (!settings) return;
    const langMap = { 'English': 'en', 'Spanish': 'es', 'French': 'fr' };
    await handleToggle('language', langMap[language] || 'en');
  };

  const handleTimezoneChange = async (timezone) => {
    if (!settings) return;
    await handleToggle('timezone', timezone);
  };

  const tabs = [
    { id: 'privacy', label: 'Privacy', icon: Shield },
    { id: 'security', label: 'Security', icon: Lock },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'account', label: 'Account', icon: User },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'privacy':
        return <PrivacySettings />;
      case 'security':
        if (loading) {
          return (
            <div className="glass p-6 rounded-xl min-h-[60vh] backdrop-blur-md bg-white/80">
              <div className="text-center py-12">
                <p className="text-textDark text-lg">Loading settings...</p>
              </div>
            </div>
          );
        }
        // Use defaults if settings not loaded yet
        const spamEnabled = settings?.autoMarkSpam ?? true;
        const phishingEnabled = settings?.autoMarkPhishing ?? true;
        
        return (
          <div className="glass p-6 rounded-xl min-h-[60vh] backdrop-blur-md bg-white/80">
            <div className="flex items-center gap-3 mb-6">
              <Lock className="text-primary" size={24} />
              <h1 className="text-2xl font-bold text-primary">Security Settings</h1>
            </div>

            <div className="space-y-6">
              <section>
                <div className="flex items-center gap-3 mb-4">
                  <Lock className="text-primary" size={20} />
                  <h2 className="text-xl font-semibold text-textDark">Password</h2>
                </div>
                <div className="bg-white/50 p-4 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-textDark">Change Password</p>
                      <p className="text-sm text-textLight">Update your account password</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowPasswordModal(true)}
                      className="px-4 py-2 bg-[#4DD0E1] text-white rounded-lg hover:bg-[#3BC0D1] transition-colors font-medium flex-shrink-0 min-w-[100px] shadow-md"
                      style={{ display: 'block' }}
                    >
                      Change
                    </button>
                  </div>
                </div>
              </section>

              <section>
                <div className="flex items-center gap-3 mb-4">
                  <KeyRound className="text-primary" size={20} />
                  <h2 className="text-xl font-semibold text-textDark">Secure Vault PIN</h2>
                </div>
                <div className="bg-white/50 p-4 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-textDark">Vault PIN</p>
                      <p className="text-sm text-textLight">Set or change your 4-digit PIN for the Secure Vault</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowVaultPinModal(true)}
                      className="px-4 py-2 bg-[#4DD0E1] text-white rounded-lg hover:bg-[#3BC0D1] transition-colors font-medium flex-shrink-0 min-w-[100px] shadow-md"
                      style={{ display: 'block' }}
                    >
                      {settings?.vaultPinHash ? 'Change PIN' : 'Set PIN'}
                    </button>
                  </div>
                </div>
              </section>

              <section>
                <div className="flex items-center gap-3 mb-4">
                  <Key className="text-primary" size={20} />
                  <h2 className="text-xl font-semibold text-textDark">End-to-End Encryption Keys</h2>
                </div>
                <div className="bg-white/50 p-4 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-textDark">Encryption Keys</p>
                      <p className="text-sm text-textLight">
                        {hasPublicKey 
                          ? 'Your encryption keys are set up. You can send and receive encrypted emails.'
                          : 'Generate encryption keys to enable end-to-end encryption for your emails.'}
                      </p>
                    </div>
                    {checkingKeys ? (
                      <div className="px-4 py-2 text-textLight">Checking...</div>
                    ) : hasPublicKey ? (
                      <button
                        type="button"
                        onClick={() => setShowKeyGenModal(true)}
                        className="px-4 py-2 bg-[#4DD0E1] text-white rounded-lg hover:bg-[#3BC0D1] transition-colors font-medium flex-shrink-0 min-w-[140px] shadow-md"
                      >
                        Regenerate Keys
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowKeyGenModal(true)}
                        className="px-4 py-2 bg-[#4DD0E1] text-white rounded-lg hover:bg-[#3BC0D1] transition-colors font-medium flex-shrink-0 min-w-[100px] shadow-md"
                      >
                        Generate Keys
                      </button>
                    )}
                  </div>
                </div>
              </section>

              <section>
                <div className="flex items-center gap-3 mb-4">
                  <Mail className="text-primary" size={20} />
                  <h2 className="text-xl font-semibold text-textDark">Email Security</h2>
                </div>
                <div className="bg-white/50 p-4 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-textDark">Spam Detection</p>
                      <p className="text-sm text-textLight">AI-powered spam filtering is always enabled</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => settings && handleToggle('autoMarkSpam', !spamEnabled)}
                      disabled={!settings}
                      className={`relative w-14 h-7 rounded-full transition-colors duration-200 flex-shrink-0 ${
                        spamEnabled 
                          ? 'bg-[#4DD0E1]' 
                          : 'bg-gray-500'
                      } ${!settings ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                      aria-label={spamEnabled ? 'Disable spam detection' : 'Enable spam detection'}
                      style={{ display: 'block', minWidth: '56px' }}
                    >
                      <div
                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform duration-200 shadow-lg ${
                          spamEnabled ? 'translate-x-7' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-textDark">Phishing Protection</p>
                      <p className="text-sm text-textLight">Detect and block phishing attempts automatically</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => settings && handleToggle('autoMarkPhishing', !phishingEnabled)}
                      disabled={!settings}
                      className={`relative w-14 h-7 rounded-full transition-colors duration-200 flex-shrink-0 ${
                        phishingEnabled 
                          ? 'bg-[#4DD0E1]' 
                          : 'bg-gray-500'
                      } ${!settings ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                      aria-label={phishingEnabled ? 'Disable phishing protection' : 'Enable phishing protection'}
                      style={{ display: 'block', minWidth: '56px' }}
                    >
                      <div
                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform duration-200 shadow-lg ${
                          phishingEnabled ? 'translate-x-7' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </section>
            </div>
          </div>
        );
      case 'notifications':
        if (loading || !settings) {
          return (
            <div className="glass p-6 rounded-xl min-h-[60vh] backdrop-blur-md bg-white/80">
              <div className="text-center py-12">
                <p className="text-textDark text-lg">Loading settings...</p>
              </div>
            </div>
          );
        }
        const newEmailEnabled = settings.newEmailNotifications ?? true;
        const importantEmailEnabled = settings.importantEmailAlerts ?? true;
        const securityAlertsEnabled = settings.securityAlerts ?? true;
        
        return (
          <div className="glass p-6 rounded-xl min-h-[60vh] backdrop-blur-md bg-white/80">
            <div className="flex items-center gap-3 mb-6">
              <Bell className="text-primary" size={24} />
              <h1 className="text-2xl font-bold text-primary">Notification Settings</h1>
            </div>

            <div className="space-y-6">
              <section>
                <div className="flex items-center gap-3 mb-4">
                  <Bell className="text-primary" size={20} />
                  <h2 className="text-xl font-semibold text-textDark">Email Notifications</h2>
                </div>
                <div className="bg-white/50 p-4 rounded-lg space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-textDark">New Email Notifications</p>
                      <p className="text-sm text-textLight">Receive notifications for new emails</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggle('newEmailNotifications', !newEmailEnabled)}
                      className={`relative w-14 h-7 rounded-full transition-colors duration-200 flex-shrink-0 ${
                        newEmailEnabled 
                          ? 'bg-[#4DD0E1]' 
                          : 'bg-gray-500'
                      }`}
                      aria-label={newEmailEnabled ? 'Disable new email notifications' : 'Enable new email notifications'}
                    >
                      <div
                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform duration-200 shadow-lg ${
                          newEmailEnabled ? 'translate-x-7' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-textDark">Important Email Alerts</p>
                      <p className="text-sm text-textLight">Get notified about important emails</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggle('importantEmailAlerts', !importantEmailEnabled)}
                      className={`relative w-14 h-7 rounded-full transition-colors duration-200 flex-shrink-0 ${
                        importantEmailEnabled 
                          ? 'bg-[#4DD0E1]' 
                          : 'bg-gray-500'
                      }`}
                      aria-label={importantEmailEnabled ? 'Disable important email alerts' : 'Enable important email alerts'}
                    >
                      <div
                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform duration-200 shadow-lg ${
                          importantEmailEnabled ? 'translate-x-7' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-textDark">Security Alerts</p>
                      <p className="text-sm text-textLight">Notifications for security-related events</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggle('securityAlerts', !securityAlertsEnabled)}
                      className={`relative w-14 h-7 rounded-full transition-colors duration-200 flex-shrink-0 ${
                        securityAlertsEnabled 
                          ? 'bg-[#4DD0E1]' 
                          : 'bg-gray-500'
                      }`}
                      aria-label={securityAlertsEnabled ? 'Disable security alerts' : 'Enable security alerts'}
                    >
                      <div
                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform duration-200 shadow-lg ${
                          securityAlertsEnabled ? 'translate-x-7' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </section>
            </div>
          </div>
        );
      case 'account':
        if (loading || !settings) {
          return (
            <div className="glass p-6 rounded-xl min-h-[60vh] backdrop-blur-md bg-white/80">
              <div className="text-center py-12">
                <p className="text-textDark text-lg">Loading settings...</p>
              </div>
            </div>
          );
        }
        const langMap = { 'en': 'English', 'es': 'Spanish', 'fr': 'French' };
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const userEmail = user.email || 'user@securemail.com';
        
        return (
          <div className="glass p-6 rounded-xl min-h-[60vh] backdrop-blur-md bg-white/80">
            <div className="flex items-center gap-3 mb-6">
              <User className="text-primary" size={24} />
              <h1 className="text-2xl font-bold text-primary">Account Settings</h1>
            </div>

            <div className="space-y-6">
              <section>
                <div className="flex items-center gap-3 mb-4">
                  <User className="text-primary" size={20} />
                  <h2 className="text-xl font-semibold text-textDark">Profile Information</h2>
                </div>
                <div className="bg-white/50 p-4 rounded-lg space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-textDark mb-2">Email Address</label>
                    <input
                      type="email"
                      value={userEmail}
                      disabled
                      className="w-full glass bg-white/90 px-4 py-3 rounded-xl border border-gray-200 text-textDark opacity-60 cursor-not-allowed"
                    />
                    <p className="text-xs text-textLight mt-1">Email address cannot be changed</p>
                  </div>
                </div>
              </section>

              <section>
                <div className="flex items-center gap-3 mb-4">
                  <SettingsIcon className="text-primary" size={20} />
                  <h2 className="text-xl font-semibold text-textDark">Account Preferences</h2>
                </div>
                <div className="bg-white/50 p-4 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-textDark">Language</p>
                      <p className="text-sm text-textLight">Select your preferred language</p>
                    </div>
                    <select
                      value={langMap[settings.language] || 'English'}
                      onChange={(e) => handleLanguageChange(e.target.value)}
                      className="px-4 py-2 bg-white/90 border border-gray-200 rounded-lg text-textDark focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option>English</option>
                      <option>Spanish</option>
                      <option>French</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-textDark">Time Zone</p>
                      <p className="text-sm text-textLight">Set your time zone</p>
                    </div>
                    <select
                      value={settings.timezone || 'UTC'}
                      onChange={(e) => handleTimezoneChange(e.target.value)}
                      className="px-4 py-2 bg-white/90 border border-gray-200 rounded-lg text-textDark focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option>UTC</option>
                      <option>EST</option>
                      <option>PST</option>
                      <option>GMT</option>
                      <option>CET</option>
                      <option>JST</option>
                    </select>
                  </div>
                </div>
              </section>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-shrink-0 space-y-6 mb-6">
        {/* Header */}
        <div className="glass p-4 md:p-6 rounded-xl backdrop-blur-md bg-white/80">
          <div className="flex items-center gap-3 mb-6">
            <SettingsIcon className="text-primary" size={24} />
            <h1 className="text-2xl font-bold text-primary">Settings</h1>
          </div>

          {/* Tabs */}
          <div className="flex flex-wrap gap-2 border-b border-gray-200">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 font-medium transition-all border-b-2 ${
                    activeTab === tab.id
                      ? 'border-primary text-primary'
                      : 'border-transparent text-textLight hover:text-textDark'
                  }`}
                >
                  <Icon size={18} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tab Content - Scrollable */}
      <div className="flex-1 overflow-y-auto">
        {renderTabContent()}
      </div>

      {/* Password Change Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass bg-white/95 rounded-xl p-6 max-w-md w-full backdrop-blur-md">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-primary">Change Password</h2>
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  setPasswordData({
                    currentPassword: '',
                    newPassword: '',
                    confirmPassword: ''
                  });
                }}
                className="text-textLight hover:text-textDark transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-textDark mb-2">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    type={showPasswords.current ? 'text' : 'password'}
                    value={passwordData.currentPassword}
                    onChange={(e) =>
                      setPasswordData({ ...passwordData, currentPassword: e.target.value })
                    }
                    required
                    className="w-full glass bg-white/90 px-4 py-3 pr-10 rounded-xl border border-gray-200 text-textDark focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setShowPasswords({ ...showPasswords, current: !showPasswords.current })
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-textLight hover:text-textDark"
                  >
                    {showPasswords.current ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-textDark mb-2">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showPasswords.new ? 'text' : 'password'}
                    value={passwordData.newPassword}
                    onChange={(e) =>
                      setPasswordData({ ...passwordData, newPassword: e.target.value })
                    }
                    required
                    minLength={8}
                    className="w-full glass bg-white/90 px-4 py-3 pr-10 rounded-xl border border-gray-200 text-textDark focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setShowPasswords({ ...showPasswords, new: !showPasswords.new })
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-textLight hover:text-textDark"
                  >
                    {showPasswords.new ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                <p className="text-xs text-textLight mt-1">
                  Must be at least 8 characters with uppercase, lowercase, and number
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-textDark mb-2">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={showPasswords.confirm ? 'text' : 'password'}
                    value={passwordData.confirmPassword}
                    onChange={(e) =>
                      setPasswordData({ ...passwordData, confirmPassword: e.target.value })
                    }
                    required
                    minLength={8}
                    className="w-full glass bg-white/90 px-4 py-3 pr-10 rounded-xl border border-gray-200 text-textDark focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-textLight hover:text-textDark"
                  >
                    {showPasswords.confirm ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordModal(false);
                    setPasswordData({
                      currentPassword: '',
                      newPassword: '',
                      confirmPassword: ''
                    });
                  }}
                  className="flex-1 px-4 py-3 bg-gray-200 text-textDark rounded-xl hover:bg-gray-300 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={changingPassword}
                  className={`flex-1 px-4 py-3 rounded-xl font-medium transition-colors ${
                    changingPassword
                      ? 'bg-gray-400 cursor-not-allowed text-white'
                      : 'bg-primary text-white hover:bg-primaryDark'
                  }`}
                >
                  {changingPassword ? 'Changing...' : 'Change Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Vault PIN Modal */}
      {showVaultPinModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="glass p-6 rounded-2xl backdrop-blur-md bg-white/90 shadow-xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <KeyRound className="text-[#4DD0E1]" size={24} />
                <h2 className="text-2xl font-bold text-primary">Set Vault PIN</h2>
              </div>
              <button
                onClick={() => {
                  setShowVaultPinModal(false);
                  setVaultPinData({
                    newPin: '',
                    confirmPin: ''
                  });
                }}
                className="text-textLight hover:text-textDark transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSetVaultPin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-textDark mb-2">
                  New PIN (4 digits)
                </label>
                <input
                  type="password"
                  maxLength={4}
                  value={vaultPinData.newPin}
                  onChange={(e) =>
                    setVaultPinData({ ...vaultPinData, newPin: e.target.value.replace(/\D/g, '') })
                  }
                  required
                  className="w-full glass bg-white/90 px-4 py-3 rounded-xl border border-gray-200 text-textDark text-center text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="0000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-textDark mb-2">
                  Confirm PIN
                </label>
                <input
                  type="password"
                  maxLength={4}
                  value={vaultPinData.confirmPin}
                  onChange={(e) =>
                    setVaultPinData({ ...vaultPinData, confirmPin: e.target.value.replace(/\D/g, '') })
                  }
                  required
                  className="w-full glass bg-white/90 px-4 py-3 rounded-xl border border-gray-200 text-textDark text-center text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="0000"
                />
              </div>
              <div className="pt-4">
                <button
                  type="submit"
                  disabled={settingVaultPin || vaultPinData.newPin.length !== 4 || vaultPinData.confirmPin.length !== 4}
                  className="w-full px-6 py-3 bg-[#4DD0E1] text-white rounded-xl font-semibold hover:bg-[#3BC0D1] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {settingVaultPin ? 'Setting PIN...' : 'Set PIN'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Generate Encryption Keys Modal */}
      {showKeyGenModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="glass p-6 rounded-2xl backdrop-blur-md bg-white/90 shadow-xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Key className="text-[#4DD0E1]" size={24} />
                <h2 className="text-2xl font-bold text-primary">
                  {hasPublicKey ? 'Regenerate Encryption Keys' : 'Generate Encryption Keys'}
                </h2>
              </div>
              <button
                onClick={() => {
                  setShowKeyGenModal(false);
                  setKeyPassword('');
                }}
                className="text-textLight hover:text-textDark transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <p className="text-textDark mb-4">
              {hasPublicKey 
                ? 'Enter your password to regenerate encryption keys. Note: Old emails encrypted with previous keys may not be decryptable after regeneration.'
                : 'Enter your password to generate encryption keys. These keys will enable end-to-end encryption for your emails.'}
            </p>

            <form onSubmit={handleGenerateKeys} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-textDark mb-2">Your Password</label>
                <input
                  type="password"
                  value={keyPassword}
                  onChange={(e) => setKeyPassword(e.target.value)}
                  required
                  className="w-full glass bg-white/90 px-4 py-3 rounded-xl border border-gray-200 text-textDark focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Enter your account password"
                  autoFocus
                />
                <p className="text-xs text-textLight mt-2">
                  Your private key will be encrypted with this password
                </p>
              </div>
              <div className="pt-4">
                <button
                  type="submit"
                  disabled={generatingKeys || !keyPassword.trim()}
                  className="w-full px-6 py-3 bg-[#4DD0E1] text-white rounded-xl font-semibold hover:bg-[#3BC0D1] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {generatingKeys ? (hasPublicKey ? 'Regenerating Keys...' : 'Generating Keys...') : (hasPublicKey ? 'Regenerate Keys' : 'Generate Keys')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
