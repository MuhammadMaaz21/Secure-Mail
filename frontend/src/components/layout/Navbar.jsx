import React from 'react';
import { Search } from 'lucide-react';

export default function Navbar({ searchQuery, onSearchChange }) {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const userEmail = user.email || 'User';
  const userName = user.name || userEmail.split('@')[0].split('.').map(n => n.charAt(0).toUpperCase() + n.slice(1)).join(' ');

  const getInitials = (email) => {
    if (!email) return 'U';
    const parts = email.split('@')[0].split('.');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].substring(0, 2).toUpperCase();
  };

  return (
    <header className="w-full h-16 flex items-center justify-between px-6 bg-white/80 backdrop-blur-md border-b border-gray-200 shadow-sm">
      {/* Search Bar */}
      <div className="flex-1 max-w-md">
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-textLight" />
          <input
            type="text"
            placeholder="Search emails..."
            value={searchQuery || ''}
            onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white/90 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-textDark placeholder:text-textLight/60 text-sm"
          />
        </div>
      </div>

      {/* User Profile */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-textDark">
          <div className="text-right">
            <div className="text-sm font-semibold">{userName}</div>
            <div className="text-xs text-textLight">{userEmail}</div>
          </div>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#2CE4C6] to-[#1FB8A0] flex items-center justify-center text-white font-semibold text-sm">
            {getInitials(userEmail)}
          </div>
        </div>
      </div>
    </header>
  );
}
