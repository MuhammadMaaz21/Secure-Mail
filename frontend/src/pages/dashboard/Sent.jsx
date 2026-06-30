import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Send, RotateCw } from 'lucide-react';
import EmailList from '../../components/email/EmailList';
import EmailViewer from '../../components/email/EmailViewer';
import api from '../../api/api';
import { toast } from '../../utils/toast';

export default function Sent({ searchQuery: parentSearchQuery, setSearchQuery: setParentSearchQuery }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [selectedEmail, setSelectedEmail] = React.useState(null);
  const [emails, setEmails] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState(parentSearchQuery || '');
  const [retryingIds, setRetryingIds] = React.useState(new Set());
  const selectedEmailIdRef = React.useRef(null);
  
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

  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  
  // Fetch sent emails from API with pagination
  React.useEffect(() => {
    const fetchEmails = async () => {
      try {
        setLoading(true);
        const response = await api.get('/email', {
          params: { folder: 'sent', page, limit: 20 }
        });
        
        if (response.data.success) {
          setEmails(response.data.data.emails || []);
          if (response.data.data.pagination) {
            setTotalPages(response.data.data.pagination.pages || 1);
          }
        }
      } catch (error) {
        console.error('Error fetching sent emails:', error);
        const errorMessage = error.response?.data?.message || error.message || 'Failed to load sent emails';
        toast.error(errorMessage);
        setEmails([]); // Set empty array on error
      } finally {
        setLoading(false);
      }
    };

    fetchEmails();
  }, [page]);

  // Auto-refresh emails if there are pending statuses
  React.useEffect(() => {
    const hasPendingEmails = emails.some(e => e.deliveryStatus === 'pending');
    
    if (!hasPendingEmails) {
      return; // No pending emails, no need to refresh
    }
    
    // Set up auto-refresh to check for delivery status updates
    // Refresh every 2 seconds for up to 10 seconds to catch status updates
    let refreshCount = 0;
    const maxRefreshes = 5; // 5 refreshes * 2 seconds = 10 seconds
    
    let isCleared = false;
    const autoRefreshInterval = setInterval(async () => {
      if (isCleared) return;
      
      if (refreshCount < maxRefreshes) {
        try {
          const response = await api.get('/email', {
            params: { folder: 'sent', page, limit: 20 }
          });
          if (response.data.success) {
            const updatedEmails = response.data.data.emails || [];
            setEmails(updatedEmails);
            
            // Update pagination state if available
            if (response.data.data.pagination) {
              setTotalPages(response.data.data.pagination.pages || 1);
            }
            
            // Stop refreshing if no more pending emails
            const stillHasPending = updatedEmails.some(e => e.deliveryStatus === 'pending');
            if (!stillHasPending) {
              isCleared = true;
              clearInterval(autoRefreshInterval);
            }
          }
        } catch (error) {
          console.error('Error refreshing emails:', error);
          // Stop on error to prevent infinite loops
          // Don't show toast for auto-refresh errors to avoid spam
          isCleared = true;
          clearInterval(autoRefreshInterval);
        }
        refreshCount++;
      } else {
        isCleared = true;
        clearInterval(autoRefreshInterval);
      }
    }, 2000);
    
    return () => {
      clearInterval(autoRefreshInterval);
    };
  }, [emails, page]);

  // Handle email selection from URL or click
  React.useEffect(() => {
    const loadEmail = async () => {
      if (id) {
        selectedEmailIdRef.current = id;
        // Check if email is already in the list
        const emailFromList = emails.find(e => e._id === id);
        if (emailFromList) {
          setSelectedEmail(emailFromList);
        } else {
          // If we already have the selected email with matching id, preserve it
          // (might be on a different page or not in current list)
          if (selectedEmail && selectedEmail._id === id) {
            // Keep the existing selectedEmail, don't clear it
            return;
          }
          
          // Fetch email if not in list and not already selected
          try {
            const response = await api.get(`/email/${id}`);
            if (response.data.success) {
              setSelectedEmail(response.data.data);
            }
          } catch (error) {
            // If email is not found (404), it was likely deleted
            if (error.response?.status === 404) {
              setSelectedEmail(null);
              selectedEmailIdRef.current = null;
            } else {
            console.error('Error fetching email:', error);
            }
          }
        }
      } else {
        setSelectedEmail(null);
        selectedEmailIdRef.current = null;
      }
    };

    loadEmail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]); // Only depend on id, not emails or selectedEmail

  // Update selectedEmail when emails list updates (for auto-refresh)
  // This preserves the selected email even when the list refreshes
  React.useEffect(() => {
    const currentId = selectedEmailIdRef.current;
    if (currentId && selectedEmail && selectedEmail._id === currentId) {
      // Check if email was moved to vault
      if (selectedEmail.isVault) {
        setSelectedEmail(null);
        selectedEmailIdRef.current = null;
        navigate('/sent');
        return;
      }
      
      // Check if email is in the updated list and update with fresh data
      const emailFromList = emails.find(e => e._id === currentId);
      if (emailFromList) {
        // Update with fresh data from list
        setSelectedEmail(emailFromList);
      }
      // If not in list, preserve the existing selectedEmail (don't clear it)
    }
  }, [emails, selectedEmail, navigate]);

  const handleEmailSelect = (email) => {
    setSelectedEmail(email);
    // Update URL without navigation to keep on same page
    window.history.pushState({}, '', `/sent/${email._id}`);
  };

  const refreshEmails = React.useCallback(async () => {
    try {
      const response = await api.get('/email', {
        params: { folder: 'sent', page, limit: 20 }
      });
      if (response.data.success) {
        setEmails(response.data.data.emails || []);
        if (response.data.data.pagination) {
          setTotalPages(response.data.data.pagination.pages || 1);
        }
      }
    } catch (error) {
      console.error('Error refreshing emails:', error);
    }
  }, [page]);

  const handleRetry = async (email) => {
    if (retryingIds.has(email._id)) return;
    
    try {
      setRetryingIds(prev => new Set(prev).add(email._id));
      const response = await api.post(`/email/${email._id}/retry`);
      
      if (response.data.success) {
        toast.success('Retrying email delivery...');
        // Update local state immediately
        setEmails(prevEmails => 
          prevEmails.map(e => 
            e._id === email._id 
              ? { ...e, deliveryStatus: 'pending', deliveryError: null }
              : e
          )
        );
        // Refresh emails after a short delay without showing loading
        setTimeout(() => {
          refreshEmails();
        }, 2500);
      } else {
        throw new Error(response.data.message || 'Failed to retry email');
      }
    } catch (error) {
      console.error('Error retrying email:', error);
      const errorMessage = error.message || error.error?.message || 'Failed to retry email';
      toast.error(errorMessage);
    } finally {
      setTimeout(() => {
        setRetryingIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(email._id);
          return newSet;
        });
      }, 2000);
    }
  };

  const failedCount = emails.filter(e => e.deliveryStatus === 'failed').length;
  const pendingCount = emails.filter(e => e.deliveryStatus === 'pending').length;
  const deliveredCount = emails.filter(e => e.deliveryStatus === 'delivered').length;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-shrink-0 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-textDark">Sent</h1>
          
          {/* Delivery Status Summary */}
          <div className="flex items-center gap-3 text-sm">
            {deliveredCount > 0 && (
              <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full font-medium">
                {deliveredCount} Delivered
              </span>
            )}
            {pendingCount > 0 && (
              <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full font-medium">
                {pendingCount} Pending
              </span>
            )}
            {failedCount > 0 && (
              <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full font-medium">
                {failedCount} Failed
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-1 gap-4 lg:gap-6 min-h-0 overflow-hidden">
        <div className="w-full lg:w-2/5 lg:max-w-md flex-shrink-0 overflow-hidden flex flex-col">
          <EmailList
            emails={emails}
            loading={loading}
            onSelect={handleEmailSelect}
            filter="all"
            searchQuery={searchQuery}
            selectedEmailId={selectedEmail?._id}
            folder="sent"
            onRetry={handleRetry}
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
                Page {page} of {totalPages}
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
        <div className="w-full lg:w-3/5 flex-shrink-0 overflow-hidden">
          <EmailViewer email={selectedEmail} />
        </div>
      </div>
    </div>
  );
}
