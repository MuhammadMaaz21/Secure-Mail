import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Inbox, Send, Pencil, Settings, LogOut, Shield, FileText, Trash2, Lock } from 'lucide-react';
import api from '../../api/api';

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = React.useState(0);

  // Fetch unread count (excluding vaulted emails)
  React.useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const response = await api.get('/email', {
          params: { folder: 'inbox' }
        });
        if (response.data.success) {
          const emails = response.data.data.emails || [];
          // Filter out vaulted emails and count unread
          const unread = emails.filter(email => !email.isRead && !email.isVault).length;
          setUnreadCount(unread);
        }
      } catch (error) {
        console.error('Error fetching unread count:', error);
      }
    };
    fetchUnreadCount();
    // Refresh every 30 seconds
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);
  
  // Listen for refresh events (when emails are moved to vault)
  React.useEffect(() => {
    const handleRefresh = () => {
      // Re-fetch unread count when emails are moved
      const fetchUnreadCount = async () => {
        try {
          const response = await api.get('/email', {
            params: { folder: 'inbox' }
          });
          if (response.data.success) {
            const emails = response.data.data.emails || [];
            const unread = emails.filter(email => !email.isRead && !email.isVault).length;
            setUnreadCount(unread);
          }
        } catch (error) {
          console.error('Error fetching unread count:', error);
        }
      };
      fetchUnreadCount();
    };
    
    window.addEventListener('refreshInbox', handleRefresh);
    return () => window.removeEventListener('refreshInbox', handleRefresh);
  }, []);

  const isActive = (path) => {
    if (path === '/dashboard') {
      return location.pathname === '/dashboard' || location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  const handleLogout = () => {
    localStorage.removeItem('jwt');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('tokenExpiresAt');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const navItems = [
    { path: '/dashboard', icon: Inbox, label: 'Inbox', badge: unreadCount > 0 ? unreadCount : null },
    { path: '/compose', icon: Pencil, label: 'Compose' },
    { path: '/sent', icon: Send, label: 'Sent' },
    { path: '/drafts', icon: FileText, label: 'Drafts' },
    { path: '/trash', icon: Trash2, label: 'Trash' },
    { path: '/vault', icon: Lock, label: 'Secure Vault' },
    { path: '/settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <aside className="h-screen w-64 flex flex-col bg-gradient-to-b from-[#1FB8A0] to-[#2CE4C6] text-white shadow-lg fixed left-0 top-0 z-10">
      {/* Logo */}
      <div className="p-6 pb-6 border-b border-white/20">
        <div className="flex flex-col items-center justify-center gap-2">
          <Shield size={32} className="text-white" />
          <h1 className="text-xl font-bold text-white leading-tight text-center">
            <span className="block">Secure</span>
            <span className="block text-sm">Mail</span>
          </h1>
        </div>
      </div>
      
      {/* Navigation */}
      <nav className="flex-1 px-4 py-4">
        <ul className="space-y-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                    active
                      ? 'bg-[#4DD0E1] text-white shadow-md'
                      : 'text-white bg-transparent hover:bg-white/20 hover:shadow-md'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon size={20} className="text-white" />
                    <span className="font-medium text-white">{item.label}</span>
                  </div>
                  {item.badge && item.badge > 0 && (
                    <span className="px-2.5 py-0.5 bg-gray-700 text-white text-xs font-semibold rounded-full min-w-[24px] text-center">
                      {item.badge}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Logout Button - Tile Style */}
      <div className="px-4 pb-4 border-t border-white/20 pt-4">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 bg-[#4DD0E1] text-white hover:bg-[#3BC0D1] font-bold"
          style={{
            boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.15)'
          }}
        >
          <LogOut size={20} className="text-white" />
          <span className="text-white font-bold">Logout</span>
        </button>
      </div>
    </aside>
  );
}
