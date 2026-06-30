// Toast notification utility
let toastId = 0;
let toastListeners = [];

export const showToast = (message, type = 'success', duration = 5000) => {
  const id = ++toastId;
  const toast = { id, message, type, duration };
  
  toastListeners.forEach(listener => listener(toast));
  
  return id;
};

export const subscribeToToasts = (listener) => {
  toastListeners.push(listener);
  return () => {
    toastListeners = toastListeners.filter(l => l !== listener);
  };
};

export const toast = {
  success: (message, duration) => showToast(message, 'success', duration),
  error: (message, duration) => showToast(message, 'error', duration),
  warning: (message, duration) => showToast(message, 'warning', duration),
  info: (message, duration) => showToast(message, 'info', duration),
};

