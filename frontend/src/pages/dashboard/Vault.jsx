import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import EmailList from '../../components/email/EmailList';
import EmailViewer from '../../components/email/EmailViewer';
import api from '../../api/api';
import { toast } from '../../utils/toast';
import { Lock, Shield, X, RotateCcw, Trash2 } from 'lucide-react';

export default function Vault({ searchQuery: parentSearchQuery, setSearchQuery: setParentSearchQuery }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [selectedEmail, setSelectedEmail] = React.useState(null);
  const [emails, setEmails] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState(parentSearchQuery || '');
  const [showPinModal, setShowPinModal] = React.useState(true);
  const [pin, setPin] = React.useState('');
  const [verifying, setVerifying] = React.useState(false);
  const [pinToken, setPinToken] = React.useState(null);
  const [needsPinSetup, setNeedsPinSetup] = React.useState(false);
  const [settingPin, setSettingPin] = React.useState(false);
  const [newPin, setNewPin] = React.useState('');
  const [confirmPin, setConfirmPin] = React.useState('');
  const [removing, setRemoving] = React.useState(false);
  const [isExplicitlyLocked, setIsExplicitlyLocked] = React.useState(false);

  React.useEffect(() => {
    if (parentSearchQuery !== undefined) {
      setSearchQuery(parentSearchQuery);
    }
  }, [parentSearchQuery]);

  React.useEffect(() => {
    if (setParentSearchQuery) {
      setParentSearchQuery(searchQuery);
    }
  }, [searchQuery, setParentSearchQuery]);

  // Check if PIN is set
  React.useEffect(() => {
    const checkPinStatus = async () => {
      try {
        const response = await api.get('/vault/emails', { headers: { 'X-Vault-Token': 'check' } });
        // If we get here, PIN is set
        setNeedsPinSetup(false);
      } catch (error) {
        if (error.response?.status === 404 || error.response?.data?.message?.includes('not set')) {
          setNeedsPinSetup(true);
          setShowPinModal(true);
        }
      }
    };
    checkPinStatus();
  }, []);

  // Fetch vault emails
  const fetchVaultEmails = React.useCallback(async () => {
    if (!pinToken) return;

    try {
      setLoading(true);
      const response = await api.get('/vault/emails', {
        headers: { 'X-Vault-Token': pinToken }
      });

      if (response.data.success) {
        setEmails(response.data.data.emails || []);
      } else {
        throw new Error(response.data.message || 'Failed to load vault emails');
      }
    } catch (error) {
      console.error('Error fetching vault emails:', error);
      if (error.response?.status === 401) {
        setPinToken(null);
        setShowPinModal(true);
        toast.error('PIN session expired. Please enter PIN again.');
      } else {
        toast.error(error.response?.data?.message || error.message || 'Failed to load vault emails');
      }
      setEmails([]);
    } finally {
      setLoading(false);
    }
  }, [pinToken]);

  React.useEffect(() => {
    if (pinToken) {
      fetchVaultEmails();
    }
  }, [pinToken, fetchVaultEmails]);

  // Handle email selection
  React.useEffect(() => {
    const loadEmail = async () => {
      if (id && pinToken) {
        const emailFromList = emails.find(e => e._id === id);
        if (emailFromList) {
          setSelectedEmail(emailFromList);
        } else {
          try {
            const response = await api.get(`/email/${id}`);
            if (response.data.success && response.data.data.isVault) {
              setSelectedEmail(response.data.data);
            }
          } catch (error) {
            console.error('Error fetching email:', error);
          }
        }
      } else {
        setSelectedEmail(null);
      }
    };

    loadEmail();
  }, [id, emails, pinToken]);

  const handleEmailSelect = (email) => {
    setSelectedEmail(email);
    window.history.pushState({}, '', `/vault/${email._id}`);
  };

  const handleVerifyPin = async () => {
    if (pin.length !== 4) {
      toast.error('Please enter a 4-digit PIN');
      return;
    }

    try {
      setVerifying(true);
      const response = await api.post('/vault/verify-pin', { pin });

      if (response.data.success) {
        const token = response.data.data.token;
        setPinToken(token);
        localStorage.setItem('vaultToken', token);
        setIsExplicitlyLocked(false); // Reset locked flag when PIN is verified
        setShowPinModal(false);
        setPin('');
        toast.success('PIN verified successfully');
      } else {
        throw new Error(response.data.message || 'Invalid PIN');
      }
    } catch (error) {
      console.error('Error verifying PIN:', error);
      toast.error(error.response?.data?.message || error.message || 'Invalid PIN');
      setPin('');
    } finally {
      setVerifying(false);
    }
  };

  const handleSetPin = async () => {
    if (newPin.length !== 4) {
      toast.error('PIN must be exactly 4 digits');
      return;
    }

    if (newPin !== confirmPin) {
      toast.error('PINs do not match');
      return;
    }

    try {
      setSettingPin(true);
      const response = await api.post('/vault/set-pin', { pin: newPin });

      if (response.data.success) {
        toast.success('Vault PIN set successfully');
        setNeedsPinSetup(false);
        setNewPin('');
        setConfirmPin('');
        setShowPinModal(true);
      } else {
        throw new Error(response.data.message || 'Failed to set PIN');
      }
    } catch (error) {
      console.error('Error setting PIN:', error);
      toast.error(error.response?.data?.message || error.message || 'Failed to set PIN');
    } finally {
      setSettingPin(false);
    }
  };

  // Check for stored token on mount (only if vault is not explicitly locked)
  React.useEffect(() => {
    // Check if vault was explicitly locked (persisted in sessionStorage)
    const wasLocked = sessionStorage.getItem('vaultLocked') === 'true';
    if (wasLocked) {
      setIsExplicitlyLocked(true);
      sessionStorage.removeItem('vaultLocked'); // Clear after reading
      localStorage.removeItem('vaultToken'); // Ensure token is removed
      return;
    }

    const storedToken = localStorage.getItem('vaultToken');
    if (storedToken) {
      // Verify token is still valid by trying to fetch emails
        api.get('/vault/emails', { headers: { 'X-Vault-Token': storedToken } })
        .then(response => {
          if (response.data.success) {
            setPinToken(storedToken);
            setShowPinModal(false);
            setIsExplicitlyLocked(false); // Reset flag if token is valid
          } else {
            // Token is invalid, clear it
            localStorage.removeItem('vaultToken');
            setIsExplicitlyLocked(false);
          }
        })
        .catch((error) => {
          // Token validation failed (401 or other error)
          localStorage.removeItem('vaultToken');
          setIsExplicitlyLocked(false);
        });
    }
  }, []);

  const handlePinKeypad = (digit) => {
    if (pin.length < 4) {
      setPin(pin + digit);
    }
  };

  const handlePinBackspace = () => {
    setPin(pin.slice(0, -1));
  };

  const handleRemoveFromVault = async (emailId) => {
    if (removing || !pinToken) return;
    
    try {
      setRemoving(true);
      const response = await api.post(`/vault/remove/${emailId}`, { token: pinToken });
      
      if (response.data.success) {
        toast.success('Email removed from vault');
        fetchVaultEmails(); // Refresh vault list
        if (selectedEmail && selectedEmail._id === emailId) {
          setSelectedEmail(null);
          navigate('/dashboard');
        }
      } else {
        throw new Error(response.data.message || 'Failed to remove email from vault');
      }
    } catch (error) {
      console.error('Error removing email from vault:', error);
      if (error.response?.status === 401) {
        setPinToken(null);
        localStorage.removeItem('vaultToken');
        setShowPinModal(true);
        toast.error('PIN session expired. Please enter PIN again.');
      } else {
        toast.error(error.response?.data?.message || error.message || 'Failed to remove email from vault');
      }
    } finally {
      setRemoving(false);
    }
  };

  const handleDelete = async (emailId) => {
    if (!window.confirm('Are you sure you want to delete this email?')) {
      return;
    }

    try {
      const response = await api.delete(`/email/${emailId}`);
      if (response.data.success) {
        toast.success('Email moved to trash');
        fetchVaultEmails(); // Refresh vault list
        if (selectedEmail && selectedEmail._id === emailId) {
          setSelectedEmail(null);
        }
      }
    } catch (error) {
      toast.error('Failed to delete email');
    }
  };

  const filteredEmails = emails.filter(email =>
    email.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    email.body?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    email.senderEmail?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    email.senderName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (showPinModal) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="glass p-8 rounded-2xl backdrop-blur-md bg-white/90 shadow-xl max-w-md w-full">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-[#4DD0E1] rounded-full mb-4">
              <Lock size={32} className="text-white" />
            </div>
            <h2 className="text-2xl font-bold text-textDark mb-2">
              {needsPinSetup ? 'Set Vault PIN' : 'Enter Vault PIN'}
            </h2>
            <p className="text-textLight">
              {needsPinSetup
                ? 'Create a 4-digit PIN to secure your vault'
                : 'Enter your 4-digit PIN to access secure vault'}
            </p>
          </div>

          {needsPinSetup ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-textDark mb-2">New PIN</label>
                <input
                  type="password"
                  maxLength={4}
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#4DD0E1] focus:border-transparent text-center text-2xl tracking-widest"
                  placeholder="0000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-textDark mb-2">Confirm PIN</label>
                <input
                  type="password"
                  maxLength={4}
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#4DD0E1] focus:border-transparent text-center text-2xl tracking-widest"
                  placeholder="0000"
                />
              </div>
              <button
                onClick={handleSetPin}
                disabled={settingPin || newPin.length !== 4 || confirmPin.length !== 4}
                className="w-full px-6 py-3 bg-[#4DD0E1] text-white rounded-xl font-semibold hover:bg-[#3BC0D1] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {settingPin ? 'Setting PIN...' : 'Set PIN'}
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="text-center">
                <div className="inline-flex items-center justify-center gap-2 px-6 py-4 bg-gray-100 rounded-xl">
                  {pin.split('').map((digit, i) => (
                    <div
                      key={i}
                      className="w-4 h-4 rounded-full bg-[#4DD0E1]"
                    />
                  ))}
                  {Array(4 - pin.length).fill(0).map((_, i) => (
                    <div
                      key={i}
                      className="w-4 h-4 rounded-full bg-gray-300"
                    />
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
                  <button
                    key={digit}
                    onClick={() => handlePinKeypad(digit.toString())}
                    className="px-6 py-4 bg-white border-2 border-gray-200 rounded-xl font-semibold text-xl hover:bg-gray-50 hover:border-[#4DD0E1] transition-colors"
                  >
                    {digit}
                  </button>
                ))}
                <button
                  onClick={handlePinBackspace}
                  className="px-6 py-4 bg-white border-2 border-gray-200 rounded-xl font-semibold hover:bg-gray-50 hover:border-[#4DD0E1] transition-colors"
                >
                  <X size={20} />
                </button>
                <button
                  onClick={() => handlePinKeypad('0')}
                  className="px-6 py-4 bg-white border-2 border-gray-200 rounded-xl font-semibold text-xl hover:bg-gray-50 hover:border-[#4DD0E1] transition-colors"
                >
                  0
                </button>
                <button
                  onClick={handleVerifyPin}
                  disabled={verifying || pin.length !== 4}
                  className="px-6 py-4 bg-[#4DD0E1] text-white rounded-xl font-semibold hover:bg-[#3BC0D1] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {verifying ? '...' : '✓'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-shrink-0 mb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Shield className="text-[#4DD0E1]" size={28} />
            <h1 className="text-2xl font-bold text-textDark">Secure Vault</h1>
          </div>
          <button
            onClick={async () => {
              try {
                const currentToken = pinToken || localStorage.getItem('vaultToken');
                
                // Set locked flag immediately in sessionStorage to persist across remounts
                sessionStorage.setItem('vaultLocked', 'true');
                setIsExplicitlyLocked(true);
                
                // Clear token from localStorage FIRST to prevent race conditions
                localStorage.removeItem('vaultToken');
                
                // Invalidate ALL tokens for this user on backend (pass empty token to invalidate all)
                try {
                  await api.post('/vault/lock', { token: null }); // Pass null to invalidate all tokens
                } catch (error) {
                  console.error('Error invalidating token on backend:', error);
                  // Continue anyway - we've already cleared frontend state
                }
                
                // Clear all state
                setPinToken(null);
                setEmails([]);
                setSelectedEmail(null);
                
                toast.success('Vault locked successfully');
                
                // Redirect to inbox after locking
                navigate('/inbox');
              } catch (error) {
                console.error('Error locking vault:', error);
                // Ensure everything is cleared even on error
                sessionStorage.setItem('vaultLocked', 'true');
                setIsExplicitlyLocked(true);
                setPinToken(null);
                localStorage.removeItem('vaultToken');
                setEmails([]);
                setSelectedEmail(null);
                
                toast.success('Vault locked successfully');
                // Redirect to inbox even on error
                navigate('/inbox');
              }
            }}
            className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-textDark rounded-lg hover:bg-gray-300 transition-colors"
          >
            <Lock size={18} />
            Lock Vault
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden bg-white/80 rounded-xl shadow-lg backdrop-blur-md">
        <div className={`flex-shrink-0 ${selectedEmail ? 'w-1/2 border-r border-gray-200' : 'w-full'} overflow-y-auto p-4`}>
          {loading ? (
            <div className="p-4 text-center text-textLight">Loading vault emails...</div>
          ) : filteredEmails.length === 0 ? (
            <div className="p-4 text-center text-textLight">Vault is empty</div>
          ) : (
            <div className="space-y-2">
              {filteredEmails.map((email) => (
                <div
                  key={email._id}
                  onClick={() => handleEmailSelect(email)}
                  className={`glass p-4 rounded-xl cursor-pointer transition-all hover:shadow-lg ${
                    selectedEmail?._id === email._id
                      ? 'bg-[#4DD0E1]/20 border-2 border-[#4DD0E1]'
                      : 'bg-white/80 hover:bg-white/90'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-textDark truncate">
                          {email.senderName || email.senderEmail || 'Unknown'}
                        </p>
                      </div>
                      <p className="font-medium text-textDark mb-1 truncate">
                        {email.subject || '(No subject)'}
                      </p>
                      <p className="text-sm text-textLight line-clamp-2">
                        {email.body || '(No content)'}
                      </p>
                      <p className="text-xs text-textLight mt-2">
                        {new Date(email.createdAt || email.timestamp).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleRemoveFromVault(email._id)}
                        disabled={removing}
                        className="p-2 text-green-500 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                        title="Remove from vault"
                      >
                        <RotateCcw size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(email._id)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {selectedEmail && (
          <div className="flex-1 overflow-y-auto p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-textDark">Email Details</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => handleRemoveFromVault(selectedEmail._id)}
                  disabled={removing}
                  className="flex items-center gap-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50"
                >
                  <RotateCcw size={16} />
                  {removing ? 'Removing...' : 'Remove from Vault'}
                </button>
                <button
                  onClick={() => handleDelete(selectedEmail._id)}
                  className="flex items-center gap-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                >
                  <Trash2 size={16} />
                  Delete
                </button>
              </div>
            </div>
            <EmailViewer email={selectedEmail} folder="vault" />
          </div>
        )}
      </div>
    </div>
  );
}

