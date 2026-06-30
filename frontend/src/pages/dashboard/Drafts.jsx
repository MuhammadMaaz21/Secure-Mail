import React from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import EmailList from '../../components/email/EmailList';
import EmailViewer from '../../components/email/EmailViewer';
import api from '../../api/api';
import { toast } from '../../utils/toast';
import { Trash2, Edit } from 'lucide-react';

export default function Drafts() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedEmail, setSelectedEmail] = React.useState(null);
  const [emails, setEmails] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState('');

  // Fetch drafts from API
  const fetchDrafts = React.useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/email/drafts');
      
      if (response.data.success) {
        const drafts = response.data.data.emails || [];
        
        // Remove duplicates by _id
        const uniqueDrafts = drafts.filter((draft, index, self) => 
          index === self.findIndex(d => 
            (d._id?.toString() || d.id?.toString()) === (draft._id?.toString() || draft.id?.toString())
          )
        );
        
        setEmails(uniqueDrafts);
      } else {
        throw new Error(response.data.message || 'Failed to load drafts');
      }
    } catch (error) {
      console.error('Error fetching drafts:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to load drafts';
      toast.error(errorMessage);
      setEmails([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Refresh drafts when navigating to this page (location change) or on mount
  React.useEffect(() => {
    if (location.pathname.startsWith('/drafts')) {
      fetchDrafts();
    }
  }, [location.pathname, fetchDrafts]);
  
  // Also refresh on mount
  React.useEffect(() => {
    fetchDrafts();
  }, [fetchDrafts]);

  // Also refresh when page becomes visible (user switches back to this tab)
  React.useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && location.pathname.startsWith('/drafts')) {
        fetchDrafts();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [location.pathname, fetchDrafts]);

  // Refresh drafts when page becomes visible (user navigates back)
  React.useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Refresh drafts when page becomes visible
        fetchDrafts();
      }
    };

    const handleFocus = () => {
      // Also refresh when window gains focus
      fetchDrafts();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchDrafts]);

  // Handle email selection from URL or click
  React.useEffect(() => {
    if (id) {
      const emailFromList = emails.find(e => e._id === id);
      if (emailFromList) {
        setSelectedEmail(emailFromList);
      } else {
        try {
          api.get(`/email/${id}`).then(response => {
            if (response.data.success) {
              setSelectedEmail(response.data.data);
            }
          });
        } catch (error) {
          console.error('Error fetching draft:', error);
        }
      }
    } else {
      setSelectedEmail(null);
    }
  }, [id, emails]);

  const handleEmailSelect = (email) => {
    setSelectedEmail(email);
    window.history.pushState({}, '', `/drafts/${email._id}`);
  };

  const handleEditDraft = (email) => {
    const draftId = email._id?.toString() || email.id?.toString();
    // Filter out placeholder emails when editing
    const toArray = email.to && Array.isArray(email.to) ? email.to : (email.to ? [email.to] : []);
    const filteredTo = toArray.filter(e => e && e !== 'draft@placeholder.local');
    
    navigate('/compose', {
      state: {
        draft: {
          id: draftId,
          to: filteredTo.length > 0 ? filteredTo.join(', ') : '',
          cc: email.cc && Array.isArray(email.cc) ? email.cc.join(', ') : (email.cc || ''),
          bcc: email.bcc && Array.isArray(email.bcc) ? email.bcc.join(', ') : (email.bcc || ''),
          subject: email.subject && email.subject !== '(No subject)' ? email.subject : '',
          body: email.body && email.body !== '(No content)' ? email.body : '',
          selfDestructTimer: email.selfDestructTimer || 'none'
        }
      }
    });
  };

  const handleDeleteDraft = async (emailId) => {
    if (!window.confirm('Are you sure you want to delete this draft?')) {
      return;
    }

    try {
      const response = await api.delete(`/email/draft/${emailId}`);
      if (response.data.success) {
        // Refresh drafts list after deletion
        await fetchDrafts();
        toast.success('Draft deleted successfully');
        setEmails(emails.filter(e => e._id !== emailId));
        if (selectedEmail && selectedEmail._id === emailId) {
          setSelectedEmail(null);
          navigate('/drafts');
        }
      } else {
        throw new Error(response.data.message || 'Failed to delete draft');
      }
    } catch (error) {
      console.error('Error deleting draft:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to delete draft';
      toast.error(errorMessage);
    }
  };

  const filteredEmails = emails.filter(email => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      email.subject?.toLowerCase().includes(query) ||
      email.body?.toLowerCase().includes(query) ||
      email.to?.some(e => e.toLowerCase().includes(query)) ||
      email.cc?.some(e => e.toLowerCase().includes(query))
    );
  });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-shrink-0 mb-4">
        <h1 className="text-2xl font-bold text-textDark mb-4">Drafts</h1>
        
        {/* Search */}
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search drafts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full glass bg-white/90 px-4 py-2 rounded-xl border border-gray-200 text-textDark focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      <div className="flex-1 flex gap-4 overflow-hidden">
        {/* Email List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
              <p className="text-textDark">Loading drafts...</p>
            </div>
          ) : filteredEmails.length === 0 ? (
            <div className="text-center py-12">
              <div className="mb-4">
                <svg className="w-16 h-16 mx-auto text-textLight/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-textDark font-medium mb-2">No drafts found</p>
              <p className="text-textLight text-sm">Start composing an email to create your first draft</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredEmails.map((email) => {
                const emailId = email._id?.toString() || email.id?.toString();
                return (
                <div
                  key={emailId}
                  onClick={() => handleEmailSelect(email)}
                  className={`glass p-4 rounded-xl cursor-pointer transition-all hover:shadow-lg ${
                    selectedEmail?._id === email._id || selectedEmail?.id === emailId
                      ? 'bg-[#4DD0E1]/20 border-2 border-[#4DD0E1]'
                      : 'bg-white/80 hover:bg-white/90'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-textDark truncate">
                          {email.to && email.to.length > 0 
                            ? email.to.filter(e => e && e !== 'draft@placeholder.local').join(', ') || '(No recipient)'
                            : '(No recipient)'}
                        </p>
                        {email.cc && email.cc.length > 0 && (
                          <span className="text-xs text-textLight">CC: {email.cc.join(', ')}</span>
                        )}
                      </div>
                      <p className="font-medium text-textDark mb-1 truncate">
                        {email.subject || '(No subject)'}
                      </p>
                      <p className="text-sm text-textLight line-clamp-2">
                        {email.body || '(No content)'}
                      </p>
                      <p className="text-xs text-textLight mt-2">
                        {new Date(email.updatedAt || email.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditDraft(email);
                        }}
                        className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                        title="Edit draft"
                      >
                        <Edit size={18} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteDraft(email._id);
                        }}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete draft"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Email Viewer */}
        {selectedEmail && (
          <div className="w-1/2 glass p-6 rounded-xl bg-white/80 overflow-y-auto">
            <EmailViewer email={selectedEmail} />
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => handleEditDraft(selectedEmail)}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primaryDark transition-colors font-medium"
              >
                Edit Draft
              </button>
              <button
                onClick={() => handleDeleteDraft(selectedEmail._id)}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium"
              >
                Delete Draft
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

