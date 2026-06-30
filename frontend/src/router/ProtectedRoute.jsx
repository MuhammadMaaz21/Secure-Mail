import React from 'react';
import { Navigate } from 'react-router-dom';

export default function ProtectedRoute({ children }) {
  const token = localStorage.getItem('jwt');
  const expiresAt = localStorage.getItem('tokenExpiresAt');
  
  // Check if token exists
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  
  // Check if token is expired
  if (expiresAt) {
    const now = Date.now();
    const expiresIn = parseInt(expiresAt) - now;
    if (expiresIn <= 0) {
      // Token expired, clear and redirect
      localStorage.removeItem('jwt');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('tokenExpiresAt');
      localStorage.removeItem('user');
      return <Navigate to="/login" replace />;
    }
  }
  
  return children;
}
