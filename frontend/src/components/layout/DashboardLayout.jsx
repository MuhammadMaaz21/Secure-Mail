import React from 'react';
import Sidebar from './Sidebar';
import Navbar from './Navbar';

export default function DashboardLayout({ children }) {
  const [searchQuery, setSearchQuery] = React.useState('');

  return (
    <div className="h-screen bg-gradient-to-br from-blue-50 via-cyan-50 to-teal-50 flex overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden ml-64">
        <Navbar searchQuery={searchQuery} onSearchChange={setSearchQuery} />
        <main className="flex-1 overflow-hidden p-6 md:p-10">
          {React.cloneElement(children, { searchQuery, setSearchQuery })}
        </main>
      </div>
    </div>
  );
}
