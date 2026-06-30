import React, { useState, useEffect } from 'react';
import AppRoutes from './router/routes';
import ToastContainer from './components/common/ToastContainer';
import { subscribeToToasts } from './utils/toast';

export default function App() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const unsubscribe = subscribeToToasts((toast) => {
      setToasts((prev) => [...prev, toast]);
    });
    return unsubscribe;
  }, []);

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  return (
    <>
      <AppRoutes />
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </>
  );
}
