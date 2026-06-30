// Helper function to format timestamp (works with both Date objects and ISO strings)
export const formatTimestamp = (timestamp) => {
  if (!timestamp) return 'Unknown';
  
  const now = new Date();
  const emailDate = new Date(timestamp);
  const diffInMs = now - emailDate;
  const diffInHours = diffInMs / (1000 * 60 * 60);
  const diffInDays = diffInMs / (1000 * 60 * 60 * 24);

  if (diffInHours < 1) {
    const minutes = Math.floor(diffInMs / (1000 * 60));
    return `${minutes}m ago`;
  } else if (diffInHours < 24) {
    const hours = Math.floor(diffInHours);
    return `${hours}h ago`;
  } else if (diffInDays < 7) {
    const days = Math.floor(diffInDays);
    return `${days}d ago`;
  } else {
    return emailDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
};

