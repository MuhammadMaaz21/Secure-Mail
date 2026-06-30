import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import EmailList from '../../components/email/EmailList';
import EmailViewer from '../../components/email/EmailViewer';
import api from '../../api/api';
import { toast } from '../../utils/toast';
import { RotateCcw, Trash2, RefreshCw } from 'lucide-react';

export default function Trash({ searchQuery: parentSearchQuery, setSearchQuery: setParentSearchQuery }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [selectedEmail, setSelectedEmail] = React.useState(null);
  const [emails, setEmails] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState(parentSearchQuery || '');
  const [restoring, setRestoring] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  
  // Sync with parent search query
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

  // Fetch trash emails from API
  const fetchTrash = React.useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/email/trash');
      
      if (response.data.success) {
        setEmails(response.data.data.emails || []);
      } else {
        throw new Error(response.data.message || 'Failed to load trash');
      }
    } catch (error) {
      console.error('Error fetching trash:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to load trash';
      toast.error(errorMessage);
      setEmails([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchTrash();
  }, [fetchTrash]);

  // Handle email selection from URL or click
  React.useEffect(() => {
    const loadEmail = async () => {
      if (id) {
        const emailFromList = emails.find(e => e._id === id);
        if (emailFromList) {
          setSelectedEmail(emailFromList);
        } else {
          try {
            const response = await api.get(`/email/${id}`);
            if (response.data.success && response.data.data.deletedAt) {
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
  }, [id, emails]);

  const handleEmailSelect = (email) => {
    setSelectedEmail(email);
    window.history.pushState({}, '', `/trash/${email._id}`);
  };

  const handleRestore = async (emailId) => {
    if (restoring) return;
    
    try {
      setRestoring(true);
      const response = await api.post(`/email/restore/${emailId}`);
      
      if (response.data.success) {
        toast.success('Email restored successfully');
        fetchTrash(); // Refresh trash list
        if (selectedEmail && selectedEmail._id === emailId) {
          setSelectedEmail(null);
          navigate('/dashboard');
        }
      } else {
        throw new Error(response.data.message || 'Failed to restore email');
      }
    } catch (error) {
      console.error('Error restoring email:', error);
      toast.error(error.response?.data?.message || error.message || 'Failed to restore email');
    } finally {
      setRestoring(false);
    }
  };

  const handlePermanentDelete = async (emailId) => {
    if (!window.confirm('Are you sure you want to permanently delete this email? This action cannot be undone.')) {
      return;
    }

    if (deleting) return;
    
    try {
      setDeleting(true);
      const response = await api.delete(`/email/permanent/${emailId}`);
      
      if (response.data.success) {
        toast.success('Email permanently deleted');
        fetchTrash(); // Refresh trash list
        if (selectedEmail && selectedEmail._id === emailId) {
          setSelectedEmail(null);
        }
      } else {
        throw new Error(response.data.message || 'Failed to delete email');
      }
    } catch (error) {
      console.error('Error deleting email:', error);
      toast.error(error.response?.data?.message || error.message || 'Failed to delete email');
    } finally {
      setDeleting(false);
    }
  };

  const filteredEmails = emails.filter(email =>
    email.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    email.body?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    email.senderEmail?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    email.senderName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-shrink-0 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-textDark">Trash</h1>
          <button
            onClick={fetchTrash}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-[#4DD0E1] text-white rounded-lg hover:bg-[#3BC0D1] transition-colors disabled:opacity-50"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden bg-white/80 rounded-xl shadow-lg backdrop-blur-md">
        <div className={`flex-shrink-0 ${selectedEmail ? 'w-1/2 border-r border-gray-200' : 'w-full'} overflow-y-auto p-4`}>
          {loading ? (
            <div className="p-4 text-center text-textLight">Loading trash...</div>
          ) : filteredEmails.length === 0 ? (
            <div className="p-4 text-center text-textLight">Trash is empty</div>
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
                        {email.deletedAt && (
                          <span className="text-xs text-textLight">
                            Deleted: {new Date(email.deletedAt).toLocaleDateString()}
                          </span>
                        )}
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
                        onClick={() => handleRestore(email._id)}
                        disabled={restoring}
                        className="p-2 text-green-500 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                        title="Restore email"
                      >
                        <RotateCcw size={18} />
                      </button>
                      <button
                        onClick={() => handlePermanentDelete(email._id)}
                        disabled={deleting}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                        title="Delete permanently"
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
                  onClick={() => handleRestore(selectedEmail._id)}
                  disabled={restoring}
                  className="flex items-center gap-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50"
                >
                  <RotateCcw size={16} />
                  {restoring ? 'Restoring...' : 'Restore'}
                </button>
                <button
                  onClick={() => handlePermanentDelete(selectedEmail._id)}
                  disabled={deleting}
                  className="flex items-center gap-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  <Trash2 size={16} />
                  {deleting ? 'Deleting...' : 'Delete Permanently'}
                </button>
              </div>
            </div>
            {selectedEmail.deletedAt && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  <strong>Deleted:</strong> {new Date(selectedEmail.deletedAt).toLocaleString()}
                </p>
              </div>
            )}
            <EmailViewer email={selectedEmail} folder="trash" />
          </div>
        )}
      </div>
    </div>
  );
}

