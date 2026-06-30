import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import Login from '../pages/auth/Login';
import Register from '../pages/auth/Register';
import ForgotPassword from '../pages/auth/ForgotPassword';
import ResetPassword from '../pages/auth/ResetPassword';
import DashboardLayout from '../components/layout/DashboardLayout';
import Inbox from '../pages/dashboard/Inbox';
import Sent from '../pages/dashboard/Sent';
import Drafts from '../pages/dashboard/Drafts';
import Trash from '../pages/dashboard/Trash';
import Vault from '../pages/dashboard/Vault';
import Compose from '../pages/dashboard/Compose';
import Settings from '../pages/dashboard/Settings';
import PrivacySettings from '../pages/dashboard/PrivacySettings';

export default function AppRoutes() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <DashboardLayout>
              <Inbox />
            </DashboardLayout>
          </ProtectedRoute>
        } />
        <Route path="/inbox" element={
          <ProtectedRoute>
            <DashboardLayout>
              <Inbox />
            </DashboardLayout>
          </ProtectedRoute>
        } />
        <Route path="/inbox/:id" element={
          <ProtectedRoute>
            <DashboardLayout>
              <Inbox />
            </DashboardLayout>
          </ProtectedRoute>
        } />
        <Route path="/compose" element={
          <ProtectedRoute>
            <DashboardLayout>
              <Compose />
            </DashboardLayout>
          </ProtectedRoute>
        } />
        <Route path="/sent" element={
          <ProtectedRoute>
            <DashboardLayout>
              <Sent />
            </DashboardLayout>
          </ProtectedRoute>
        } />
        <Route path="/sent/:id" element={
          <ProtectedRoute>
            <DashboardLayout>
              <Sent />
            </DashboardLayout>
          </ProtectedRoute>
        } />
        <Route path="/drafts" element={
          <ProtectedRoute>
            <DashboardLayout>
              <Drafts />
            </DashboardLayout>
          </ProtectedRoute>
        } />
        <Route path="/drafts/:id" element={
          <ProtectedRoute>
            <DashboardLayout>
              <Drafts />
            </DashboardLayout>
          </ProtectedRoute>
        } />
        <Route path="/trash" element={
          <ProtectedRoute>
            <DashboardLayout>
              <Trash />
            </DashboardLayout>
          </ProtectedRoute>
        } />
        <Route path="/trash/:id" element={
          <ProtectedRoute>
            <DashboardLayout>
              <Trash />
            </DashboardLayout>
          </ProtectedRoute>
        } />
        <Route path="/vault" element={
          <ProtectedRoute>
            <DashboardLayout>
              <Vault />
            </DashboardLayout>
          </ProtectedRoute>
        } />
        <Route path="/vault/:id" element={
          <ProtectedRoute>
            <DashboardLayout>
              <Vault />
            </DashboardLayout>
          </ProtectedRoute>
        } />
        <Route path="/settings" element={
          <ProtectedRoute>
            <DashboardLayout>
              <Settings />
            </DashboardLayout>
          </ProtectedRoute>
        } />
        <Route path="/settings/privacy" element={
          <ProtectedRoute>
            <DashboardLayout>
              <Settings />
            </DashboardLayout>
          </ProtectedRoute>
        } />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Router>
  );
}
