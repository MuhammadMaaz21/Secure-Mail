import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import EmailList from '../../components/email/EmailList';
import EmailViewer from '../../components/email/EmailViewer';
import api from '../../api/api';
import { toast } from '../../utils/toast';

export default function Inbox({ searchQuery: parentSearchQuery, setSearchQuery: setParentSearchQuery }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [selectedEmail, setSelectedEmail] = React.useState(null);
  const [emails, setEmails] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [filter, setFilter] = React.useState('all');
  const [searchQuery, setSearchQuery] = React.useState(parentSearchQuery || '');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = React.useState(parentSearchQuery || '');
  
  // Debounce search query (300ms)
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      if (setParentSearchQuery) {
        setParentSearchQuery(searchQuery);
      }
    }, 300);
    
    return () => clearTimeout(timer);
  }, [searchQuery, setParentSearchQuery]);
  
  // Sync with parent search query
  React.useEffect(() => {
    if (parentSearchQuery !== undefined) {
      setSearchQuery(parentSearchQuery);
      setDebouncedSearchQuery(parentSearchQuery);
    }
  }, [parentSearchQuery]);

  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [totalEmails, setTotalEmails] = React.useState(0);
  const [refreshKey, setRefreshKey] = React.useState(0);
  
  // Fetch emails from API with pagination and filter
  React.useEffect(() => {
    const fetchEmails = async () => {
      try {
        setLoading(true);
        
        // For 'all' filter, we want to show all emails (like Gmail's All Mail)
        // For other filters, use appropriate folder
        let folderParam = 'inbox';
        if (filter === 'spam') {
          folderParam = 'spam'; // Fetch from spam folder
        } else if (filter === 'all') {
          folderParam = 'inbox'; // Use inbox as base, but backend will return all emails
        }
        
        const response = await api.get('/email', {
          params: { folder: folderParam, filter: filter, page, limit: 20 }
        });
        
        if (response.data.success) {
          setEmails(response.data.data.emails || []);
          if (response.data.data.pagination) {
            setTotalPages(response.data.data.pagination.pages || 1);
            setTotalEmails(response.data.data.pagination.total || 0);
          }
        } else {
          throw new Error(response.data.message || 'Failed to load emails');
        }
      } catch (error) {
        console.error('Error fetching emails:', error);
        const errorMessage = error.response?.data?.message || error.message || 'Failed to load emails';
        toast.error(errorMessage);
        setEmails([]); // Set empty array on error
      } finally {
        setLoading(false);
      }
    };

    fetchEmails();
  }, [page, refreshKey, filter]);

  // Refresh emails when navigating away from an email (id becomes null/undefined)
  React.useEffect(() => {
    if (!id) {
      // When id is cleared (navigating away from email view), refresh the list
      setRefreshKey(prev => prev + 1);
    }
  }, [id]);

  // Handle email selection from URL or click
  React.useEffect(() => {
    const loadEmail = async () => {
      if (id) {
        // Check if email is already in the list
        const emailFromList = emails.find(e => e._id === id);
        if (emailFromList) {
          // Check if email is in vault
          if (emailFromList.isVault) {
            setSelectedEmail(null);
            navigate('/inbox');
            return;
          }
          setSelectedEmail(emailFromList);
        } else {
          // Fetch email if not in list
          try {
            const response = await api.get(`/email/${id}`);
            if (response.data.success) {
              // Check if email is in vault
              if (response.data.data.isVault) {
                setSelectedEmail(null);
                navigate('/inbox');
                return;
              }
              setSelectedEmail(response.data.data);
            }
          } catch (error) {
            // If email is not found (404), it was likely deleted or moved
            if (error.response?.status === 404) {
              setSelectedEmail(null);
              navigate('/inbox');
            } else {
            console.error('Error fetching email:', error);
            }
          }
        }
      } else {
        setSelectedEmail(null);
      }
    };

    loadEmail();
  }, [id, emails, navigate]);

  // Clear selected email if it's no longer in the list (was deleted or moved to vault)
  React.useEffect(() => {
    if (selectedEmail && emails.length > 0) {
      const emailExists = emails.find(e => e._id === selectedEmail._id);
      if (!emailExists && id === selectedEmail._id) {
        // Email was deleted or moved to vault, clear selection and navigate
        setSelectedEmail(null);
        navigate('/inbox');
      }
    }
    // Also check if selected email is marked as vault
    if (selectedEmail && selectedEmail.isVault && id === selectedEmail._id) {
      setSelectedEmail(null);
      navigate('/inbox');
    }
  }, [emails, selectedEmail, id, navigate]);

  // Function to refresh email list (can be called after deletion)
  const refreshEmails = React.useCallback(() => {
    setRefreshKey(prev => prev + 1);
  }, []);

  // Listen for storage events or use a custom event to trigger refresh
  React.useEffect(() => {
    const handleStorageChange = () => {
      refreshEmails();
    };
    
    // Listen for custom refresh event
    window.addEventListener('refreshInbox', handleStorageChange);
    
    return () => {
      window.removeEventListener('refreshInbox', handleStorageChange);
    };
  }, [refreshEmails]);

  const handleEmailSelect = (email) => {
    setSelectedEmail(email);
    // Update URL without navigation to keep on same page
    window.history.pushState({}, '', `/inbox/${email._id}`);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-shrink-0 mb-4">
        <h1 className="text-2xl font-bold text-textDark mb-4">Inbox</h1>
        
        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-4">
          {[
            { key: 'all', label: 'All' },
            { key: 'important', label: 'Important' },
            { key: 'spam', label: 'Spam' },
            { key: 'phishing', label: 'Phishing' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-4 py-2 rounded-full font-medium text-sm transition-all ${
                filter === key
                  ? 'bg-[#2CE4C6] text-white shadow-md'
                  : 'bg-white/80 text-textDark hover:bg-white border border-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-1 gap-4 lg:gap-6 min-h-0 overflow-hidden">
        {/* Email List - Left Pane */}
        <div className="w-full lg:w-2/5 lg:max-w-md flex-shrink-0 overflow-hidden flex flex-col">
          <EmailList
            emails={emails}
            loading={loading}
            onSelect={handleEmailSelect}
            filter={filter}
            searchQuery={debouncedSearchQuery}
            selectedEmailId={selectedEmail?._id}
          />
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-white">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 rounded-lg bg-white border border-gray-200 text-textDark hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-sm text-textLight">
                Page {page} of {totalPages} ({totalEmails} total)
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-4 py-2 rounded-lg bg-white border border-gray-200 text-textDark hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          )}
        </div>
        {/* Email Detail - Right Pane */}
        <div className="w-full lg:w-3/5 flex-shrink-0 overflow-hidden">
          <EmailViewer email={selectedEmail} />
        </div>
      </div>
    </div>
  );
}
