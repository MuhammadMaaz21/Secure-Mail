import React from 'react';
import EmailItem from './EmailItem';

export default function EmailList({ 
  emails = [], 
  loading = false,
  onSelect, 
  filter = 'all', 
  searchQuery = '', 
  selectedEmailId = null,
  folder = 'inbox',
  onRetry,
  onDelete,
}) {

  const handleEmailClick = (email) => {
    if (onSelect) {
      onSelect(email);
    }
    // Update URL without full navigation to keep inline view
    const route = folder === 'sent' ? '/sent' : '/inbox';
    window.history.pushState({}, '', `${route}/${email._id}`);
  };

  // Filter emails based on selected filter
  const filteredEmails = React.useMemo(() => {
    let filtered = [...emails];

    // Apply category filter
    if (filter === 'important') {
      filtered = filtered.filter(email => email.isImportant);
    } else if (filter === 'spam') {
      filtered = filtered.filter(email => email.isSpam || email.folder === 'spam');
    } else if (filter === 'phishing') {
      filtered = filtered.filter(email => email.isPhishing);
    }

    // Apply search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        email =>
          email.subject?.toLowerCase().includes(query) ||
          email.senderEmail?.toLowerCase().includes(query) ||
          email.senderName?.toLowerCase().includes(query) ||
          email.body?.toLowerCase().includes(query) ||
          email.to?.some(recipient => recipient.toLowerCase().includes(query))
      );
    }

    // Sort by timestamp (newest first)
    return filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [emails, filter, searchQuery]);

  const unreadCount = filteredEmails.filter(email => !email.isRead).length;

  if (loading) {
    return (
      <aside className="w-full h-full overflow-y-auto bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col items-center justify-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
          <div className="text-textLight">Loading emails...</div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-full h-full flex flex-col overflow-hidden bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex flex-col gap-2">
          {filteredEmails.length > 0 ? (
            filteredEmails.map(email => (
              <EmailItem
                key={email._id}
                email={email}
                onClick={() => handleEmailClick(email)}
                isSelected={selectedEmailId === email._id}
                folder={folder}
                onRetry={onRetry}
                onDelete={onDelete}
              />
            ))
          ) : (
            <div className="text-center py-12">
              <div className="mb-4">
                <svg className="w-16 h-16 mx-auto text-textLight/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-textDark font-medium mb-2">
                {searchQuery ? 'No emails match your search' : 'No emails found'}
              </p>
              {searchQuery ? (
                <p className="text-textLight text-sm">Try adjusting your search terms or filters</p>
              ) : (
                <p className="text-textLight text-sm">Your inbox is empty</p>
              )}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
